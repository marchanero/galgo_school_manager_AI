import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { EventEmitter } from 'events'
import { storage as storageConfig } from '../config.js'

const execPromise = promisify(exec)

// Directorio de grabaciones
const RECORDINGS_DIR = path.join(process.cwd(), 'recordings')

/**
 * StorageManager - Gestión inteligente de almacenamiento
 * 
 * Funcionalidades:
 * - Monitoreo de espacio en disco
 * - Limpieza automática de grabaciones antiguas
 * - Políticas de retención configurables
 * - Alertas cuando el disco está lleno
 */
class StorageManager extends EventEmitter {
  constructor() {
    super()
    
    // Configuración desde config.js o valores por defecto
    this.config = {
      // Umbrales de alerta (porcentaje de uso)
      warningThreshold: storageConfig?.warningThreshold || 75,
      criticalThreshold: storageConfig?.criticalThreshold || 90,
      autoCleanThreshold: storageConfig?.autoCleanThreshold || 85,
      
      // Retención por defecto (días)
      defaultRetentionDays: storageConfig?.defaultRetentionDays || 30,
      
      // Tamaño mínimo libre requerido (GB)
      minFreeSpaceGB: storageConfig?.minFreeSpaceGB || 10,
      
      // Intervalo de verificación (ms)
      checkInterval: (storageConfig?.checkIntervalMinutes || 5) * 60 * 1000,
      
      // Políticas de retención por escenario
      retentionPolicies: new Map()
    }
    
    // Estado actual
    this.status = {
      lastCheck: null,
      diskUsage: null,
      alertLevel: 'normal', // normal, warning, critical
      autoCleanRunning: false,
      lastCleanup: null,
      deletedFiles: 0,
      freedSpace: 0
    }
    
    // Timer de verificación
    this.checkTimer = null
    
    // Crear directorio si no existe
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true })
    }
  }

  /**
   * Inicia el monitoreo automático
   */
  start() {
    console.log('💾 StorageManager iniciado')
    console.log(`   📊 Umbrales: Warning ${this.config.warningThreshold}%, Critical ${this.config.criticalThreshold}%`)
    console.log(`   🧹 Auto-limpieza: ${this.config.autoCleanThreshold}%`)
    console.log(`   📅 Retención por defecto: ${this.config.defaultRetentionDays} días`)
    
    // Verificación inicial
    this.checkDiskSpace()
    
    // Programar verificaciones periódicas
    this.checkTimer = setInterval(() => {
      this.checkDiskSpace()
    }, this.config.checkInterval)
    
    return this
  }

  /**
   * Detiene el monitoreo
   */
  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
    console.log('💾 StorageManager detenido')
  }

  /**
   * Obtiene información del disco donde están las grabaciones
   */
  async getDiskInfo() {
    try {
      // Obtener información del disco usando df
      const { stdout } = await execPromise(`df -B1 "${RECORDINGS_DIR}" | tail -1`)
      const parts = stdout.trim().split(/\s+/)
      
      const totalBytes = parseInt(parts[1])
      const usedBytes = parseInt(parts[2])
      const availableBytes = parseInt(parts[3])
      const usePercent = parseInt(parts[4])
      const mountPoint = parts[5]
      
      // Calcular tamaño de grabaciones
      const recordingsSize = await this.getDirectorySize(RECORDINGS_DIR)
      
      return {
        mountPoint,
        total: totalBytes,
        used: usedBytes,
        available: availableBytes,
        usePercent,
        recordingsSize,
        recordingsSizeFormatted: this.formatBytes(recordingsSize),
        totalFormatted: this.formatBytes(totalBytes),
        usedFormatted: this.formatBytes(usedBytes),
        availableFormatted: this.formatBytes(availableBytes)
      }
    } catch (error) {
      console.error('❌ Error obteniendo info de disco:', error.message)
      return null
    }
  }

  /**
   * Obtiene el tamaño de un directorio recursivamente
   */
  async getDirectorySize(dirPath) {
    try {
      const { stdout } = await execPromise(`du -sb "${dirPath}" 2>/dev/null | cut -f1`)
      return parseInt(stdout.trim()) || 0
    } catch {
      return 0
    }
  }

  /**
   * Verifica el espacio en disco y emite alertas si es necesario
   */
  async checkDiskSpace() {
    const diskInfo = await this.getDiskInfo()
    
    if (!diskInfo) {
      return null
    }
    
    this.status.lastCheck = new Date()
    this.status.diskUsage = diskInfo
    
    // Determinar nivel de alerta
    const previousLevel = this.status.alertLevel
    
    if (diskInfo.usePercent >= this.config.criticalThreshold) {
      this.status.alertLevel = 'critical'
    } else if (diskInfo.usePercent >= this.config.warningThreshold) {
      this.status.alertLevel = 'warning'
    } else {
      this.status.alertLevel = 'normal'
    }
    
    // Emitir evento si cambió el nivel
    if (previousLevel !== this.status.alertLevel) {
      console.log(`⚠️ Cambio de nivel de alerta: ${previousLevel} → ${this.status.alertLevel}`)
      this.emit('alertLevelChanged', {
        previousLevel,
        currentLevel: this.status.alertLevel,
        diskInfo
      })
    }
    
    // Log de estado
    const icon = this.status.alertLevel === 'critical' ? '🔴' : 
                 this.status.alertLevel === 'warning' ? '🟡' : '🟢'
    
    console.log(`${icon} Disco: ${diskInfo.usePercent}% usado | Grabaciones: ${diskInfo.recordingsSizeFormatted} | Libre: ${diskInfo.availableFormatted}`)
    
    // Iniciar limpieza automática si es necesario
    if (diskInfo.usePercent >= this.config.autoCleanThreshold && !this.status.autoCleanRunning) {
      console.log('🧹 Iniciando limpieza automática...')
      this.autoCleanup()
    }
    
    return diskInfo
  }

  /**
   * Obtiene lista de grabaciones con metadatos
   */
  async getRecordingsList() {
    const recordings = []
    
    if (!fs.existsSync(RECORDINGS_DIR)) {
      return recordings
    }
    
    // Recorrer estructura: recordings/{escenario}/{fecha}/camera_{id}/{archivos}
    const scenarios = fs.readdirSync(RECORDINGS_DIR)
    
    for (const scenario of scenarios) {
      const scenarioPath = path.join(RECORDINGS_DIR, scenario)
      if (!fs.statSync(scenarioPath).isDirectory()) continue
      
      const dates = fs.readdirSync(scenarioPath)
      
      for (const date of dates) {
        const datePath = path.join(scenarioPath, date)
        if (!fs.statSync(datePath).isDirectory()) continue
        
        const cameras = fs.readdirSync(datePath)
        
        for (const camera of cameras) {
          const cameraPath = path.join(datePath, camera)
          if (!fs.statSync(cameraPath).isDirectory()) continue
          
          const cameraId = camera.replace('camera_', '')
          const files = fs.readdirSync(cameraPath)
          
          for (const file of files) {
            const filePath = path.join(cameraPath, file)
            const stats = fs.statSync(filePath)
            
            recordings.push({
              scenario,
              date,
              cameraId,
              filename: file,
              filepath: filePath,
              size: stats.size,
              sizeFormatted: this.formatBytes(stats.size),
              created: stats.birthtime,
              modified: stats.mtime,
              ageInDays: Math.floor((Date.now() - stats.birthtime.getTime()) / (1000 * 60 * 60 * 24)),
              type: file.endsWith('.mp4') ? 'video' : file.endsWith('.jsonl') ? 'sensors' : 'other'
            })
          }
        }
      }
    }
    
    // Ordenar por fecha de creación (más antiguas primero)
    recordings.sort((a, b) => a.created - b.created)
    
    return recordings
  }

  /**
   * Limpieza automática basada en políticas de retención
   */
  async autoCleanup() {
    if (this.status.autoCleanRunning) {
      console.log('⚠️ Limpieza ya en progreso')
      return
    }
    
    this.status.autoCleanRunning = true
    this.status.deletedFiles = 0
    this.status.freedSpace = 0
    
    try {
      const recordings = await this.getRecordingsList()
      
      // Filtrar archivos que exceden la retención
      const toDelete = recordings.filter(rec => {
        const retentionDays = this.getRetentionDays(rec.scenario)
        return rec.ageInDays > retentionDays
      })
      
      console.log(`🧹 Encontrados ${toDelete.length} archivos para eliminar por política de retención`)
      
      for (const rec of toDelete) {
        try {
          fs.unlinkSync(rec.filepath)
          this.status.deletedFiles++
          this.status.freedSpace += rec.size
          console.log(`   🗑️ Eliminado: ${rec.filename} (${rec.sizeFormatted}, ${rec.ageInDays} días)`)
        } catch (error) {
          console.error(`   ❌ Error eliminando ${rec.filename}:`, error.message)
        }
      }
      
      // Si aún falta espacio, eliminar los más antiguos
      const diskInfo = await this.getDiskInfo()
      if (diskInfo && diskInfo.usePercent >= this.config.autoCleanThreshold) {
        console.log('⚠️ Aún falta espacio, eliminando archivos más antiguos...')
        await this.emergencyCleanup(diskInfo.usePercent - this.config.warningThreshold)
      }
      
      // Limpiar carpetas vacías
      await this.cleanEmptyDirectories()
      
      this.status.lastCleanup = new Date()
      console.log(`✅ Limpieza completada: ${this.status.deletedFiles} archivos, ${this.formatBytes(this.status.freedSpace)} liberados`)
      
      this.emit('cleanupCompleted', {
        deletedFiles: this.status.deletedFiles,
        freedSpace: this.status.freedSpace,
        freedSpaceFormatted: this.formatBytes(this.status.freedSpace)
      })
      
    } catch (error) {
      console.error('❌ Error en limpieza automática:', error.message)
    } finally {
      this.status.autoCleanRunning = false
    }
  }

  /**
   * Limpieza de emergencia - elimina los archivos más antiguos hasta liberar espacio
   */
  async emergencyCleanup(percentToFree = 10) {
    const diskInfo = await this.getDiskInfo()
    if (!diskInfo) return
    
    const bytesToFree = (diskInfo.total * percentToFree) / 100
    let freedBytes = 0
    
    const recordings = await this.getRecordingsList()
    // Ya están ordenados por fecha (más antiguos primero)
    
    for (const rec of recordings) {
      if (freedBytes >= bytesToFree) break
      
      try {
        fs.unlinkSync(rec.filepath)
        freedBytes += rec.size
        this.status.deletedFiles++
        this.status.freedSpace += rec.size
        console.log(`   🗑️ Emergencia: ${rec.filename} (${rec.sizeFormatted})`)
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`)
      }
    }
    
    console.log(`🆘 Limpieza de emergencia: ${this.formatBytes(freedBytes)} liberados`)
  }

  /**
   * Elimina directorios vacíos
   */
  async cleanEmptyDirectories() {
    const removeEmptyDirs = (dirPath) => {
      if (!fs.existsSync(dirPath)) return
      
      const files = fs.readdirSync(dirPath)
      
      for (const file of files) {
        const fullPath = path.join(dirPath, file)
        if (fs.statSync(fullPath).isDirectory()) {
          removeEmptyDirs(fullPath)
        }
      }
      
      // Verificar si el directorio está vacío ahora
      const remainingFiles = fs.readdirSync(dirPath)
      if (remainingFiles.length === 0 && dirPath !== RECORDINGS_DIR) {
        fs.rmdirSync(dirPath)
        console.log(`   📁 Carpeta vacía eliminada: ${path.basename(dirPath)}`)
      }
    }
    
    removeEmptyDirs(RECORDINGS_DIR)
  }

  /**
   * Obtiene días de retención para un escenario
   */
  getRetentionDays(scenario) {
    return this.config.retentionPolicies.get(scenario) || this.config.defaultRetentionDays
  }

  /**
   * Establece política de retención para un escenario
   */
  setRetentionPolicy(scenario, days) {
    this.config.retentionPolicies.set(scenario, days)
    console.log(`📅 Retención para "${scenario}": ${days} días`)
  }

  /**
   * Actualiza configuración
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig)
    console.log('⚙️ Configuración de StorageManager actualizada')
    return this.config
  }

  /**
   * Obtiene resumen de almacenamiento
   */
  async getSummary() {
    const diskInfo = await this.getDiskInfo()
    const recordings = await this.getRecordingsList()
    
    // Agrupar por escenario
    const byScenario = {}
    for (const rec of recordings) {
      if (!byScenario[rec.scenario]) {
        byScenario[rec.scenario] = {
          count: 0,
          size: 0,
          oldestDate: null,
          newestDate: null,
          retentionDays: this.getRetentionDays(rec.scenario)
        }
      }
      byScenario[rec.scenario].count++
      byScenario[rec.scenario].size += rec.size
      
      if (!byScenario[rec.scenario].oldestDate || rec.created < byScenario[rec.scenario].oldestDate) {
        byScenario[rec.scenario].oldestDate = rec.created
      }
      if (!byScenario[rec.scenario].newestDate || rec.created > byScenario[rec.scenario].newestDate) {
        byScenario[rec.scenario].newestDate = rec.created
      }
    }
    
    // Formatear tamaños
    for (const scenario in byScenario) {
      byScenario[scenario].sizeFormatted = this.formatBytes(byScenario[scenario].size)
    }
    
    // Agrupar por tipo
    const byType = {
      video: { count: 0, size: 0 },
      sensors: { count: 0, size: 0 },
      other: { count: 0, size: 0 }
    }
    
    for (const rec of recordings) {
      byType[rec.type].count++
      byType[rec.type].size += rec.size
    }
    
    for (const type in byType) {
      byType[type].sizeFormatted = this.formatBytes(byType[type].size)
    }
    
    return {
      disk: diskInfo,
      status: this.status,
      config: {
        warningThreshold: this.config.warningThreshold,
        criticalThreshold: this.config.criticalThreshold,
        autoCleanThreshold: this.config.autoCleanThreshold,
        defaultRetentionDays: this.config.defaultRetentionDays,
        minFreeSpaceGB: this.config.minFreeSpaceGB
      },
      recordings: {
        total: recordings.length,
        totalSize: recordings.reduce((sum, r) => sum + r.size, 0),
        totalSizeFormatted: this.formatBytes(recordings.reduce((sum, r) => sum + r.size, 0)),
        byScenario,
        byType
      }
    }
  }

  /**
   * Formatea bytes a unidades legibles
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Elimina grabaciones de un escenario específico
   */
  async deleteScenarioRecordings(scenario, olderThanDays = 0) {
    const recordings = await this.getRecordingsList()
    const toDelete = recordings.filter(rec => 
      rec.scenario === scenario && rec.ageInDays >= olderThanDays
    )
    
    let deletedCount = 0
    let freedSpace = 0
    
    for (const rec of toDelete) {
      try {
        fs.unlinkSync(rec.filepath)
        deletedCount++
        freedSpace += rec.size
      } catch (error) {
        console.error(`Error eliminando ${rec.filename}:`, error.message)
      }
    }
    
    await this.cleanEmptyDirectories()
    
    return {
      deletedCount,
      freedSpace,
      freedSpaceFormatted: this.formatBytes(freedSpace)
    }
  }

  /**
   * Elimina grabaciones de una cámara específica
   */
  async deleteCameraRecordings(cameraId, olderThanDays = 0) {
    const recordings = await this.getRecordingsList()
    const toDelete = recordings.filter(rec => 
      rec.cameraId === String(cameraId) && rec.ageInDays >= olderThanDays
    )
    
    let deletedCount = 0
    let freedSpace = 0
    
    for (const rec of toDelete) {
      try {
        fs.unlinkSync(rec.filepath)
        deletedCount++
        freedSpace += rec.size
      } catch (error) {
        console.error(`Error eliminando ${rec.filename}:`, error.message)
      }
    }
    
    await this.cleanEmptyDirectories()
    
    return {
      deletedCount,
      freedSpace,
      freedSpaceFormatted: this.formatBytes(freedSpace)
    }
  }
}

// Singleton
const storageManager = new StorageManager()

export default storageManager
