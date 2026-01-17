import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

/**
 * SegmentService - Servicio especializado para combinación de segmentos de video
 * 
 * Características:
 * - Combinación de múltiples segmentos en un solo archivo
 * - Aplicación de faststart para streaming
 * - Manejo de sesiones de grabación
 */
class SegmentService {
  constructor(config = {}, getVideoInfoFn = null) {
    this.config = {
      ffmpegPath: config.ffmpegPath || 'ffmpeg'
    }

    // Función externa para obtener info de video
    this.getVideoInfo = getVideoInfoFn

    // Procesos activos
    this.activeProcesses = new Map()
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
   * Combina múltiples segmentos de video en uno solo
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
          '-c', 'copy',
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

      // Paso 2: Aplicar faststart
      if (applyFaststart) {
        console.log(`⚡ Aplicando faststart a: ${outputPath}`)
        await this.applyFaststart(tempOutput, outputPath)
        fs.unlinkSync(tempOutput)
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
      const finalInfo = this.getVideoInfo ? await this.getVideoInfo(outputPath) : { size: fs.statSync(outputPath).size, duration: 0 }
      
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
   * Aplica faststart a un video MP4
   */
  async applyFaststart(inputPath, outputPath = null) {
    const sameFile = !outputPath || inputPath === outputPath
    const finalOutput = sameFile ? inputPath.replace('.mp4', '_faststart.mp4') : outputPath

    return new Promise((resolve, reject) => {
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
   * Busca y combina automáticamente todos los segmentos de una sesión
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

    // Buscar todos los segmentos MP4
    const entries = fs.readdirSync(recordingDir, { withFileTypes: true })
    const segments = entries
      .filter(e => e.isFile() && e.name.endsWith('.mp4') && !e.name.includes('_combined'))
      .map(e => ({
        name: e.name,
        path: path.join(recordingDir, e.name),
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
   * Actualiza configuración
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig)
  }
}

export default SegmentService
