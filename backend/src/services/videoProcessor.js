import { EventEmitter } from 'events'
import path from 'path'
import ThumbnailService from './video/thumbnailService.js'
import CompressionService from './video/compressionService.js'
import ClipService from './video/clipService.js'
import SegmentService from './video/segmentService.js'

// Directorios
const THUMBNAILS_DIR = path.join(process.cwd(), 'thumbnails')
const CLIPS_DIR = path.join(process.cwd(), 'clips')
const COMPRESSED_DIR = path.join(process.cwd(), 'compressed')

/**
 * VideoProcessor - Coordinador de procesamiento de video
 * 
 * Delega operaciones a servicios especializados:
 * - ThumbnailService: Generación de thumbnails
 * - CompressionService: Compresión de videos
 * - ClipService: Extracción de clips
 * - SegmentService: Combinación de segmentos
 * 
 * Responsabilidades del coordinador:
 * - Cola de procesamiento con prioridades
 * - EventEmitter para progreso en tiempo real
 * - Estadísticas agregadas
 */
class VideoProcessor extends EventEmitter {
  constructor() {
    super()
    
    // Cola de tareas
    this.queue = []
    this.processing = false
    this.currentTask = null
    
    // Estadísticas agregadas
    this.stats = {
      thumbnailsGenerated: 0,
      videosCompressed: 0,
      clipsExtracted: 0,
      totalSpaceSaved: 0,
      tasksCompleted: 0,
      tasksFailed: 0
    }
    
    // Configuración global
    this.config = {
      // Thumbnails
      thumbnailWidth: 320,
      thumbnailHeight: 180,
      thumbnailFormat: 'jpg',
      thumbnailQuality: 80,
      
      // Compresión
      compressionCrf: 28,
      compressionPreset: 'medium',
      compressOlderThanDays: 7,
      deleteOriginalAfterCompress: false,
      
      // Clips
      defaultClipDuration: 30,
      clipFormat: 'mp4',
      
      // Cola
      maxConcurrentTasks: 1,
      autoProcessThumbnails: true,
      
      // FFmpeg
      ffmpegPath: 'ffmpeg',
      ffprobePath: 'ffprobe'
    }
    
    // Inicializar servicios especializados
    this.thumbnailService = new ThumbnailService(this.config)
    this.compressionService = new CompressionService(this.config, this.getVideoInfo.bind(this))
    this.clipService = new ClipService(this.config, this.getVideoInfo.bind(this))
    this.segmentService = new SegmentService(this.config, this.getVideoInfo.bind(this))
  }

  /**
   * Obtiene información de un video usando ffprobe
   * (Delegado a ThumbnailService)
   */
  async getVideoInfo(videoPath) {
    return this.thumbnailService.getVideoInfo(videoPath)
  }

  /**
   * Genera thumbnail de un video
   * (Delegado a ThumbnailService)
   */
  async generateThumbnail(videoPath, options = {}) {
    const result = await this.thumbnailService.generateThumbnail(videoPath, options)
    this.stats.thumbnailsGenerated++
    return result
  }

  /**
   * Genera thumbnails para directorio
   * (Delegado a ThumbnailService)
   */
  async generateThumbnailsForDirectory(dirPath, options = {}) {
    return this.thumbnailService.generateThumbnailsForDirectory(dirPath, options)
  }

  /**
   * Comprime un video
   * (Delegado a CompressionService)
   */
  async compressVideo(videoPath, options = {}) {
    const onProgress = (data) => {
      this.emit('compressionProgress', data)
    }
    
    const result = await this.compressionService.compressVideo(videoPath, options, onProgress)
    this.stats.videosCompressed++
    this.stats.totalSpaceSaved += result.spaceSaved
    return result
  }

  /**
   * Comprime videos antiguos
   * (Delegado a CompressionService)
   */
  async compressOldVideos(options = {}) {
    return this.compressionService.compressOldVideos(options)
  }

  /**
   * Extrae un clip de video
   * (Delegado a ClipService)
   */
  async extractClip(videoPath, options = {}) {
    const result = await this.clipService.extractClip(videoPath, options)
    this.stats.clipsExtracted++
    return result
  }

  /**
   * Combina segmentos de video
   * (Delegado a SegmentService)
   */
  async combineSegments(segmentPaths, outputPath, options = {}) {
    return this.segmentService.combineSegments(segmentPaths, outputPath, options)
  }

  /**
   * Aplica faststart a un video
   * (Delegado a SegmentService)
   */
  async applyFaststart(inputPath, outputPath = null) {
    return this.segmentService.applyFaststart(inputPath, outputPath)
  }

  /**
   * Combina sesión de grabación
   * (Delegado a SegmentService)
   */
  async combineRecordingSession(recordingDir, options = {}) {
    return this.segmentService.combineRecordingSession(recordingDir, options)
  }

  /**
   * Añade tarea a la cola
   */
  addToQueue(task) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const queuedTask = {
      id: taskId,
      ...task,
      status: 'queued',
      createdAt: new Date(),
      progress: 0
    }
    
    this.queue.push(queuedTask)
    this.emit('taskQueued', queuedTask)
    
    // Iniciar procesamiento si no está activo
    if (!this.processing) {
      this.processQueue()
    }
    
    return taskId
  }

  /**
   * Procesa la cola de tareas
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      const task = this.queue.shift()
      this.currentTask = task
      task.status = 'processing'
      task.startedAt = new Date()
      
      this.emit('taskStarted', task)
      
      try {
        let result
        
        switch (task.type) {
          case 'thumbnail':
            result = await this.generateThumbnail(task.videoPath, task.options)
            break
          case 'compress':
            result = await this.compressVideo(task.videoPath, task.options)
            break
          case 'clip':
            result = await this.extractClip(task.videoPath, task.options)
            break
          default:
            throw new Error(`Unknown task type: ${task.type}`)
        }
        
        task.status = 'completed'
        task.completedAt = new Date()
        task.result = result
        this.stats.tasksCompleted++
        
        this.emit('taskCompleted', task)
        
      } catch (error) {
        console.error(`❌ Task ${task.type} failed for ${task.videoPath}:`, error.message)
        task.status = 'failed'
        task.completedAt = new Date()
        task.error = error.message
        this.stats.tasksFailed++
        
        this.emit('taskFailed', task)
      }
      
      this.currentTask = null
    }
    
    this.processing = false
  }

  /**
   * Obtiene estado de la cola
   */
  getQueueStatus() {
    return {
      processing: this.processing,
      currentTask: this.currentTask,
      queueLength: this.queue.length,
      queue: this.queue,
      stats: this.stats
    }
  }

  /**
   * Cancela una tarea
   */
  cancelTask(taskId) {
    const queueIndex = this.queue.findIndex(t => t.id === taskId)
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1)
      return { success: true, message: 'Task removed from queue' }
    }
    
    return { success: false, message: 'Task not found' }
  }

  /**
   * Obtiene lista de thumbnails
   * (Delegado a ThumbnailService)
   */
  getThumbnails() {
    return this.thumbnailService.getThumbnails()
  }

  /**
   * Obtiene lista de clips
   * (Delegado a ClipService)
   */
  getClips() {
    return this.clipService.getClips()
  }

  /**
   * Actualiza configuración
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig)
    
    // Propagar configuración a servicios
    this.thumbnailService.updateConfig(newConfig)
    this.compressionService.updateConfig(newConfig)
    this.clipService.updateConfig(newConfig)
    this.segmentService.updateConfig(newConfig)
    
    console.log('⚙️ Configuración de VideoProcessor actualizada')
  }

  /**
   * Convierte tiempo a segundos
   * (Delegado a ClipService)
   */
  timeToSeconds(time) {
    return this.clipService.timeToSeconds(time)
  }

  /**
   * Extrae timestamp de filename
   * (Delegado a SegmentService)
   */
  extractTimestampFromFilename(filename) {
    return this.segmentService.extractTimestampFromFilename(filename)
  }

  /**
   * Formatea bytes
   * (Delegado a CompressionService)
   */
  formatBytes(bytes) {
    return this.compressionService.formatBytes(bytes)
  }
}

// Singleton
const videoProcessor = new VideoProcessor()

export default videoProcessor
