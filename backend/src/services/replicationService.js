import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import cron from 'node-cron'
import config from '../config.js'

class ReplicationService {
  constructor() {
    this.isReplicating = false
    this.queue = []
    this.prisma = null
    this.cronTask = null
    this.schedule = '0 3 * * *' // Default: 3:00 AM
    this.enabled = false
    this.retentionDays = 0 // 0 = no borrar nunca
    this.deleteAfterExport = false
    this.lastSyncTime = null
  }

  async init(prisma) {
    this.prisma = prisma
    await this.loadConfig()
    this.setupCron()
  }

  async loadConfig() {
    try {
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: 'replication_schedule' }
      })

      if (config) {
        const { schedule, enabled, retentionDays, deleteAfterExport, lastSyncTime } = JSON.parse(config.value)
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
    } catch (error) {
      console.error('Error cargando configuración de replicación:', error)
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
   * Inicia la replicación de grabaciones al servidor remoto usando rsync
   * @param {Object} options - Opciones de replicación
   * @param {boolean} options.force - Forzar replicación aunque haya una en curso
   */
  async replicate(options = {}) {
    if (this.isReplicating && !options.force) {
      console.log('⚠️ Replicación ya en curso, omitiendo...')
      return { success: false, message: 'Replicación en curso' }
    }

    // Verificar si está habilitado en config.js (nivel sistema)
    // La habilitación en DB es para el scheduler, pero config.js manda si no hay credenciales
    if (!config.replication.host) {
      console.log('⚠️ Replicación no configurada (faltan credenciales)')
      return { success: false, message: 'Faltan credenciales de replicación' }
    }

    this.isReplicating = true
    console.log('🔄 Iniciando replicación de videos...')

    try {
      const { host, user, remotePath, sshKeyPath } = config.replication
      const localPath = path.join(process.cwd(), 'recordings') + '/' // Trailing slash importante para rsync

      // Construir comando rsync
      // -a: archive mode (preserva permisos, tiempos, etc)
      // -v: verbose
      // -z: compress
      // --delete: elimina archivos en destino que no existen en origen (opcional, configurable)
      // -e: especifica shell remoto (ssh)
      
      const rsyncArgs = [
        '-avz',
        // '--progress', // Comentado para no llenar logs en cron
        localPath,
        `${user}@${host}:${remotePath}`
      ]

      if (sshKeyPath) {
        rsyncArgs.push('-e', `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no`)
      }

      console.log('🚀 Ejecutando rsync:', 'rsync', rsyncArgs.join(' '))

      await new Promise((resolve, reject) => {
        const rsync = spawn('rsync', rsyncArgs)

        rsync.stdout.on('data', (data) => {
          // Solo loguear si no es progreso
          const output = data.toString().trim()
          if (!output.includes('%')) {
             console.log(`[rsync] ${output}`)
          }
        })

        rsync.stderr.on('data', (data) => {
          console.error(`[rsync error] ${data.toString().trim()}`)
        })

        rsync.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`rsync terminó con código ${code}`))
          }
        })
      })

      console.log('✅ Replicación completada exitosamente')
      await this.updateLastSyncTime()

      // Limpieza de archivos antiguos si está habilitado
      if (this.deleteAfterExport && this.retentionDays > 0) {
        await this.cleanupOldFiles(localPath)
      }

      this.isReplicating = false
      return { success: true, message: 'Replicación completada' }

    } catch (error) {
      console.error('❌ Error en replicación:', error)
      this.isReplicating = false
      return { success: false, error: error.message }
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
    // Verificar si está configurado
    if (!config.replication.host) {
      // Devolver datos dummy cuando no está configurado
      return {
        available: true,
        filesystem: '/dev/sdb1',
        mountPoint: '/mnt/remote-backups',
        totalGB: 500,
        usedGB: 175,
        availableGB: 325,
        usePercent: 35,
        lastChecked: new Date().toISOString(),
        isDummy: true
      }
    }

    try {
      const { host, user, remotePath, sshKeyPath } = config.replication

      // Ejecutar comando SSH para obtener información del disco
      const sshArgs = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=10'
      ]

      if (sshKeyPath) {
        sshArgs.push('-i', sshKeyPath)
      }

      sshArgs.push(`${user}@${host}`, `df -BG ${remotePath} | tail -1`)

      console.log('🔍 Consultando espacio en disco remoto:', `ssh ${sshArgs.join(' ')}`)

      const output = await new Promise((resolve, reject) => {
        const ssh = spawn('ssh', sshArgs)
        let stdout = ''
        let stderr = ''

        ssh.stdout.on('data', (data) => { stdout += data.toString() })
        ssh.stderr.on('data', (data) => { stderr += data.toString() })

        ssh.on('close', (code) => {
          if (code === 0) {
            resolve(stdout.trim())
          } else {
            reject(new Error(`SSH failed with code ${code}: ${stderr}`))
          }
        })

        ssh.on('error', (error) => {
          reject(error)
        })
      })

      // Parsear la salida de df
      // Formato típico: /dev/sda1     50G    25G    23G    53% /mnt/videos
      const parts = output.split(/\s+/).filter(part => part.trim() !== '')

      if (parts.length < 6) {
        throw new Error('Formato de salida df inesperado')
      }

      const totalGB = parseInt(parts[1].replace('G', ''))
      const usedGB = parseInt(parts[2].replace('G', ''))
      const availableGB = parseInt(parts[3].replace('G', ''))
      const usePercent = parseInt(parts[4].replace('%', ''))

      return {
        available: true,
        filesystem: parts[0],
        mountPoint: parts[5],
        totalGB,
        usedGB,
        availableGB,
        usePercent,
        lastChecked: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Error obteniendo información del disco remoto:', error)
      return {
        available: false,
        error: error.message
      }
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
    if (!config.replication.host) return 0
    
    try {
      const { host, user, remotePath, sshKeyPath } = config.replication
      const localPath = path.join(process.cwd(), 'recordings') + '/'

      const rsyncArgs = [
        '-avn', // -n = dry-run
        localPath,
        `${user}@${host}:${remotePath}`
      ]

      if (sshKeyPath) {
        rsyncArgs.push('-e', `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no`)
      }

      let output = ''
      await new Promise((resolve, reject) => {
        const rsync = spawn('rsync', rsyncArgs)
        rsync.stdout.on('data', (data) => { output += data.toString() })
        rsync.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error('rsync failed'))
        })
      })

      // Contar líneas que parecen archivos (no directorios ni mensajes de rsync)
      // rsync dry-run lista los archivos que se transferirían
      const lines = output.split('\n')
      // Filtrar líneas vacías y headers/footers de rsync
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
