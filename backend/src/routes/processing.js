import express from 'express'
import path from 'path'
import videoProcessor from '../services/videoProcessor.js'

const router = express.Router()

/**
 * GET /api/processing/status
 * Obtiene estado del procesador y cola
 */
router.get('/status', (req, res) => {
  try {
    const status = videoProcessor.getQueueStatus()
    res.json({ success: true, ...status })
  } catch (error) {
    console.error('Error obteniendo estado:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/processing/config
 * Obtiene configuración del procesador
 */
router.get('/config', (req, res) => {
  res.json({ success: true, config: videoProcessor.config })
})

/**
 * PUT /api/processing/config
 * Actualiza configuración del procesador
 */
router.put('/config', (req, res) => {
  try {
    videoProcessor.updateConfig(req.body)
    res.json({ success: true, config: videoProcessor.config })
  } catch (error) {
    console.error('Error actualizando configuración:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/processing/thumbnail
 * Genera thumbnail de un video
 */
router.post('/thumbnail', async (req, res) => {
  try {
    const { videoPath, timestamp, width, height, async = false } = req.body
    
    if (!videoPath) {
      return res.status(400).json({ success: false, error: 'videoPath es requerido' })
    }
    
    // Verificar que el archivo existe
    const fullPath = path.isAbsolute(videoPath) 
      ? videoPath 
      : path.join(process.cwd(), videoPath)
    
    if (async) {
      const taskId = videoProcessor.addToQueue({
        type: 'thumbnail',
        videoPath: fullPath,
        options: { timestamp, width, height }
      })
      return res.json({ success: true, taskId, message: 'Tarea añadida a la cola' })
    }
    
    const result = await videoProcessor.generateThumbnail(fullPath, {
      timestamp, width, height
    })
    
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('Error generando thumbnail:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/processing/thumbnails/batch
 * Genera thumbnails para todos los videos de un directorio
 */
router.post('/thumbnails/batch', async (req, res) => {
  try {
    const { directory, recursive = true, force = false } = req.body
    
    const dirPath = directory 
      ? (path.isAbsolute(directory) ? directory : path.join(process.cwd(), directory))
      : path.join(process.cwd(), 'recordings')
    
    const results = await videoProcessor.generateThumbnailsForDirectory(dirPath, {
      recursive, force
    })
    
    const summary = {
      total: results.length,
      generated: results.filter(r => r.success).length,
      skipped: results.filter(r => r.skipped).length,
      failed: results.filter(r => !r.success && !r.skipped).length
    }
    
    res.json({ success: true, summary, results })
  } catch (error) {
    console.error('Error generando thumbnails:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/processing/thumbnails
 * Lista todos los thumbnails generados
 */
router.get('/thumbnails', (req, res) => {
  try {
    const thumbnails = videoProcessor.getThumbnails()
    res.json({ success: true, count: thumbnails.length, thumbnails })
  } catch (error) {
    console.error('Error listando thumbnails:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/processing/compress
 * Comprime un video
 */
router.post('/compress', async (req, res) => {
  try {
    const { videoPath, crf, preset, deleteOriginal, async = true } = req.body
    
    if (!videoPath) {
      return res.status(400).json({ success: false, error: 'videoPath es requerido' })
    }
    
    const fullPath = path.isAbsolute(videoPath) 
      ? videoPath 
      : path.join(process.cwd(), videoPath)
    
    if (async) {
      const taskId = videoProcessor.addToQueue({
        type: 'compress',
        videoPath: fullPath,
        options: { crf, preset, deleteOriginal }
      })
      return res.json({ success: true, taskId, message: 'Tarea de compresión añadida a la cola' })
    }
    
    const result = await videoProcessor.compressVideo(fullPath, {
      crf, preset, deleteOriginal
    })
    
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('Error comprimiendo video:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/processing/compress/old
 * Comprime videos antiguos automáticamente
 */
router.post('/compress/old', async (req, res) => {
  try {
    const { olderThanDays, dryRun = true } = req.body
    
    const result = await videoProcessor.compressOldVideos({
      olderThanDays,
      dryRun
    })
    
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('Error comprimiendo videos antiguos:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/processing/clip
 * Extrae un clip de un video
 */
router.post('/clip', async (req, res) => {
  try {
    const { 
      videoPath, 
      startTime, 
      endTime, 
      duration, 
      outputName,
      reencode = false,
      async = false 
    } = req.body
    
    if (!videoPath || !startTime) {
      return res.status(400).json({ 
        success: false, 
        error: 'videoPath y startTime son requeridos' 
      })
    }
    
    const fullPath = path.isAbsolute(videoPath) 
      ? videoPath 
      : path.join(process.cwd(), videoPath)
    
    if (async) {
      const taskId = videoProcessor.addToQueue({
        type: 'clip',
        videoPath: fullPath,
        options: { startTime, endTime, duration, outputName, reencode }
      })
      return res.json({ success: true, taskId, message: 'Tarea de extracción añadida a la cola' })
    }
    
    const result = await videoProcessor.extractClip(fullPath, {
      startTime, endTime, duration, outputName, reencode
    })
    
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('Error extrayendo clip:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/processing/clips
 * Lista todos los clips generados
 */
router.get('/clips', (req, res) => {
  try {
    const clips = videoProcessor.getClips()
    res.json({ success: true, count: clips.length, clips })
  } catch (error) {
    console.error('Error listando clips:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/processing/video-info
 * Obtiene información de un video
 */
router.post('/video-info', async (req, res) => {
  try {
    const { videoPath } = req.body
    
    if (!videoPath) {
      return res.status(400).json({ success: false, error: 'videoPath es requerido' })
    }
    
    const fullPath = path.isAbsolute(videoPath) 
      ? videoPath 
      : path.join(process.cwd(), videoPath)
    
    const info = await videoProcessor.getVideoInfo(fullPath)
    res.json({ success: true, info })
  } catch (error) {
    console.error('Error obteniendo info de video:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/processing/task/:taskId
 * Cancela una tarea
 */
router.delete('/task/:taskId', (req, res) => {
  try {
    const { taskId } = req.params
    const result = videoProcessor.cancelTask(taskId)
    res.json(result)
  } catch (error) {
    console.error('Error cancelando tarea:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
