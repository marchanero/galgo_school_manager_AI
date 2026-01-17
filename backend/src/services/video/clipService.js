import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

// Directorios
const CLIPS_DIR = path.join(process.cwd(), 'clips')

/**
 * ClipService - Servicio especializado para extracción de clips de video
 * 
 * Características:
 * - Extracción rápida sin recodificación
 * - Extracción precisa con recodificación
 * - Gestión de clips
 */
class ClipService {
  constructor(config = {}, getVideoInfoFn = null) {
    this.config = {
      defaultClipDuration: config.defaultClipDuration || 30,
      clipFormat: config.clipFormat || 'mp4',
      ffmpegPath: config.ffmpegPath || 'ffmpeg'
    }

    // Función externa para obtener info de video
    this.getVideoInfo = getVideoInfoFn

    // Asegurar directorio
    this.ensureDirectories()
  }

  /**
   * Asegura que exista el directorio de clips
   */
  ensureDirectories() {
    if (!fs.existsSync(CLIPS_DIR)) {
      fs.mkdirSync(CLIPS_DIR, { recursive: true })
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
   * Extrae un clip de un video
   */
  async extractClip(videoPath, options = {}) {
    const {
      startTime,
      endTime,
      duration,
      outputName,
      reencode = false
    } = options
    
    if (!startTime) {
      throw new Error('startTime es requerido')
    }
    
    // Calcular duración
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
        // Sin recodificación (rápido)
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
      
      process.on('error', (error) => {
        reject(new Error(`Clip extraction error: ${error.message}`))
      })
      
      process.on('close', async (code) => {
        if (code === 0 && fs.existsSync(clipPath)) {
          try {
            const clipInfo = this.getVideoInfo ? await this.getVideoInfo(clipPath) : null
            
            resolve({
              success: true,
              clipPath,
              relativePath: path.relative(process.cwd(), clipPath),
              duration: clipInfo?.duration,
              size: clipInfo?.size || fs.statSync(clipPath).size,
              sizeFormatted: this.formatBytes(clipInfo?.size || fs.statSync(clipPath).size)
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
  }
}

export default ClipService
