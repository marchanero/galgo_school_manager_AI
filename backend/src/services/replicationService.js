import { spawn, exec as execCallback } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import cron from 'node-cron'
import { replication as replicationConfig } from '../config.js'

const exec = promisify(execCallback)

class ReplicationService {
  constructor() {
    this.isReplicating = false
    this.queue = []
    this.prisma = null
    this.io = null  // Socket.io instance para emitir progreso
    this.currentProgress = null  // Estado actual del progreso de replicación
    this.cronTask = null
    this.schedule = '0 3 * * *' // Default: 3:00 AM
    this.enabled = false
    this.retentionDays = 0 // 0 = no borrar nunca
    this.deleteAfterExport = false
    this.lastSyncTime = null
    this.transferStats = {
      totalTransferred: 0,
      successCount: 0,
      failCount: 0,
      lastError: null
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNCIONES DE HASH Y VERIFICACIÓN DE INTEGRIDAD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcula hash SHA256 de un archivo local
   */
  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      
      stream.on('error', reject)
      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
    })
  }

  /**
   * Obtiene hash SHA256 de archivo remoto via SSH
   */
  async getRemoteFileHash(remotePath) {
    const { host, user, port, sshKeyPath } = replicationConfig
    const sshTarget = `${user}@${host}`
    
    const sshArgs = ['-p', port.toString(), '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=30']
    if (sshKeyPath) sshArgs.push('-i', sshKeyPath)
    
    const cmd = `ssh ${sshArgs.join(' ')} ${sshTarget} "sha256sum '${remotePath}'" 2>/dev/null`
    
    try {
      const { stdout } = await exec(cmd)
      const hash = stdout.trim().split(/\s+/)[0]
      return hash
    } catch (error) {
      console.error(`❌ Error obteniendo hash remoto: ${error.message}`)
      return null
    }
  }

  /**
   * Verifica integridad de archivo comparando hashes local y remoto
   */
  async verifyFileIntegrity(localPath, remotePath) {
    try {
      const localHash = await this.calculateFileHash(localPath)
      const remoteHash = await this.getRemoteFileHash(remotePath)
      
      if (!remoteHash) {
        return { verified: false, error: 'No se pudo obtener hash remoto' }
      }
      
      const match = localHash === remoteHash
      return { 
        verified: match, 
        localHash, 
        remoteHash,
        error: match ? null : 'Hashes no coinciden'
      }
    } catch (error) {
      return { verified: false, error: error.message }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNCIONES DE ESPACIO Y MONITOREO REMOTO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verifica espacio disponible en destino (montaje local o servidor remoto via SSH)
   */
  async checkRemoteSpace() {
    // Para tipo 'mount': usar df directamente en el montaje local
    if (replicationConfig.destinationType === 'mount') {
      return this.checkMountSpace()
    }
    
    if (replicationConfig.useMock || !replicationConfig.host) {
      return this.getMockRemoteSpace()
    }

    const { host, user, port, remotePath, sshKeyPath } = replicationConfig
    const sshTarget = `${user}@${host}`
    
    const sshArgs = ['-p', port.toString(), '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=10']
    if (sshKeyPath) sshArgs.push('-i', sshKeyPath)
    
    const cmd = `ssh ${sshArgs.join(' ')} ${sshTarget} "df -B1 '${remotePath}' --output=size,used,avail,pcent | tail -n 1"`
    
    try {
      const { stdout } = await exec(cmd)
      const parts = stdout.trim().split(/\s+/)
      
      const total = parseInt(parts[0], 10)
      const used = parseInt(parts[1], 10)
      const available = parseInt(parts[2], 10)
      const usePercent = parseInt((parts[3] || '0').replace('%', ''), 10)
      
      return {
        available: true,
        total,
        used,
        free: available,
        usePercent,
        totalGB: Math.round(total / 1024 / 1024 / 1024),
        usedGB: Math.round(used / 1024 / 1024 / 1024),
        freeGB: Math.round(available / 1024 / 1024 / 1024),
        canTransfer: usePercent < replicationConfig.remoteMaxUsePercent,
        isCritical: usePercent >= replicationConfig.remoteCriticalPercent,
        lastChecked: new Date().toISOString()
      }
    } catch (error) {
      console.error(`❌ Error verificando espacio remoto: ${error.message}`)
      return { available: false, error: error.message, canTransfer: false }
    }
  }
  
  /**
   * Verifica espacio en punto de montaje SMB/NFS local
   */
  async checkMountSpace() {
    const mountPath = replicationConfig.mountPath
    
    // Verificar si el montaje existe
    if (!fs.existsSync(mountPath)) {
      return { available: false, error: `Punto de montaje no existe: ${mountPath}`, canTransfer: false }
    }
    
    try {
      const { stdout } = await exec(`df -B1 '${mountPath}' --output=size,used,avail,pcent | tail -n 1`)
      const parts = stdout.trim().split(/\s+/)
      
      const total = parseInt(parts[0], 10)
      const used = parseInt(parts[1], 10)
      const available = parseInt(parts[2], 10)
      const usePercent = parseInt((parts[3] || '0').replace('%', ''), 10)
      
      return {
        available: true,
        isMount: true,
        mountPath,
        total,
        used,
        free: available,
        usePercent,
        totalGB: Math.round(total / 1024 / 1024 / 1024),
        usedGB: Math.round(used / 1024 / 1024 / 1024),
        freeGB: Math.round(available / 1024 / 1024 / 1024),
        totalTB: (total / 1024 / 1024 / 1024 / 1024).toFixed(2),
        freeTB: (available / 1024 / 1024 / 1024 / 1024).toFixed(2),
        canTransfer: usePercent < replicationConfig.remoteMaxUsePercent,
        isCritical: usePercent >= replicationConfig.remoteCriticalPercent,
        lastChecked: new Date().toISOString()
      }
    } catch (error) {
      console.error(`❌ Error verificando espacio en montaje: ${error.message}`)
      return { available: false, error: error.message, canTransfer: false }
    }
  }

  getMockRemoteSpace() {
    const totalTB = replicationConfig.mockCapacityTB || 6
    const totalGB = totalTB * 1024
    const usePercent = Math.floor(Math.random() * 30) + 10
    const usedGB = Math.floor((totalGB * usePercent) / 100)
    const freeGB = totalGB - usedGB
    
    return {
      available: true,
      isMock: true,
      total: totalGB * 1024 * 1024 * 1024,
      used: usedGB * 1024 * 1024 * 1024,
      free: freeGB * 1024 * 1024 * 1024,
      totalGB,
      usedGB,
      freeGB,
      usePercent,
      canTransfer: usePercent < replicationConfig.remoteMaxUsePercent,
      isCritical: usePercent >= replicationConfig.remoteCriticalPercent,
      lastChecked: new Date().toISOString()
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RCLONE: MOTOR DE TRANSFERENCIA PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Configura remote de rclone si no existe
   */
  async setupRcloneRemote() {
    const { rcloneRemote, host, port, user, password, sshKeyPath } = replicationConfig
    
    try {
      // Verificar si el remote ya existe
      const { stdout } = await exec(`rclone listremotes 2>/dev/null`)
      if (stdout.includes(`${rcloneRemote}:`)) {
        console.log(`✅ Remote rclone '${rcloneRemote}' ya existe`)
        return true
      }
      
      // Crear remote SFTP
      let createCmd = `rclone config create ${rcloneRemote} sftp host=${host} port=${port} user=${user}`
      
      if (password) {
        // Obscurecer contraseña para rclone
        const { stdout: obscured } = await exec(`rclone obscure "${password}"`)
        createCmd += ` pass=${obscured.trim()}`
      }
      
      if (sshKeyPath) {
        createCmd += ` key_file=${sshKeyPath}`
      }
      
      await exec(createCmd)
      console.log(`✅ Remote rclone '${rcloneRemote}' creado exitosamente`)
      return true
    } catch (error) {
      console.error(`❌ Error configurando rclone: ${error.message}`)
      return false
    }
  }

  /**
   * Ejecuta transferencia con rclone con progreso en tiempo real
   */
  rcloneCopy(localPath, remotePath, options = {}) {
    return new Promise((resolve, reject) => {
      const { rcloneRemote, transfers, checkers, retries, retrySleep, timeout } = replicationConfig
      
      const args = [
        'copy',
        localPath,
        `${rcloneRemote}:${remotePath}`,
        '--checksum',
        `--transfers=${options.transfers || transfers}`,
        `--checkers=${options.checkers || checkers}`,
        `--retries=${options.retries || retries}`,
        `--retries-sleep=${options.retrySleep || retrySleep}s`,
        `--timeout=${options.timeout || timeout}s`,
        '--low-level-retries=20',
        '--stats=1s',
        '--stats-one-line',
        '-P'  // Progreso en tiempo real
      ]
      
      console.log(`🚀 Ejecutando: rclone ${args.slice(0, 4).join(' ')} ...`)
      
      const proc = spawn('rclone', args)
      let stderr = ''
      
      // Regex para parsear línea de progreso de rclone
      // Ejemplo: "Transferred:   50 MiB / 328 MiB, 15%, 5.2 MiB/s, ETA 53s"
      const progressRegex = /Transferred:\s*([0-9.]+\s*\w+)\s*\/\s*([0-9.]+\s*\w+),\s*(\d+)%,\s*([0-9.]+\s*\w+\/s),\s*ETA\s*(.+)/
      
      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          const match = line.match(progressRegex)
          if (match) {
            const progressData = {
              transferred: match[1],
              total: match[2],
              percent: parseInt(match[3], 10),
              speed: match[4],
              eta: match[5].trim(),
              timestamp: new Date().toISOString()
            }
            
            // Actualizar estado interno
            this.currentProgress = progressData
            
            // Emitir via WebSocket si está disponible
            if (this.io) {
              this.io.emit('replication:progress', progressData)
            }
            
            // Log cada 10%
            if (progressData.percent % 10 === 0) {
              console.log(`📊 Progreso: ${progressData.percent}% | ${progressData.speed} | ETA: ${progressData.eta}`)
            }
          }
        }
      })
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString()
        const line = data.toString().trim()
        if (!line.includes('DEBUG') && line.length > 0 && !line.includes('Transferred:')) {
          console.log(`[rclone] ${line}`)
        }
      })
      
      proc.on('close', (code) => {
        // Limpiar progreso al finalizar
        this.currentProgress = null
        if (this.io) {
          this.io.emit('replication:complete', { success: code === 0 })
        }
        
        if (code === 0) {
          resolve({ success: true })
        } else {
          reject(new Error(`rclone terminó con código ${code}: ${stderr.slice(-500)}`))
        }
      })
      
      proc.on('error', (error) => reject(error))
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKOFF EXPONENCIAL Y REINTENTOS INTELIGENTES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Ejecuta transferencia con reintentos y backoff exponencial
   */
  async transferWithRetry(localPath, remotePath, maxRetries = null) {
    const retries = maxRetries || replicationConfig.retries
    const { backoffBase, backoffMax, verifyHash } = replicationConfig
    
    let attempt = 0
    let lastError = null
    
    while (attempt < retries) {
      attempt++
      
      try {
        // 1. Verificar espacio antes de transferir
        const spaceCheck = await this.checkRemoteSpace()
        if (!spaceCheck.canTransfer) {
          throw new Error(`Espacio insuficiente en servidor remoto (${spaceCheck.usePercent}% usado)`)
        }
        
        // 2. Ejecutar transferencia según tipo de destino
        if (replicationConfig.destinationType === 'mount') {
          await this.mountCopy(localPath, remotePath)
        } else if (replicationConfig.engine === 'rclone') {
          await this.rcloneCopy(localPath, remotePath)
        } else {
          await this.rsyncCopy(localPath, remotePath)
        }
        
        // 3. Verificar integridad si está habilitado
        if (verifyHash && fs.statSync(localPath).isFile()) {
          const fileName = path.basename(localPath)
          const fullRemotePath = path.join(remotePath, fileName)
          const verification = await this.verifyFileIntegrity(localPath, fullRemotePath)
          
          if (!verification.verified) {
            throw new Error(`Verificación de hash falló: ${verification.error}`)
          }
          console.log(`✅ Verificación SHA256 correcta para ${fileName}`)
        }
        
        // Éxito
        this.transferStats.successCount++
        return { 
          success: true, 
          attempts: attempt,
          message: `Transferencia completada en intento ${attempt}`
        }
        
      } catch (error) {
        lastError = error
        this.transferStats.lastError = error.message
        
        if (attempt >= retries) {
          this.transferStats.failCount++
          throw error
        }
        
        // Calcular delay con backoff exponencial
        const delay = Math.min(Math.pow(backoffBase, attempt), backoffMax) * 1000
        console.log(`⚠️ Intento ${attempt}/${retries} falló: ${error.message}`)
        console.log(`⏳ Reintentando en ${delay / 1000}s...`)
        
        await new Promise(r => setTimeout(r, delay))
      }
    }
    
    throw lastError
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RSYNC: MOTOR ALTERNATIVO
  // ═══════════════════════════════════════════════════════════════════════════

  rsyncCopy(localPath, remotePath) {
    return new Promise((resolve, reject) => {
      const { host, user, port, sshKeyPath } = replicationConfig
      
      const sshCmd = sshKeyPath 
        ? `ssh -p ${port} -i ${sshKeyPath} -o StrictHostKeyChecking=no`
        : `ssh -p ${port} -o StrictHostKeyChecking=no`
      
      const args = [
        '-avz',
        '--partial',
        '--inplace',
        '--compress-level=1',
        '-e', sshCmd,
        localPath.endsWith('/') ? localPath : localPath + '/',
        `${user}@${host}:${remotePath}`
      ]
      
      console.log(`🚀 Ejecutando: rsync ${args.slice(0, 3).join(' ')} ...`)
      
      const proc = spawn('rsync', args)
      let stderr = ''
      
      proc.stdout.on('data', (data) => {
        const line = data.toString().trim()
        if (!line.includes('%') && line.length > 0) {
          console.log(`[rsync] ${line}`)
        }
      })
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          reject(new Error(`rsync terminó con código ${code}: ${stderr.slice(-500)}`))
        }
      })
      
      proc.on('error', reject)
    })
  }

  /**
   * Copia archivos a un punto de montaje local (SMB/NFS)
   * Usa rsync local para sincronización incremental eficiente
   */
  mountCopy(localPath, remotePath) {
    return new Promise((resolve, reject) => {
      const { mountPath } = replicationConfig
      const fullRemotePath = path.join(mountPath, remotePath)
      
      // Crear directorio destino si no existe
      if (!fs.existsSync(fullRemotePath)) {
        fs.mkdirSync(fullRemotePath, { recursive: true })
      }
      
      const args = [
        '-av',
        '--partial',
        '--inplace',
        '--progress',
        localPath.endsWith('/') ? localPath : localPath + '/',
        fullRemotePath + '/'
      ]
      
      console.log(`🚀 Ejecutando: rsync (local mount) ${localPath} -> ${fullRemotePath}`)
      
      const proc = spawn('rsync', args)
      let stderr = ''
      let bytesTransferred = 0
      
      proc.stdout.on('data', (data) => {
        const line = data.toString().trim()
        // Capturar progreso
        const match = line.match(/(\d+,?\d*)\s+\d+%/)
        if (match) {
          bytesTransferred = parseInt(match[1].replace(/,/g, ''), 10)
        }
        if (!line.includes('%') && line.length > 0 && line.length < 100) {
          console.log(`[rsync] ${line}`)
        }
      })
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      proc.on('close', (code) => {
        if (code === 0) {
          this.transferStats.totalTransferred += bytesTransferred
          resolve({ success: true, bytesTransferred })
        } else {
          reject(new Error(`rsync terminó con código ${code}: ${stderr.slice(-500)}`))
        }
      })
      
      proc.on('error', reject)
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INICIALIZACIÓN Y CONFIGURACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async init(prisma, io = null) {
    this.prisma = prisma
    this.io = io  // Socket.io para emitir progreso
    await this.loadConfig()
    this.setupCron()
    
    // Configurar rclone remote si está habilitado
    if (replicationConfig.enabled && replicationConfig.engine === 'rclone' && !replicationConfig.useMock) {
      await this.setupRcloneRemote()
    }
  }

  async loadConfig() {
    try {
      // Cargar configuración de programación
      const scheduleConfig = await this.prisma.systemConfig.findUnique({
        where: { key: 'replication_schedule' }
      })

      if (scheduleConfig) {
        const { schedule, enabled, retentionDays, deleteAfterExport, lastSyncTime } = JSON.parse(scheduleConfig.value)
        this.schedule = schedule || '0 3 * * *'
        this.enabled = enabled || false
        this.retentionDays = retentionDays || 0
        this.deleteAfterExport = deleteAfterExport || false
        this.lastSyncTime = lastSyncTime || null
        console.log(`📅 Configuración de replicación cargada: ${this.schedule} (Activo: ${this.enabled}, Retención: ${this.retentionDays} días)`)
      } else {
        // Crear configuración por defecto si no existe
        await this.saveConfig(this.schedule, this.enabled, this.retentionDays, this.deleteAfterExport)
      }

      // Cargar configuración del servidor
      const serverConfig = await this.prisma.systemConfig.findUnique({
        where: { key: 'replication_server' }
      })

      if (serverConfig) {
        const savedConfig = JSON.parse(serverConfig.value)
        // Aplicar configuración guardada sobre la del .env
        Object.assign(replicationConfig, savedConfig)
        console.log(`🖥️ Configuración de servidor cargada: ${replicationConfig.useMock ? 'Mock' : replicationConfig.host} (Engine: ${replicationConfig.engine})`)
      } else {
        // Guardar configuración mock por defecto
        await this.saveServerConfig({
          useMock: true,
          engine: 'rclone',
          host: '',
          port: 22,
          user: '',
          password: '',
          sshKeyPath: '',
          remotePath: '/mnt/backups/cameras',
          rcloneRemote: 'truenas',
          transfers: 4,
          retries: 10,
          verifyHash: true,
          backoffBase: 2,
          backoffMax: 300,
          remoteMaxUsePercent: 90
        })
      }
    } catch (error) {
      console.error('Error cargando configuración de replicación:', error)
    }
  }

  /**
   * Guarda la configuración del servidor de backup en Prisma
   */
  async saveServerConfig(serverSettings) {
    try {
      const value = JSON.stringify(serverSettings)

      await this.prisma.systemConfig.upsert({
        where: { key: 'replication_server' },
        update: { value },
        create: {
          key: 'replication_server',
          value,
          description: 'Configuración del servidor de backup remoto'
        }
      })

      // Aplicar la nueva configuración
      Object.assign(replicationConfig, serverSettings)
      
      console.log(`💾 Configuración de servidor guardada: ${serverSettings.useMock ? 'Mock' : serverSettings.host}`)
      
      // Reconfigurar rclone si es necesario
      if (!serverSettings.useMock && serverSettings.engine === 'rclone' && serverSettings.host) {
        await this.setupRcloneRemote()
      }

      return true
    } catch (error) {
      console.error('Error guardando configuración de servidor:', error)
      return false
    }
  }

  /**
   * Obtiene la configuración actual del servidor
   */
  getServerConfig() {
    return {
      useMock: replicationConfig.useMock,
      engine: replicationConfig.engine,
      host: replicationConfig.host,
      port: replicationConfig.port,
      user: replicationConfig.user,
      // No devolver password por seguridad, solo indicar si está configurado
      hasPassword: !!replicationConfig.password,
      hasSshKey: !!replicationConfig.sshKeyPath,
      sshKeyPath: replicationConfig.sshKeyPath,
      remotePath: replicationConfig.remotePath,
      rcloneRemote: replicationConfig.rcloneRemote,
      transfers: replicationConfig.transfers,
      retries: replicationConfig.retries,
      verifyHash: replicationConfig.verifyHash,
      backoffBase: replicationConfig.backoffBase,
      backoffMax: replicationConfig.backoffMax,
      remoteMaxUsePercent: replicationConfig.remoteMaxUsePercent
    }
  }

  async saveConfig(schedule, enabled, retentionDays = 0, deleteAfterExport = false) {
    try {
      const value = JSON.stringify({ 
        schedule, 
        enabled, 
        retentionDays, 
        deleteAfterExport,
        lastSyncTime: this.lastSyncTime 
      })

      await this.prisma.systemConfig.upsert({
        where: { key: 'replication_schedule' },
        update: { value },
        create: {
          key: 'replication_schedule',
          value,
          description: 'Configuración de replicación automática'
        }
      })
      this.schedule = schedule
      this.enabled = enabled
      this.retentionDays = retentionDays
      this.deleteAfterExport = deleteAfterExport
      this.setupCron()
      return true
    } catch (error) {
      console.error('Error guardando configuración:', error)
      return false
    }
  }

  async updateLastSyncTime() {
    this.lastSyncTime = new Date().toISOString()
    await this.saveConfig(this.schedule, this.enabled, this.retentionDays, this.deleteAfterExport)
  }

  setupCron() {
    if (this.cronTask) {
      this.cronTask.stop()
      this.cronTask = null
    }

    if (this.enabled) {
      // Validar cron expression
      if (!cron.validate(this.schedule)) {
        console.error(`❌ Expresión cron inválida: ${this.schedule}`)
        return
      }

      console.log(`⏰ Programando replicación para: ${this.schedule}`)
      this.cronTask = cron.schedule(this.schedule, () => {
        console.log('⏰ Ejecutando replicación programada...')
        this.replicate({ force: true })
      })
    } else {
      console.log('⏸️ Replicación automática desactivada')
    }
  }

  /**
   * Inicia la replicación de grabaciones al servidor remoto o montaje local
   * Usa rclone, rsync (SSH) o rsync local (montaje) según configuración
   * @param {Object} options - Opciones de replicación
   * @param {boolean} options.force - Forzar replicación aunque haya una en curso
   */
  async replicate(options = {}) {
    if (this.isReplicating && !options.force) {
      console.log('⚠️ Replicación ya en curso, omitiendo...')
      return { success: false, message: 'Replicación en curso' }
    }

    // Verificar configuración según tipo de destino
    const isMount = replicationConfig.destinationType === 'mount'
    
    if (!isMount && !replicationConfig.host && !replicationConfig.useMock) {
      console.log('⚠️ Replicación no configurada (faltan credenciales)')
      return { success: false, message: 'Faltan credenciales de replicación' }
    }
    
    if (isMount && !fs.existsSync(replicationConfig.mountPath)) {
      console.log(`⚠️ Punto de montaje no disponible: ${replicationConfig.mountPath}`)
      return { success: false, message: `Montaje no disponible: ${replicationConfig.mountPath}` }
    }

    // Mock mode para pruebas
    if (replicationConfig.useMock && !isMount) {
      console.log('🔧 Modo MOCK: simulando replicación...')
      await new Promise(r => setTimeout(r, 2000))
      await this.updateLastSyncTime()
      return { success: true, message: 'Replicación simulada (mock)', isMock: true }
    }

    this.isReplicating = true
    const transferMethod = isMount ? 'mount' : replicationConfig.engine
    console.log(`🔄 Iniciando replicación con ${transferMethod}...`)

    try {
      // Para mount, usamos 'recordings' como ruta relativa; para remoto, usamos remotePath
      const remotePath = isMount ? 'recordings' : replicationConfig.remotePath
      const localPath = path.join(process.cwd(), 'recordings')
      
      // 1. Verificar espacio remoto antes de empezar
      const spaceCheck = await this.checkRemoteSpace()
      if (!spaceCheck.available) {
        throw new Error(`No se puede conectar al servidor remoto: ${spaceCheck.error}`)
      }
      if (spaceCheck.isCritical) {
        throw new Error(`Espacio crítico en servidor remoto (${spaceCheck.usePercent}% usado)`)
      }
      if (!spaceCheck.canTransfer) {
        console.log(`⚠️ Espacio limitado en remoto (${spaceCheck.usePercent}%), procediendo con precaución...`)
      }
      
      console.log(`📊 Espacio remoto: ${spaceCheck.freeGB}GB libres (${spaceCheck.usePercent}% usado)`)

      // 2. Ejecutar transferencia con reintentos
      const result = await this.transferWithRetry(localPath, remotePath)
      
      console.log(`✅ Replicación completada: ${result.message}`)
      await this.updateLastSyncTime()

      // 3. Limpieza de archivos antiguos si está habilitado
      if (this.deleteAfterExport && this.retentionDays > 0) {
        await this.cleanupOldFiles(localPath)
      }

      this.isReplicating = false
      return { 
        success: true, 
        message: 'Replicación completada',
        attempts: result.attempts,
        stats: this.transferStats
      }

    } catch (error) {
      console.error('❌ Error en replicación:', error.message)
      this.isReplicating = false
      return { success: false, error: error.message, stats: this.transferStats }
    }
  }

  /**
   * Replica un archivo individual con verificación
   */
  async replicateFile(localFilePath, options = {}) {
    if (!fs.existsSync(localFilePath)) {
      return { success: false, error: 'Archivo no existe' }
    }

    const { remotePath } = replicationConfig
    const relativePath = path.relative(path.join(process.cwd(), 'recordings'), localFilePath)
    const remoteDir = path.join(remotePath, path.dirname(relativePath))
    
    try {
      const result = await this.transferWithRetry(localFilePath, remoteDir, options.maxRetries)
      return result
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Obtiene estado detallado de la replicación
   */
  getStatus() {
    return {
      isReplicating: this.isReplicating,
      enabled: this.enabled,
      schedule: this.schedule,
      lastSyncTime: this.lastSyncTime,
      retentionDays: this.retentionDays,
      deleteAfterExport: this.deleteAfterExport,
      engine: replicationConfig.engine,
      useMock: replicationConfig.useMock,
      stats: this.transferStats,
      config: {
        host: replicationConfig.host ? `${replicationConfig.user}@${replicationConfig.host}` : null,
        remotePath: replicationConfig.remotePath,
        verifyHash: replicationConfig.verifyHash,
        transfers: replicationConfig.transfers
      }
    }
  }

  async cleanupOldFiles(basePath) {
    console.log(`🧹 Iniciando limpieza de archivos antiguos (> ${this.retentionDays} días)...`)
    const now = new Date()
    const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000
    let deletedCount = 0

    // Función recursiva para recorrer directorios
    const walk = (dir) => {
      try {
        const list = fs.readdirSync(dir)
        list.forEach(file => {
          const filePath = path.join(dir, file)
          const stat = fs.statSync(filePath)
          
          if (stat && stat.isDirectory()) {
            walk(filePath)
            // Intentar borrar directorio si quedó vacío
            try {
              if (fs.readdirSync(filePath).length === 0) {
                fs.rmdirSync(filePath)
              }
            } catch (e) {}
          } else {
            // Es un archivo, verificar antigüedad
            if (now - stat.mtime > retentionMs) {
              // Solo borrar archivos de video o datos, no archivos de sistema
              if (file.endsWith('.mp4') || file.endsWith('.jsonl') || file.endsWith('.ts')) {
                fs.unlinkSync(filePath)
                deletedCount++
                console.log(`🗑️ Borrado: ${file}`)
              }
            }
          }
        })
      } catch (error) {
        console.error(`Error limpiando directorio ${dir}:`, error)
      }
    }

    walk(basePath)
    console.log(`✅ Limpieza completada. ${deletedCount} archivos eliminados.`)
  }

  /**
   * Obtiene el estado completo del sistema de replicación
   */
  async getStatus() {
    const stats = await this.getStats()
    const remoteDiskInfo = await this.getRemoteDiskInfo()
    const pendingFiles = await this.getPendingFilesCount()
    
    return {
      // Estado general
      enabled: this.enabled,
      isReplicating: this.isReplicating,
      schedule: this.schedule,
      lastSyncTime: this.lastSyncTime,
      
      // Configuración del motor
      engine: replicationConfig.engine,
      useMock: replicationConfig.useMock,
      verifyHash: replicationConfig.verifyHash,
      
      // Servidor remoto
      remoteHost: replicationConfig.useMock ? 'mock-server' : replicationConfig.host,
      remotePort: replicationConfig.port,
      remotePath: replicationConfig.remotePath,
      remoteStatus: remoteDiskInfo.available ? 'online' : 'offline',
      
      // Estadísticas locales
      localFiles: stats.totalFiles,
      localSize: stats.totalSize,
      localSizeFormatted: this.formatBytes(stats.totalSize),
      localDiskInfo: stats.localDiskInfo,
      
      // Estadísticas remotas
      remoteDiskInfo,
      
      // Archivos pendientes
      pendingFiles,
      
      // Configuración de políticas
      retentionDays: this.retentionDays,
      deleteAfterExport: this.deleteAfterExport,
      
      // Configuración de transferencia
      transferConfig: {
        engine: replicationConfig.engine,
        transfers: replicationConfig.transfers,
        retries: replicationConfig.retries,
        verifyHash: replicationConfig.verifyHash,
        backoffBase: replicationConfig.backoffBase,
        backoffMax: replicationConfig.backoffMax
      },
      
      // Última actividad
      lastActivity: {
        sync: this.lastSyncTime,
        check: new Date().toISOString()
      }
    }
  }

  /**
   * Prueba la conexión al servidor remoto
   */
  async testConnection() {
    if (replicationConfig.useMock) {
      // Simular prueba de conexión en modo mock
      return {
        success: true,
        isMock: true,
        message: 'Conexión simulada exitosa (modo mock)',
        latencyMs: Math.floor(Math.random() * 50) + 10,
        serverInfo: {
          type: 'Mock TrueNAS Server',
          version: 'TrueNAS-13.0-U6.1',
          hostname: 'truenas-mock'
        }
      }
    }
    
    const { host, port, user, sshKeyPath, password } = replicationConfig
    
    if (!host) {
      return {
        success: false,
        error: 'Servidor remoto no configurado',
        message: 'Configure REPLICATION_SSH_HOST en las variables de entorno'
      }
    }
    
    const startTime = Date.now()
    
    try {
      // Probar conexión SSH
      await new Promise((resolve, reject) => {
        const sshArgs = [
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ConnectTimeout=10',
          '-o', 'BatchMode=yes',
          '-p', port.toString(),
          ...(sshKeyPath ? ['-i', sshKeyPath] : []),
          `${user}@${host}`,
          'echo "connection_test"'
        ]
        
        // Si hay password, usar sshpass
        let cmd, args
        if (password && !sshKeyPath) {
          cmd = 'sshpass'
          args = ['-p', password, 'ssh', ...sshArgs]
        } else {
          cmd = 'ssh'
          args = sshArgs
        }
        
        const ssh = spawn(cmd, args)
        let output = ''
        let stderr = ''
        
        ssh.stdout.on('data', (data) => { output += data.toString() })
        ssh.stderr.on('data', (data) => { stderr += data.toString() })
        
        ssh.on('close', (code) => {
          if (code === 0 && output.includes('connection_test')) {
            resolve()
          } else {
            reject(new Error(stderr || `Exit code: ${code}`))
          }
        })
        
        ssh.on('error', (error) => reject(error))
        
        // Timeout de 15 segundos
        setTimeout(() => {
          ssh.kill()
          reject(new Error('Connection timeout'))
        }, 15000)
      })
      
      const latencyMs = Date.now() - startTime
      
      // Obtener información del servidor
      const spaceInfo = await this.checkRemoteSpace()
      
      return {
        success: true,
        isMock: false,
        message: `Conexión exitosa a ${host}`,
        latencyMs,
        serverInfo: {
          host,
          port,
          user,
          totalSpace: `${spaceInfo.totalGB} GB`,
          freeSpace: `${spaceInfo.freeGB} GB`,
          usePercent: spaceInfo.usePercent
        }
      }
    } catch (error) {
      return {
        success: false,
        isMock: false,
        error: error.message,
        message: `Error conectando a ${host}: ${error.message}`,
        latencyMs: Date.now() - startTime
      }
    }
  }

  /**
   * Formatea bytes a formato legible
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  async getStats() {
    const localPath = path.join(process.cwd(), 'recordings')
    let totalFiles = 0
    let totalSize = 0

    const walk = (dir) => {
      try {
        if (!fs.existsSync(dir)) return
        const list = fs.readdirSync(dir)
        list.forEach(file => {
          const filePath = path.join(dir, file)
          const stat = fs.statSync(filePath)
          if (stat && stat.isDirectory()) {
            walk(filePath)
          } else {
            if (file.endsWith('.mp4')) {
              totalFiles++
              totalSize += stat.size
            }
          }
        })
      } catch (e) {}
    }

    walk(localPath)

    // Obtener información del espacio en disco local
    let localDiskInfo = null
    try {
      localDiskInfo = await this.getLocalDiskInfo()
    } catch (error) {
      console.error('Error obteniendo información del disco local:', error)
    }
    
    return {
      totalFiles,
      totalSize,
      lastSyncTime: this.lastSyncTime,
      isReplicating: this.isReplicating,
      retentionDays: this.retentionDays,
      deleteAfterExport: this.deleteAfterExport,
      localDiskInfo
    }
  }

  async getRemoteDiskInfo() {
    // Usar la nueva función checkRemoteSpace que soporta mock
    const spaceInfo = await this.checkRemoteSpace()
    
    if (!spaceInfo.available && !spaceInfo.isMock) {
      return {
        available: false,
        error: spaceInfo.error || 'No se pudo conectar al servidor remoto'
      }
    }
    
    // Enriquecer con información adicional
    return {
      available: true,
      isMock: spaceInfo.isMock || false,
      filesystem: '/dev/sdb1',
      mountPoint: replicationConfig.remotePath || '/mnt/remote-backups',
      totalGB: spaceInfo.totalGB,
      usedGB: spaceInfo.usedGB,
      availableGB: spaceInfo.freeGB,
      usePercent: spaceInfo.usePercent,
      canTransfer: spaceInfo.canTransfer,
      isCritical: spaceInfo.isCritical,
      lastChecked: spaceInfo.lastChecked,
      serverType: spaceInfo.isMock ? 'Mock Server' : 'TrueNAS',
      description: `${spaceInfo.totalGB >= 1024 ? Math.round(spaceInfo.totalGB / 1024) : spaceInfo.totalGB}${spaceInfo.totalGB >= 1024 ? 'TB' : 'GB'} External Storage Server${spaceInfo.isMock ? ' (Mock)' : ''}`,
      status: spaceInfo.available ? 'online' : 'offline',
      connectionType: replicationConfig.engine === 'rclone' ? 'SFTP (rclone)' : 'SSH (rsync)',
      replicationConfig: {
        engine: replicationConfig.engine,
        verifyHash: replicationConfig.verifyHash,
        transfers: replicationConfig.transfers,
        retries: replicationConfig.retries
      },
      replicationHistory: spaceInfo.isMock ? [
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          sizeGB: Math.floor(Math.random() * 200) + 50,
          duration: Math.floor(Math.random() * 1800) + 600,
          success: true
        },
        {
          date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          sizeGB: Math.floor(Math.random() * 150) + 25,
          duration: Math.floor(Math.random() * 1200) + 300,
          success: true
        }
      ] : []
    }
  }

  /**
   * Obtiene información del espacio en disco local (donde están las grabaciones)
   */
  async getLocalDiskInfo() {
    try {
      const recordingsPath = path.join(process.cwd(), 'recordings')

      // Ejecutar df para obtener información del disco donde están las grabaciones
      const output = await new Promise((resolve, reject) => {
        const df = spawn('df', ['-BG', recordingsPath])
        let stdout = ''
        let stderr = ''

        df.stdout.on('data', (data) => { stdout += data.toString() })
        df.stderr.on('data', (data) => { stderr += data.toString() })

        df.on('close', (code) => {
          if (code === 0) {
            resolve(stdout.trim())
          } else {
            reject(new Error(`df failed with code ${code}: ${stderr}`))
          }
        })

        df.on('error', (error) => {
          reject(error)
        })
      })

      // Parsear la salida de df (tomar la segunda línea, la primera es header)
      const lines = output.split('\n').filter(line => line.trim() !== '')
      if (lines.length < 2) {
        throw new Error('Formato de salida df inesperado')
      }

      const parts = lines[1].split(/\s+/).filter(part => part.trim() !== '')

      if (parts.length < 6) {
        throw new Error('Formato de salida df insuficiente')
      }

      const totalGB = parseInt(parts[1].replace('G', ''))
      const usedGB = parseInt(parts[2].replace('G', ''))
      const availableGB = parseInt(parts[3].replace('G', ''))
      const usePercent = parseInt(parts[4].replace('%', ''))

      // Obtener información adicional del directorio
      let recordingsSize = 0
      let recordingsCount = 0

      try {
        const walk = (dir) => {
          if (!fs.existsSync(dir)) return
          const list = fs.readdirSync(dir)
          list.forEach(file => {
            const filePath = path.join(dir, file)
            const stat = fs.statSync(filePath)
            if (stat && stat.isDirectory()) {
              walk(filePath)
            } else if (file.endsWith('.mp4') || file.endsWith('.jsonl')) {
              recordingsCount++
              recordingsSize += stat.size
            }
          })
        }
        walk(recordingsPath)
      } catch (error) {
        console.warn('⚠️ Error calculando tamaño de recordings:', error.message)
      }

      return {
        available: true,
        filesystem: parts[0],
        mountPoint: parts[5],
        totalGB,
        usedGB,
        availableGB,
        usePercent,
        recordingsSize,
        recordingsCount,
        lastChecked: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Error obteniendo información del disco local:', error)
      return {
        available: false,
        error: error.message
      }
    }
  }

  async getPendingFilesCount() {
    if (!replicationConfig.host && !replicationConfig.useMock) return 0
    
    // Mock mode
    if (replicationConfig.useMock) {
      return Math.floor(Math.random() * 10) // 0-9 archivos pendientes simulados
    }
    
    try {
      const { host, user, port, remotePath, sshKeyPath } = replicationConfig
      const localPath = path.join(process.cwd(), 'recordings') + '/'

      const sshCmd = sshKeyPath 
        ? `ssh -p ${port} -i ${sshKeyPath} -o StrictHostKeyChecking=no`
        : `ssh -p ${port} -o StrictHostKeyChecking=no`

      const rsyncArgs = [
        '-avn', // -n = dry-run
        '-e', sshCmd,
        localPath,
        `${user}@${host}:${remotePath}`
      ]

      let output = ''
      await new Promise((resolve, reject) => {
        const rsync = spawn('rsync', rsyncArgs)
        rsync.stdout.on('data', (data) => { output += data.toString() })
        rsync.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error('rsync failed'))
        })
        rsync.on('error', reject)
      })

      // Contar líneas que parecen archivos (no directorios ni mensajes de rsync)
      const lines = output.split('\n')
      const fileLines = lines.filter(line => 
        line.trim() !== '' && 
        !line.startsWith('sending incremental file list') && 
        !line.includes('sent ') && 
        !line.includes('total size is') &&
        !line.endsWith('/') // Ignorar directorios
      )
      
      return fileLines.length
    } catch (error) {
      console.error('Error calculando archivos pendientes:', error)
      return -1 // Error
    }
  }
}

export default new ReplicationService()
