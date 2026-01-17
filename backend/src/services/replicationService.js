import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import cron from 'node-cron'
import { replication as replicationConfig } from '../config.js'

// Import adapters
import RcloneAdapter from './replication/rcloneAdapter.js'
import RsyncAdapter, { MountAdapter } from './replication/rsyncAdapter.js'
import MockAdapter from './replication/mockAdapter.js'
import TransferQueue from './replication/transferQueue.js'

const exec = promisify(execCallback)

/**
 * ReplicationService - Servicio coordinador de replicación
 * 
 * Usa patrón Strategy para delegar transferencias a adapters:
 * - RcloneAdapter: Transferencias SFTP con rclone
 * - RsyncAdapter: Transferencias SSH con rsync
 * - MountAdapter: Transferencias a montajes locales
 * - MockAdapter: Simulación para testing
 * 
 * Responsabilidades del coordinador:
 * - Selección de adapter según configuración
 * - Verificación de integridad (SHA256)
 * - Monitoreo de espacio en disco
 * - Configuración y persistencia (Prisma)
 * - Scheduling con cron
 * - Cleanup de archivos antiguos
 * - WebSocket para progreso en tiempo real
 */
class ReplicationService {
  constructor() {
    this.isReplicating = false
    this.prisma = null
    this.io = null
    this.currentProgress = null
    this.cronTask = null
    this.schedule = '0 3 * * *'
    this.enabled = false
    this.retentionDays = 0
    this.deleteAfterExport = false
    this.lastSyncTime = null
    
    // Transfer queue con retry logic
    this.transferQueue = new TransferQueue(replicationConfig)
    
    // Adapters (Strategy pattern)
    this.adapters = {
      rclone: null,
      rsync: null,
      mount: null,
      mock: null
    }
    
    // Adapter activo
    this.currentAdapter = null
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADAPTER SELECTION (Strategy Pattern)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Inicializa adapters según configuración
   */
  initializeAdapters() {
    this.adapters.rclone = new RcloneAdapter(replicationConfig)
    this.adapters.rsync = new RsyncAdapter(replicationConfig)
    this.adapters.mount = new MountAdapter(replicationConfig)
    this.adapters.mock = new MockAdapter(replicationConfig)
  }

  /**
   * Selecciona adapter apropiado según configuración
   */
  selectAdapter() {
    if (replicationConfig.useMock && replicationConfig.destinationType !== 'mount') {
      return this.adapters.mock
    }
    
    if (replicationConfig.destinationType === 'mount') {
      return this.adapters.mount
    }
    
    if (replicationConfig.engine === 'rclone') {
      return this.adapters.rclone
    }
    
    return this.adapters.rsync
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HASH Y VERIFICACIÓN DE INTEGRIDAD
  // ═══════════════════════════════════════════════════════════════════════════

  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      
      stream.on('error', reject)
      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
    })
  }

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
  // MONITOREO DE ESPACIO REMOTO
  // ═══════════════════════════════════════════════════════════════════════════

  async checkRemoteSpace() {
    if (replicationConfig.destinationType === 'mount') {
      return this.checkMountSpace()
    }
    
    if (replicationConfig.useMock || !replicationConfig.host) {
      return this.adapters.mock.getRemoteDiskInfo()
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
  
  async checkMountSpace() {
    const mountPath = replicationConfig.mountPath
    
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

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFERENCIAS (Delegadas a Adapters)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Ejecuta transferencia con retry usando el adapter apropiado
   */
  async transferWithRetry(localPath, remotePath) {
    const adapter = this.selectAdapter()
    
    // Progress callback para WebSocket
    const onProgress = (progressData) => {
      this.currentProgress = progressData
      if (this.io) {
        this.io.emit('replication:progress', progressData)
      }
    }
    
    // Verificar espacio antes de transferir
    const spaceCheck = await this.checkRemoteSpace()
    if (!spaceCheck.canTransfer) {
      throw new Error(`Espacio insuficiente en servidor remoto (${spaceCheck.usePercent}% usado)`)
    }
    
    // Delegar transferencia al adapter con retry
    const result = await this.transferQueue.executeWithRetry(
      adapter,
      localPath,
      remotePath,
      onProgress
    )
    
    // Verificar integridad si está habilitado
    if (replicationConfig.verifyHash && fs.statSync(localPath).isFile()) {
      const fileName = path.basename(localPath)
      const fullRemotePath = path.join(remotePath, fileName)
      const verification = await this.verifyFileIntegrity(localPath, fullRemotePath)
      
      if (!verification.verified) {
        throw new Error(`Verificación de hash falló: ${verification.error}`)
      }
      console.log(`✅ Verificación SHA256 correcta para ${fileName}`)
    }
    
    return result
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INICIALIZACIÓN Y CONFIGURACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async init(prisma, io = null) {
    this.prisma = prisma
    this.io = io
    
    // Inicializar adapters
    this.initializeAdapters()
    
    await this.loadConfig()
    this.setupCron()
    
    // Configurar rclone remote si está habilitado
    if (replicationConfig.enabled && replicationConfig.engine === 'rclone' && !replicationConfig.useMock) {
      await this.adapters.rclone.setupRemote()
    }
  }

  async loadConfig() {
    try {
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
        console.log(`📅 Configuración de replicación cargada`)
      } else {
        await this.saveConfig(this.schedule, this.enabled, this.retentionDays, this.deleteAfterExport)
      }

      const serverConfig = await this.prisma.systemConfig.findUnique({
        where: { key: 'replication_server' }
      })

      if (serverConfig) {
        const savedConfig = JSON.parse(serverConfig.value)
        Object.assign(replicationConfig, savedConfig)
        console.log(`🖥️ Configuración de servidor cargada: ${replicationConfig.useMock ? 'Mock' : replicationConfig.host}`)
      } else {
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

      Object.assign(replicationConfig, serverSettings)
      console.log(`💾 Configuración de servidor guardada`)
      
      // Reinitializar adapters con nueva config
      this.initializeAdapters()
      
      // Reconfigurar rclone si es necesario
      if (!serverSettings.useMock && serverSettings.engine === 'rclone' && serverSettings.host) {
        await this.adapters.rclone.setupRemote()
      }

      return true
    } catch (error) {
      console.error('Error guardando configuración de servidor:', error)
      return false
    }
  }

  getServerConfig() {
    return {
      useMock: replicationConfig.useMock,
      engine: replicationConfig.engine,
      host: replicationConfig.host,
      port: replicationConfig.port,
      user: replicationConfig.user,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // REPLICACIÓN PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════

  async replicate(options = {}) {
    if (this.isReplicating && !options.force) {
      console.log('⚠️ Replicación ya en curso')
      return { success: false, message: 'Replicación en curso' }
    }

    const isMount = replicationConfig.destinationType === 'mount'
    
    if (!isMount && !replicationConfig.host && !replicationConfig.useMock) {
      console.log('⚠️ Replicación no configurada')
      return { success: false, message: 'Faltan credenciales de replicación' }
    }
    
    if (isMount && !fs.existsSync(replicationConfig.mountPath)) {
      console.log(`⚠️ Punto de montaje no disponible: ${replicationConfig.mountPath}`)
      return { success: false, message: `Montaje no disponible` }
    }

    this.isReplicating = true
    const adapter = this.selectAdapter()
    console.log(`🔄 Iniciando replicación con ${adapter.getName()}...`)

    try {
      const remotePath = isMount ? 'recordings' : replicationConfig.remotePath
      const localPath = path.join(process.cwd(), 'recordings')
      
      // Verificar espacio
      const spaceCheck = await this.checkRemoteSpace()
      if (!spaceCheck.available) {
        throw new Error(`No se puede conectar al servidor remoto: ${spaceCheck.error}`)
      }
      if (spaceCheck.isCritical) {
        throw new Error(`Espacio crítico (${spaceCheck.usePercent}% usado)`)
      }
      
      console.log(`📊 Espacio remoto: ${spaceCheck.freeGB}GB libres (${spaceCheck.usePercent}% usado)`)

      // Callback de progreso
      const onProgress = (progressData) => {
        this.currentProgress = progressData
        if (this.io) {
          this.io.emit('replication:progress', progressData)
        }
      }

      // Ejecutar transferencia con el adapter
      await adapter.transfer(localPath, remotePath, onProgress)

      // Notificar completado
      if (this.io) {
        this.io.emit('replication:complete', { success: true })
      }

      console.log('✅ Replicación completada exitosamente')
      await this.updateLastSyncTime()
      
      return { success: true, message: 'Replicación completada', adapter: adapter.getName() }

    } catch (error) {
      console.error(`❌ Error en replicación: ${error.message}`)
      
      if (this.io) {
        this.io.emit('replication:error', { error: error.message })
      }
      
      return { success: false, message: error.message }
    } finally {
      this.isReplicating = false
      this.currentProgress = null
    }
  }

  async replicateFile(localFilePath, options = {}) {
    const adapter = this.selectAdapter()
    const remotePath = options.remotePath || replicationConfig.remotePath
    
    return this.transferWithRetry(localFilePath, remotePath)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS Y ESTADÍSTICAS
  // ═══════════════════════════════════════════════════════════════════════════

  async getStatus() {
    const adapter = this.selectAdapter()
    const spaceInfo = await this.checkRemoteSpace()
    const serverConfig = this.getServerConfig()
    const pendingFiles = await this.getPendingFilesCount()
    const localDiskInfo = await this.getLocalDiskInfo()

    return {
      enabled: this.enabled,
      isReplicating: this.isReplicating,
      schedule: this.schedule,
      lastSyncTime: this.lastSyncTime,
      currentProgress: this.currentProgress,
      adapter: adapter.getName(),
      // Fields at root level for frontend compatibility
      engine: serverConfig.engine,
      useMock: serverConfig.useMock,
      remoteDiskInfo: spaceInfo,
      localDiskInfo: localDiskInfo,
      localSizeFormatted: this.formatBytes(localDiskInfo.used || 0),
      remoteStatus: spaceInfo.available ? 'online' : 'offline',
      pendingFiles: pendingFiles,
      localFiles: pendingFiles, // For now assuming all files are pending + synced (simple approximation)
      config: serverConfig,
      stats: this.transferQueue.getStats(),
      space: spaceInfo
    }
  }

  async testConnection() {
    try {
      const spaceCheck = await this.checkRemoteSpace()
      
      if (!spaceCheck.available) {
        return {
          success: false,
          message: `Error de conexión: ${spaceCheck.error}`,
          details: spaceCheck
        }
      }

      return {
        success: true,
        message: 'Conexión exitosa',
        spaceInfo: spaceCheck
      }
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`,
        error: error.message
      }
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Obtiene estadísticas de replicación
   */
  async getStats() {
    return {
      totalTransferred: this.transferQueue?.totalTransferred || 0,
      successCount: this.transferQueue?.successCount || 0,
      failCount: this.transferQueue?.failedCount || 0,
      lastError: this.transferQueue?.lastError || null,
      queueLength: this.transferQueue?.queueLength || 0,
      isProcessing: this.isReplicating
    }
  }

  /**
   * Obtiene información del disco local
   */
  async getLocalDiskInfo() {
    try {
      const { execSync } = await import('child_process')
      const path = await import('path')
      
      // Use logical recordings path used by recordingManager
      const localPath = process.env.RECORDINGS_PATH || path.default.join(process.cwd(), 'recordings')
      
      // Ensure directory exists for df
      if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true })
      }
      
      // df -B1 para obtener bytes exactos
      // Fallback to / if path fails (unlikely if mkdir works)
      const result = execSync(`df -B1 "${localPath}" 2>/dev/null || df -B1 / 2>/dev/null || echo "0 0 0 0%"`, { encoding: 'utf-8' })
      const lines = result.trim().split('\n')
      const lastLine = lines[lines.length - 1]
      const parts = lastLine.split(/\s+/)
      
      if (parts.length >= 5) {
        const total = parseInt(parts[1]) || 0
        const used = parseInt(parts[2]) || 0
        const free = parseInt(parts[3]) || 0
        const usePercent = parseInt(parts[4]) || 0
        
        return {
          available: true,
          path: localPath,
          total,
          used,
          free,
          usePercent,
          totalGB: Math.round(total / (1024 ** 3)),
          usedGB: Math.round(used / (1024 ** 3)),
          freeGB: Math.round(free / (1024 ** 3))
        }
      }
      
      return { available: false, error: 'No se pudo obtener información del disco' }
    } catch (error) {
      console.error('Error obteniendo info del disco local:', error.message)
      return { available: false, error: error.message }
    }
  }

  /**
   * Obtiene información del disco remoto (mount o adapter)
   */
  async getRemoteDiskInfo() {
    try {
      // Primero verificar si hay mount disponible
      const spaceInfo = await this.checkMountSpace()
      if (spaceInfo && spaceInfo.available) {
        return spaceInfo
      }
      
      // Si no hay mount, intentar con el adapter
      if (this.currentAdapter && typeof this.currentAdapter.getRemoteSpace === 'function') {
        return await this.currentAdapter.getRemoteSpace()
      }
      
      return { available: false, message: 'No hay mount ni adapter configurado' }
    } catch (error) {
      console.error('Error obteniendo info del disco remoto:', error.message)
      return { available: false, error: error.message }
    }
  }

  /**
   * Cuenta archivos pendientes de sincronizar
   */
  async getPendingFilesCount() {
    try {
      const path = await import('path')
      const localPath = process.env.RECORDINGS_PATH || path.default.join(process.cwd(), 'recordings')
      const { execSync } = await import('child_process')
      
      if (!fs.existsSync(localPath)) return 0
      
      // Contar archivos de video en el directorio local
      const result = execSync(
        `find "${localPath}" -type f \\( -name "*.mp4" -o -name "*.mkv" -o -name "*.avi" \\) 2>/dev/null | wc -l`,
        { encoding: 'utf-8' }
      )
      
      return parseInt(result.trim()) || 0
    } catch (error) {
      console.error('Error contando archivos pendientes:', error.message)
      return 0
    }
  }
}

// Singleton
const replicationService = new ReplicationService()

export default replicationService
