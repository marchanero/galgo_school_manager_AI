import express from 'express'
import recordingManager from '../services/recordingManager.js'

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

export default router
