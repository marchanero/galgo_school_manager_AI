import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'

// Directorios
const RECORDINGS_DIR = path.join(process.cwd(), 'recordings')
const THUMBNAILS_DIR = path.join(process.cwd(), 'thumbnails')
const CLIPS_DIR = path.join(process.cwd(), 'clips')
const COMPRESSED_DIR = path.join(process.cwd(), 'compressed')

/**
 * VideoProcessor - Servicio de post-procesamiento de video
 * 
 * Características:
 * - Generación de thumbnails para grabaciones
 * - Compresión de videos antiguos para ahorro de espacio
 * - Extracción de clips específicos
 * - Cola de procesamiento con prioridades
 * - Progreso de tareas en tiempo real
 */
class VideoProcessor extends EventEmitter {
  constructor() {
    super()
    
    // Cola de tareas
    this.queue = []
    this.processing = false
    this.currentTask = null
    
    // Procesos activos
    this.activeProcesses = new Map()
    
    // Estadísticas
    this.stats = {
      thumbnailsGenerated: 0,
      videosCompressed: 0,
      clipsExtracted: 0,
      totalSpaceSaved: 0,
      tasksCompleted: 0,
      tasksFailed: 0
    }
    
    // Configuración
    this.config = {
      // Thumbnails
      thumbnailWidth: 320,
      thumbnailHeight: 180,
      thumbnailFormat: 'jpg',
      thumbnailQuality: 80,
      
      // Compresión
      compressionCrf: 28,           // 0-51, menor = mejor calidad
      compressionPreset: 'medium',  // ultrafast, fast, medium, slow
      compressOlderThanDays: 7,     // Comprimir videos de más de X días
      deleteOriginalAfterCompress: false,
      
      // Clips
      defaultClipDuration: 30,      // segundos
      clipFormat: 'mp4',
      
      // Cola
      maxConcurrentTasks: 1,
      autoProcessThumbnails: true,
      
      // FFmpeg
      ffmpegPath: 'ffmpeg',
      ffprobePath: 'ffprobe'
    }
    
    // Crear directorios
    this.ensureDirectories()
  }

  /**
   * Asegura que existan los directorios necesarios
   */
  ensureDirectories() {
    const dirs = [THUMBNAILS_DIR, CLIPS_DIR, COMPRESSED_DIR]
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
  }

  /**
   * Obtiene información de un video usando ffprobe
   */
  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ]
      
      const process = spawn(this.config.ffprobePath, args)
      let output = ''
      let error = ''
      
      process.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      process.stderr.on('data', (data) => {
        error += data.toString()
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(output)
            const videoStream = info.streams?.find(s => s.codec_type === 'video')
            
            resolve({
              duration: parseFloat(info.format?.duration || 0),
              size: parseInt(info.format?.size || 0),
              bitrate: parseInt(info.format?.bit_rate || 0),
              width: videoStream?.width || 0,
              height: videoStream?.height || 0,
              codec: videoStream?.codec_name || 'unknown',
              fps: eval(videoStream?.r_frame_rate || '0')
            })
          } catch (e) {
            reject(new Error(`Error parsing video info: ${e.message}`))
          }
        } else {
          reject(new Error(`ffprobe failed: ${error}`))
        }
      })
    })
  }

  /**
   * Genera thumbnail de un video
   */
  async generateThumbnail(videoPath, options = {}) {
    const {
      outputPath,
      timestamp = '00:00:01', // 1 segundo por defecto (más seguro para videos cortos)
      width = this.config.thumbnailWidth,
      height = this.config.thumbnailHeight
    } = options
    
    // Verificar que el video existe
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video no encontrado: ${videoPath}`)
    }
    
    // Determinar ruta de salida
    const videoName = path.basename(videoPath, path.extname(videoPath))
    const thumbPath = outputPath || path.join(
      THUMBNAILS_DIR,
      `${videoName}_thumb.${this.config.thumbnailFormat}`
    )
    
    console.log(`📸 Generando thumbnail: ${videoPath} -> ${thumbPath}`)
    
    // Asegurar directorio
    const thumbDir = path.dirname(thumbPath)
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true })
    }
    
    return new Promise((resolve, reject) => {
      // -ss antes de -i para seek rápido (input seeking)
      const args = [
        '-ss', timestamp,
        '-i', videoPath,
        '-vframes', '1',
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        '-q:v', Math.round((100 - this.config.thumbnailQuality) / 3).toString(),
        '-y',
        thumbPath
      ]
      
      const ffmpegProcess = spawn(this.config.ffmpegPath, args)
      let stderrOutput = ''
      
      ffmpegProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString()
      })
      
      ffmpegProcess.on('error', (error) => {
        console.error(`❌ FFmpeg spawn error: ${error.message}`)
        reject(new Error(`FFmpeg error: ${error.message}`))
      })
      
      ffmpegProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(thumbPath)) {
          console.log(`✅ Thumbnail generado: ${thumbPath}`)
          this.stats.thumbnailsGenerated++
          resolve({
            success: true,
            path: thumbPath,
            relativePath: path.relative(process.cwd(), thumbPath)
          })
        } else {
          const errorMsg = stderrOutput.split('\n').slice(-5).join('\n')
          console.error(`❌ Thumbnail generation failed (code ${code}): ${errorMsg}`)
          reject(new Error(`Thumbnail generation failed with code ${code}: ${errorMsg}`))
        }
      })
    })
  }

  /**
   * Genera thumbnails para todos los videos de un directorio
   */
  async generateThumbnailsForDirectory(dirPath, options = {}) {
    const { recursive = true, force = false } = options
    const results = []
    
    const processDir = async (currentDir) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        
        if (entry.isDirectory() && recursive) {
          await processDir(fullPath)
        } else if (entry.isFile() && /\.(mp4|mkv|avi|mov)$/i.test(entry.name)) {
          // Verificar si ya existe thumbnail
          const thumbName = `${path.basename(entry.name, path.extname(entry.name))}_thumb.${this.config.thumbnailFormat}`
          const thumbPath = path.join(THUMBNAILS_DIR, thumbName)
          
          if (!force && fs.existsSync(thumbPath)) {
            results.push({ video: fullPath, skipped: true, reason: 'exists' })
            continue
          }
          
          try {
            const result = await this.generateThumbnail(fullPath)
            results.push({ video: fullPath, ...result })
          } catch (error) {
            results.push({ video: fullPath, success: false, error: error.message })
          }
        }
      }
    }
    
    await processDir(dirPath)
    return results
  }

  /**
   * Comprime un video para reducir tamaño
   */
  async compressVideo(videoPath, options = {}) {
    const {
      crf = this.config.compressionCrf,
      preset = this.config.compressionPreset,
      deleteOriginal = this.config.deleteOriginalAfterCompress
    } = options
    
    // Obtener info original
    const originalInfo = await this.getVideoInfo(videoPath)
    
    // Ruta de salida
    const videoName = path.basename(videoPath, path.extname(videoPath))
    const compressedPath = path.join(COMPRESSED_DIR, `${videoName}_compressed.mp4`)
    
    // Asegurar directorio
    if (!fs.existsSync(COMPRESSED_DIR)) {
      fs.mkdirSync(COMPRESSED_DIR, { recursive: true })
    }
    
    const taskId = `compress_${Date.now()}`
    
    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-c:v', 'libx264',
        '-crf', crf.toString(),
        '-preset', preset,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        compressedPath
      ]
      
      const process = spawn(this.config.ffmpegPath, args)
      this.activeProcesses.set(taskId, { process, type: 'compress', videoPath })
      
      let lastProgress = 0
      
      process.stderr.on('data', (data) => {
        const output = data.toString()
        
        // Extraer progreso
        const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.\d+)/)
        if (timeMatch && originalInfo.duration > 0) {
          const hours = parseInt(timeMatch[1])
          const minutes = parseInt(timeMatch[2])
          const seconds = parseFloat(timeMatch[3])
          const currentTime = hours * 3600 + minutes * 60 + seconds
          const progress = Math.min(100, (currentTime / originalInfo.duration) * 100)
          
          if (progress - lastProgress >= 5) {
            lastProgress = progress
            this.emit('compressionProgress', {
              taskId,
              videoPath,
              progress: Math.round(progress)
            })
          }
        }
      })
      
      process.on('error', (error) => {
        this.activeProcesses.delete(taskId)
        reject(new Error(`Compression error: ${error.message}`))
      })
      
      process.on('close', async (code) => {
        this.activeProcesses.delete(taskId)
        
        if (code === 0 && fs.existsSync(compressedPath)) {
          try {
            const compressedInfo = await this.getVideoInfo(compressedPath)
            const spaceSaved = originalInfo.size - compressedInfo.size
            const compressionRatio = ((spaceSaved / originalInfo.size) * 100).toFixed(1)
            
            this.stats.videosCompressed++
            this.stats.totalSpaceSaved += spaceSaved
            
            // Eliminar original si está configurado
            if (deleteOriginal && spaceSaved > 0) {
              fs.unlinkSync(videoPath)
            }
            
            resolve({
              success: true,
              originalPath: videoPath,
              compressedPath,
              originalSize: originalInfo.size,
              compressedSize: compressedInfo.size,
              spaceSaved,
              spaceSavedFormatted: this.formatBytes(spaceSaved),
              compressionRatio: `${compressionRatio}%`,
              originalDeleted: deleteOriginal && spaceSaved > 0
            })
          } catch (error) {
            reject(new Error(`Error getting compressed video info: ${error.message}`))
          }
        } else {
          // Limpiar archivo parcial
          if (fs.existsSync(compressedPath)) {
            fs.unlinkSync(compressedPath)
          }
          reject(new Error(`Compression failed with code ${code}`))
        }
      })
    })
  }

  /**
   * Extrae un clip de un video
   */
  async extractClip(videoPath, options = {}) {
    const {
      startTime,           // Formato: "HH:MM:SS" o segundos
      endTime,             // Formato: "HH:MM:SS" o segundos
      duration,            // Alternativa a endTime, en segundos
      outputName,
      reencode = false     // Por defecto, solo corta sin recodificar
    } = options
    
    if (!startTime) {
      throw new Error('startTime es requerido')
    }
    
    // Calcular duración si no se proporciona
    let clipDuration = duration
    if (!clipDuration && endTime) {
      const startSec = this.timeToSeconds(startTime)
      const endSec = this.timeToSeconds(endTime)
      clipDuration = endSec - startSec
    }
    clipDuration = clipDuration || this.config.defaultClipDuration
    
    // Nombre del clip
    const videoName = path.basename(videoPath, path.extname(videoPath))
    const startStr = typeof startTime === 'number' ? startTime : startTime.replace(/:/g, '-')
    const clipName = outputName || `${videoName}_clip_${startStr}_${clipDuration}s.${this.config.clipFormat}`
    const clipPath = path.join(CLIPS_DIR, clipName)
    
    const taskId = `clip_${Date.now()}`
    
    return new Promise((resolve, reject) => {
      let args
      
      if (reencode) {
        // Con recodificación (más lento pero preciso)
        args = [
          '-ss', startTime.toString(),
          '-i', videoPath,
          '-t', clipDuration.toString(),
          '-c:v', 'libx264',
          '-crf', '23',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          '-y',
          clipPath
        ]
      } else {
        // Sin recodificación (rápido, puede tener imprecisión de ~1s)
        args = [
          '-ss', startTime.toString(),
          '-i', videoPath,
          '-t', clipDuration.toString(),
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
          '-y',
          clipPath
        ]
      }
      
      const process = spawn(this.config.ffmpegPath, args)
      this.activeProcesses.set(taskId, { process, type: 'clip', videoPath })
      
      process.on('error', (error) => {
        this.activeProcesses.delete(taskId)
        reject(new Error(`Clip extraction error: ${error.message}`))
      })
      
      process.on('close', async (code) => {
        this.activeProcesses.delete(taskId)
        
        if (code === 0 && fs.existsSync(clipPath)) {
          try {
            const clipInfo = await this.getVideoInfo(clipPath)
            this.stats.clipsExtracted++
            
            resolve({
              success: true,
              clipPath,
              relativePath: path.relative(process.cwd(), clipPath),
              duration: clipInfo.duration,
              size: clipInfo.size,
              sizeFormatted: this.formatBytes(clipInfo.size)
            })
          } catch (error) {
            resolve({
              success: true,
              clipPath,
              relativePath: path.relative(process.cwd(), clipPath)
            })
          }
        } else {
          reject(new Error(`Clip extraction failed with code ${code}`))
        }
      })
    })
  }

  /**
   * Comprime videos antiguos automáticamente
   */
  async compressOldVideos(options = {}) {
    const {
      olderThanDays = this.config.compressOlderThanDays,
      dryRun = false
    } = options
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
    
    const results = {
      found: [],
      compressed: [],
      failed: [],
      totalSpaceSaved: 0
    }
    
    // Buscar videos antiguos
    const findOldVideos = (dir) => {
      if (!fs.existsSync(dir)) return
      
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          findOldVideos(fullPath)
        } else if (entry.isFile() && /\.(mp4|mkv|avi|mov)$/i.test(entry.name)) {
          // Verificar si ya está comprimido
          if (entry.name.includes('_compressed')) continue
          
          const stats = fs.statSync(fullPath)
          if (stats.mtime < cutoffDate) {
            results.found.push({
              path: fullPath,
              size: stats.size,
              date: stats.mtime
            })
          }
        }
      }
    }
    
    findOldVideos(RECORDINGS_DIR)
    
    console.log(`🔍 Encontrados ${results.found.length} videos con más de ${olderThanDays} días`)
    
    if (dryRun) {
      return {
        dryRun: true,
        videosFound: results.found.length,
        totalSize: results.found.reduce((sum, v) => sum + v.size, 0),
        videos: results.found
      }
    }
    
    // Comprimir cada video
    for (const video of results.found) {
      try {
        console.log(`🔄 Comprimiendo: ${path.basename(video.path)}`)
        const result = await this.compressVideo(video.path)
        results.compressed.push(result)
        results.totalSpaceSaved += result.spaceSaved
      } catch (error) {
        console.error(`❌ Error comprimiendo ${video.path}:`, error.message)
        results.failed.push({ path: video.path, error: error.message })
      }
    }
    
    return {
      dryRun: false,
      videosFound: results.found.length,
      videosCompressed: results.compressed.length,
      videosFailed: results.failed.length,
      totalSpaceSaved: results.totalSpaceSaved,
      totalSpaceSavedFormatted: this.formatBytes(results.totalSpaceSaved),
      compressed: results.compressed,
      failed: results.failed
    }
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
    // Buscar en cola
    const queueIndex = this.queue.findIndex(t => t.id === taskId)
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1)
      return { success: true, message: 'Task removed from queue' }
    }
    
    // Buscar en procesos activos
    const activeProcess = this.activeProcesses.get(taskId)
    if (activeProcess) {
      activeProcess.process.kill('SIGKILL')
      this.activeProcesses.delete(taskId)
      return { success: true, message: 'Task cancelled' }
    }
    
    return { success: false, message: 'Task not found' }
  }

  /**
   * Obtiene lista de thumbnails
   */
  getThumbnails() {
    const thumbnails = []
    
    if (!fs.existsSync(THUMBNAILS_DIR)) return thumbnails
    
    const entries = fs.readdirSync(THUMBNAILS_DIR, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
        const fullPath = path.join(THUMBNAILS_DIR, entry.name)
        const stats = fs.statSync(fullPath)
        
        thumbnails.push({
          name: entry.name,
          path: fullPath,
          relativePath: path.relative(process.cwd(), fullPath),
          size: stats.size,
          createdAt: stats.birthtime
        })
      }
    }
    
    return thumbnails
  }

  /**
   * Obtiene lista de clips
   */
  getClips() {
    const clips = []
    
    if (!fs.existsSync(CLIPS_DIR)) return clips
    
    const entries = fs.readdirSync(CLIPS_DIR, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isFile() && /\.(mp4|mkv|avi|mov)$/i.test(entry.name)) {
        const fullPath = path.join(CLIPS_DIR, entry.name)
        const stats = fs.statSync(fullPath)
        
        clips.push({
          name: entry.name,
          path: fullPath,
          relativePath: path.relative(process.cwd(), fullPath),
          size: stats.size,
          sizeFormatted: this.formatBytes(stats.size),
          createdAt: stats.birthtime
        })
      }
    }
    
    return clips
  }

  /**
   * Actualiza configuración
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig)
    console.log('⚙️ Configuración de VideoProcessor actualizada')
  }

  /**
   * Convierte tiempo a segundos
   */
  timeToSeconds(time) {
    if (typeof time === 'number') return time
    
    const parts = time.split(':').map(Number)
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }
    return parseFloat(time) || 0
  }

  /**
   * Combina múltiples segmentos de video en uno solo
   * Útil para unir los chunks de 5 minutos en un archivo final
   * 
   * NOTA: Este proceso se hace DESPUÉS de la grabación para no usar memoria activa
   * 
   * @param {string[]} segmentPaths - Array de rutas a los segmentos (en orden)
   * @param {string} outputPath - Ruta del archivo de salida
   * @param {object} options - Opciones adicionales
   */
  async combineSegments(segmentPaths, outputPath, options = {}) {
    const {
      deleteOriginals = false,
      applyFaststart = true,
      onProgress = null
    } = options

    if (!segmentPaths || segmentPaths.length === 0) {
      throw new Error('No se proporcionaron segmentos para combinar')
    }

    // Verificar que todos los segmentos existen
    for (const segment of segmentPaths) {
      if (!fs.existsSync(segment)) {
        throw new Error(`Segmento no encontrado: ${segment}`)
      }
    }

    console.log(`🔗 Combinando ${segmentPaths.length} segmentos en: ${outputPath}`)

    // Crear archivo de lista para concat
    const listFilePath = path.join(path.dirname(outputPath), `concat_list_${Date.now()}.txt`)
    const listContent = segmentPaths.map(p => `file '${p}'`).join('\n')
    fs.writeFileSync(listFilePath, listContent)

    const taskId = `combine_${Date.now()}`

    try {
      // Paso 1: Concatenar segmentos (sin re-encoding)
      const tempOutput = applyFaststart 
        ? outputPath.replace('.mp4', '_temp.mp4')
        : outputPath

      await new Promise((resolve, reject) => {
        const args = [
          '-f', 'concat',
          '-safe', '0',
          '-i', listFilePath,
          '-c', 'copy',  // Sin re-encoding = rápido y sin memoria extra
          '-y',
          tempOutput
        ]

        const process = spawn(this.config.ffmpegPath, args)
        this.activeProcesses.set(taskId, { process, type: 'combine' })

        let totalDuration = 0
        let stderrOutput = ''

        process.stderr.on('data', (data) => {
          stderrOutput += data.toString()
          
          // Calcular progreso
          const durationMatch = stderrOutput.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
          if (durationMatch && totalDuration === 0) {
            totalDuration = parseInt(durationMatch[1]) * 3600 + 
                           parseInt(durationMatch[2]) * 60 + 
                           parseFloat(durationMatch[3])
          }

          const timeMatch = data.toString().match(/time=(\d+):(\d+):(\d+\.\d+)/)
          if (timeMatch && totalDuration > 0 && onProgress) {
            const currentTime = parseInt(timeMatch[1]) * 3600 + 
                               parseInt(timeMatch[2]) * 60 + 
                               parseFloat(timeMatch[3])
            onProgress(Math.min(100, (currentTime / totalDuration) * 100))
          }
        })

        process.on('error', (error) => {
          reject(new Error(`Error concatenando: ${error.message}`))
        })

        process.on('close', (code) => {
          this.activeProcesses.delete(taskId)
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`Concatenación falló con código ${code}`))
          }
        })
      })

      // Paso 2: Aplicar faststart (mover moov atom al inicio)
      if (applyFaststart) {
        console.log(`⚡ Aplicando faststart a: ${outputPath}`)
        await this.applyFaststart(tempOutput, outputPath)
        fs.unlinkSync(tempOutput)  // Eliminar temporal
      }

      // Limpiar archivo de lista
      fs.unlinkSync(listFilePath)

      // Eliminar originales si se solicitó
      if (deleteOriginals) {
        console.log(`🗑️ Eliminando ${segmentPaths.length} segmentos originales`)
        for (const segment of segmentPaths) {
          try {
            fs.unlinkSync(segment)
          } catch (e) {
            console.warn(`No se pudo eliminar: ${segment}`)
          }
        }
      }

      // Obtener info del archivo final
      const finalInfo = await this.getVideoInfo(outputPath)
      
      console.log(`✅ Segmentos combinados: ${outputPath} (${this.formatBytes(finalInfo.size)})`)

      return {
        success: true,
        outputPath,
        duration: finalInfo.duration,
        size: finalInfo.size,
        segmentsCombined: segmentPaths.length
      }

    } catch (error) {
      // Limpiar en caso de error
      if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath)
      throw error
    }
  }

  /**
   * Aplica faststart a un video MP4 (mueve moov atom al inicio)
   * Esto permite streaming progresivo del video
   * 
   * NOTA: Se hace en post-procesamiento para no usar memoria durante grabación
   * 
   * @param {string} inputPath - Video de entrada
   * @param {string} outputPath - Video de salida (puede ser el mismo)
   */
  async applyFaststart(inputPath, outputPath = null) {
    const sameFile = !outputPath || inputPath === outputPath
    const finalOutput = sameFile ? inputPath.replace('.mp4', '_faststart.mp4') : outputPath

    return new Promise((resolve, reject) => {
      // FFmpeg mueve el moov atom sin re-encoding
      const args = [
        '-i', inputPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        '-y',
        finalOutput
      ]

      const process = spawn(this.config.ffmpegPath, args)

      process.on('error', (error) => {
        reject(new Error(`Error aplicando faststart: ${error.message}`))
      })

      process.on('close', (code) => {
        if (code === 0) {
          // Si era el mismo archivo, reemplazar
          if (sameFile) {
            fs.unlinkSync(inputPath)
            fs.renameSync(finalOutput, inputPath)
            resolve({ success: true, path: inputPath })
          } else {
            resolve({ success: true, path: finalOutput })
          }
        } else {
          reject(new Error(`Faststart falló con código ${code}`))
        }
      })
    })
  }

  /**
   * Busca y combina automáticamente todos los segmentos de una sesión de grabación
   * 
   * @param {string} recordingDir - Directorio con los segmentos
   * @param {object} options - Opciones
   */
  async combineRecordingSession(recordingDir, options = {}) {
    const {
      outputName = 'recording_combined.mp4',
      deleteSegments = false,
      applyFaststart = true
    } = options

    if (!fs.existsSync(recordingDir)) {
      throw new Error(`Directorio no encontrado: ${recordingDir}`)
    }

    // Buscar todos los segmentos MP4 en el directorio
    const entries = fs.readdirSync(recordingDir, { withFileTypes: true })
    const segments = entries
      .filter(e => e.isFile() && e.name.endsWith('.mp4') && !e.name.includes('_combined'))
      .map(e => ({
        name: e.name,
        path: path.join(recordingDir, e.name),
        // Extraer timestamp del nombre para ordenar
        timestamp: this.extractTimestampFromFilename(e.name)
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(s => s.path)

    if (segments.length === 0) {
      throw new Error('No se encontraron segmentos MP4 en el directorio')
    }

    if (segments.length === 1) {
      console.log('ℹ️ Solo hay un segmento, aplicando faststart si es necesario')
      if (applyFaststart) {
        await this.applyFaststart(segments[0])
      }
      return {
        success: true,
        outputPath: segments[0],
        segmentsCombined: 1,
        message: 'Solo había un segmento'
      }
    }

    const outputPath = path.join(recordingDir, outputName)
    return this.combineSegments(segments, outputPath, {
      deleteOriginals: deleteSegments,
      applyFaststart
    })
  }

  /**
   * Extrae timestamp de un nombre de archivo de grabación
   * Formato esperado: Escenario_Camera_YYYY-MM-DD_HH-MM-SS_001.mp4
   */
  extractTimestampFromFilename(filename) {
    const match = filename.match(/(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/)
    if (match) {
      const [_, date, hour, min, sec] = match
      return new Date(`${date}T${hour}:${min}:${sec}`).getTime()
    }
    return 0
  }

  /**
   * Formatea bytes a string legible
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Singleton
const videoProcessor = new VideoProcessor()

export default videoProcessor
