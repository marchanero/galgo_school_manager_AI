import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

// Directorios
const RECORDINGS_DIR = path.join(process.cwd(), 'recordings')
const COMPRESSED_DIR = path.join(process.cwd(), 'compressed')

/**
 * CompressionService - Servicio especializado para compresión de videos
 * 
 * Características:
 * - Compresión de videos individuales
 * - Compresión batch de videos antiguos
 * - Reporting de espacio ahorrado
 */
class CompressionService {
  constructor(config = {}, getVideoInfoFn = null) {
    this.config = {
      compressionCrf: config.compressionCrf || 28,
      compressionPreset: config.compressionPreset || 'medium',
      compressOlderThanDays: config.compressOlderThanDays || 7,
      deleteOriginalAfterCompress: config.deleteOriginalAfterCompress || false,
      ffmpegPath: config.ffmpegPath || 'ffmpeg'
    }

    // Función externa para obtener info de video (reutilización)
    this.getVideoInfo = getVideoInfoFn

    // Asegurar directorio
    this.ensureDirectories()
  }

  /**
   * Asegura que exista el directorio de comprimidos
   */
  ensureDirectories() {
    if (!fs.existsSync(COMPRESSED_DIR)) {
      fs.mkdirSync(COMPRESSED_DIR, { recursive: true })
    }
  }

  /**
   * Formatea bytes a string legible
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Comprime un video para reducir tamaño
   * @param {Function} onProgress - Callback para progreso (opcional)
   */
  async compressVideo(videoPath, options = {}, onProgress = null) {
    const {
      crf = this.config.compressionCrf,
      preset = this.config.compressionPreset,
      deleteOriginal = this.config.deleteOriginalAfterCompress
    } = options
    
    // Obtener info original
    const originalInfo = this.getVideoInfo ? await this.getVideoInfo(videoPath) : { size: 0, duration: 0 }
    
    // Ruta de salida
    const videoName = path.basename(videoPath, path.extname(videoPath))
    const compressedPath = path.join(COMPRESSED_DIR, `${videoName}_compressed.mp4`)
    
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
          
          if (progress - lastProgress >= 5 && onProgress) {
            lastProgress = progress
            onProgress({
              taskId,
              videoPath,
              progress: Math.round(progress)
            })
          }
        }
      })
      
      process.on('error', (error) => {
        reject(new Error(`Compression error: ${error.message}`))
      })
      
      process.on('close', async (code) => {
        if (code === 0 && fs.existsSync(compressedPath)) {
          try {
            const compressedInfo = this.getVideoInfo ? await this.getVideoInfo(compressedPath) : { size: fs.statSync(compressedPath).size }
            const spaceSaved = originalInfo.size - compressedInfo.size
            const compressionRatio = originalInfo.size > 0 ? ((spaceSaved / originalInfo.size) * 100).toFixed(1) : '0.0'
            
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
   * Actualiza configuración
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig)
  }
}

export default CompressionService
