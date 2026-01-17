import express from 'express'
import syncRecordingService from '../services/syncRecordingService.js'

const router = express.Router()

// Obtener estado de grabaciones sincronizadas
router.get('/status', (req, res) => {
  try {
    const sessions = syncRecordingService.getAllSessionsStatus()
    res.json({
      success: true,
      data: sessions
    })
  } catch (error) {
    console.error('Error getting sync status:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Iniciar grabación sincronizada
router.post('/start', async (req, res) => {
  try {
    const { cameraId, scenarioId, scenarioName, sensorTopics } = req.body
    
    // Obtener cámara de la BD o usar objeto simple si no hay acceso a DB aqui
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })

    if (!camera) {
      return res.status(404).json({ success: false, error: 'Cámara no encontrada' })
    }

    const result = await syncRecordingService.startSyncRecording(camera, {
      scenarioId,
      scenarioName,
      sensorTopics
    })

    if (result.success) {
      res.json({ success: true, data: result })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (error) {
    console.error('Error starting sync recording:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Detener grabación sincronizada
router.post('/stop', async (req, res) => {
  try {
    const { cameraId } = req.body
    const result = await syncRecordingService.stopSyncRecording(cameraId)

    if (result.success) {
      res.json({ success: true, data: result })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (error) {
    console.error('Error stopping sync recording:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
