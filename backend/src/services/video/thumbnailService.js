import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

// Directorios
const THUMBNAILS_DIR = path.join(process.cwd(), 'thumbnails')

/**
 * ThumbnailService - Servicio especializado para generación de thumbnails
 * 
 * Características:
 * - Generación de thumbnails desde videos
 * - Generación batch para directorios
 * - Obtención de información de video con ffprobe
 */
class ThumbnailService {
  constructor(config = {}) {
    this.config = {
      thumbnailWidth: config.thumbnailWidth || 320,
      thumbnailHeight: config.thumbnailHeight || 180,
      thumbnailFormat: config.thumbnailFormat || 'jpg',
      thumbnailQuality: config.thumbnailQuality || 80,
      ffmpegPath: config.ffmpegPath || 'ffmpeg',
      ffprobePath: config.ffprobePath || 'ffprobe'
    }

    // Asegurar directorio
    this.ensureDirectories()
  }

  /**
   * Asegura que exista el directorio de thumbnails
   */
  ensureDirectories() {
    if (!fs.existsSync(THUMBNAILS_DIR)) {
      fs.mkdirSync(THUMBNAILS_DIR, { recursive: true })
    }
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
      timestamp = '00:00:01',
      width = this.config.thumbnailWidth,
      height = this.config.thumbnailHeight
    } = options
    
    // Verificar que el video existe
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video no encontrado: ${videoPath}`)
    }
    
    // Determinar ruta de salida
    const videoName = path.basename(videoPath, path.extname(videoPath)).replace(/%/g, '_')
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
   * Actualiza configuración
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig)
  }
}

export default ThumbnailService
