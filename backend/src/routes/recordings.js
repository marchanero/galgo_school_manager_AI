import express from 'express'
import recordingManager from '../services/recordingManager.js'
import videoProcessor from '../services/videoProcessor.js'

const router = express.Router()

/**
 * GET /api/recordings/status
 * Obtiene estado de todas las grabaciones activas
 */
router.get('/status', (req, res) => {
  try {
    const status = recordingManager.getAllRecordingsStatus()
    res.json({
      success: true,
      activeCount: status.length,
      recordings: status,
      config: recordingManager.config
    })
  } catch (error) {
    console.error('Error obteniendo estado de grabaciones:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/recordings/:cameraId/stats
 * Obtiene estadísticas de una grabación específica
 */
router.get('/:cameraId/stats', (req, res) => {
  try {
    const { cameraId } = req.params
    const stats = recordingManager.getRecordingStats(parseInt(cameraId))
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'No hay grabación activa para esta cámara'
      })
    }
    
    res.json({ success: true, stats })
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/start
 * Inicia grabación de una cámara
 */
router.post('/start', async (req, res) => {
  try {
    const { camera, scenarioId, scenarioName } = req.body
    
    if (!camera || !camera.id || !camera.rtspUrl) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere camera con id, name y rtspUrl'
      })
    }
    
    const result = recordingManager.startRecording(camera, {
      scenarioId,
      scenarioName
    })
    
    res.json(result)
  } catch (error) {
    console.error('Error iniciando grabación:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/:cameraId/stop
 * Detiene grabación de una cámara
 */
router.post('/:cameraId/stop', async (req, res) => {
  try {
    const { cameraId } = req.params
    const result = await recordingManager.stopRecording(parseInt(cameraId))
    res.json(result)
  } catch (error) {
    console.error('Error deteniendo grabación:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/stop-all
 * Detiene todas las grabaciones
 */
router.post('/stop-all', async (req, res) => {
  try {
    await recordingManager.stopAll()
    res.json({ success: true, message: 'Todas las grabaciones detenidas' })
  } catch (error) {
    console.error('Error deteniendo todas las grabaciones:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/recordings/config
 * Actualiza configuración del RecordingManager
 */
router.put('/config', (req, res) => {
  try {
    const config = req.body
    recordingManager.updateConfig(config)
    res.json({
      success: true,
      config: recordingManager.config
    })
  } catch (error) {
    console.error('Error actualizando configuración:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/recordings/:cameraId/is-recording
 * Verifica si una cámara está grabando
 */
router.get('/:cameraId/is-recording', (req, res) => {
  try {
    const { cameraId } = req.params
    const isRecording = recordingManager.isRecording(parseInt(cameraId))
    res.json({ success: true, cameraId: parseInt(cameraId), isRecording })
  } catch (error) {
    console.error('Error verificando grabación:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/combine-segments
 * Combina segmentos de grabación en un archivo único
 * 
 * Body:
 * - recordingDir: Directorio con los segmentos
 * - outputName: Nombre del archivo de salida (opcional)
 * - deleteSegments: Si eliminar los segmentos originales (opcional, default: false)
 * - applyFaststart: Si aplicar faststart para streaming (opcional, default: true)
 */
router.post('/combine-segments', async (req, res) => {
  try {
    const { 
      recordingDir, 
      outputName = 'recording_combined.mp4',
      deleteSegments = false,
      applyFaststart = true 
    } = req.body

    if (!recordingDir) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere recordingDir'
      })
    }

    const result = await videoProcessor.combineRecordingSession(recordingDir, {
      outputName,
      deleteSegments,
      applyFaststart
    })

    res.json(result)
  } catch (error) {
    console.error('Error combinando segmentos:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/recordings/apply-faststart
 * Aplica faststart a un video (mueve moov atom al inicio para streaming)
 * 
 * Body:
 * - videoPath: Ruta al video
 */
router.post('/apply-faststart', async (req, res) => {
  try {
    const { videoPath } = req.body

    if (!videoPath) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere videoPath'
      })
    }

    const result = await videoProcessor.applyFaststart(videoPath)
    res.json(result)
  } catch (error) {
    console.error('Error aplicando faststart:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/recordings/memory-config
 * Obtiene la configuración de memoria del sistema de grabación
 */
router.get('/memory-config', (req, res) => {
  try {
    const config = recordingManager.config
    res.json({
      success: true,
      memoryOptimizations: {
        segmentTime: `${config.segmentTime} segundos (${config.segmentTime / 60} minutos)`,
        inputBufferSize: config.inputBufferSize,
        maxMuxingQueue: config.maxMuxingQueue,
        analyzeDuration: config.analyzeDuration,
        probeSize: config.probeSize
      },
      tips: [
        'Los segmentos de 5 minutos reducen el uso de memoria vs 1 hora',
        'El buffer de entrada está limitado a 16MB',
        'Use POST /combine-segments para unir segmentos después de grabar',
        'Use POST /apply-faststart para optimizar videos para streaming'
      ]
    })
  } catch (error) {
    console.error('Error obteniendo config de memoria:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
