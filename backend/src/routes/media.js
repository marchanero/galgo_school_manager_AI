import express from 'express'
import mediaServerManager from '../services/mediaServer.js'
import sensorRecorder from '../services/sensorRecorder.js'
import mqttRecordingService from '../services/mqttRecordingService.js'
import fs from 'fs'
import path from 'path'

const router = express.Router()

// POST /api/media/start/:cameraId - Iniciar grabación continua (video + sensores)
router.post('/start/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params
    const { recordSensors = true, sensorIds = [] } = req.body
    
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })

    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    // Iniciar grabación de video
    const videoResult = mediaServerManager.startCamera(camera)
    
    let sensorResult = null
    
    if (recordSensors) {
      // Iniciar grabación de sensores
      sensorResult = sensorRecorder.startRecording(camera.id, camera.name)
      
      // Habilitar grabación automática desde MQTT
      mqttRecordingService.startRecordingForCamera(camera.id, {
        recordAllSensors: sensorIds.length === 0,
        sensorIds
      })
    }
    
    res.json({
      success: true,
      message: `Grabación iniciada: ${camera.name}`,
      video: videoResult,
      sensors: sensorResult,
      mqttRecording: recordSensors
    })
  } catch (error) {
    console.error('Error iniciando cámara:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/media/start-hls/:cameraId - Iniciar streaming HLS (fallback)
router.post('/start-hls/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })

    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    const result = mediaServerManager.startHLSStream(camera)
    
    res.json({
      success: true,
      message: `Stream HLS iniciado: ${camera.name}`,
      ...result
    })
  } catch (error) {
    console.error('Error iniciando HLS:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/media/stop/:cameraId - Detener grabación (video + sensores)
router.post('/stop/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params
    
    // Detener grabación de video
    mediaServerManager.stopCamera(parseInt(cameraId))
    
    // Detener grabación MQTT
    mqttRecordingService.stopRecordingForCamera(parseInt(cameraId))
    
    // Detener grabación de sensores
    const sensorResult = await sensorRecorder.stopRecording(parseInt(cameraId))
    
    res.json({
      success: true,
      message: 'Grabación detenida (video + sensores)',
      sensors: sensorResult
    })
  } catch (error) {
    console.error('Error deteniendo cámara:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/media/stop-hls/:cameraId - Detener streaming HLS
router.post('/stop-hls/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params
    mediaServerManager.stopHLSStream(parseInt(cameraId))
    
    res.json({
      success: true,
      message: 'Stream HLS detenido'
    })
  } catch (error) {
    console.error('Error deteniendo HLS:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/status - Estado del sistema
router.get('/status', (req, res) => {
  try {
    const status = mediaServerManager.getStatus()
    res.json(status)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/recordings/:cameraId - Listar grabaciones
router.get('/recordings/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params
    const recordings = mediaServerManager.getRecordings(parseInt(cameraId))
    
    res.json({
      cameraId: parseInt(cameraId),
      recordings
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/download/:cameraId/:filename - Descargar grabación
router.get('/download/:cameraId/:filename', (req, res) => {
  try {
    const { cameraId, filename } = req.params
    const recordings = mediaServerManager.getRecordings(parseInt(cameraId))
    const recording = recordings.find(r => r.filename === filename)

    if (!recording) {
      return res.status(404).json({ error: 'Grabación no encontrada' })
    }

    res.download(recording.path, filename)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/recording/:cameraId/:filename - Eliminar grabación
router.delete('/recording/:cameraId/:filename', (req, res) => {
  try {
    const { cameraId, filename } = req.params
    const recordings = mediaServerManager.getRecordings(parseInt(cameraId))
    const recording = recordings.find(r => r.filename === filename)

    if (!recording) {
      return res.status(404).json({ error: 'Grabación no encontrada' })
    }

    fs.unlinkSync(recording.path)
    
    res.json({
      success: true,
      message: 'Grabación eliminada'
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/live/:cameraId - Stream del archivo MP4 actual en vivo
// GET /api/media/current/:cameraId - Alias para /live (usado por el frontend)
const streamCurrentRecording = (req, res) => {
  try {
    const { cameraId } = req.params
    const recordings = mediaServerManager.getRecordings(parseInt(cameraId))
    
    if (recordings.length === 0) {
      return res.status(404).json({ error: 'No hay grabaciones activas' })
    }

    // Obtener el archivo más reciente (el que se está grabando)
    const currentRecording = recordings[0]
    const filePath = currentRecording.path
    const stat = fs.statSync(filePath)
    const fileSize = stat.size
    const range = req.headers.range

    if (range) {
      // Soporte para streaming parcial (HTTP Range)
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunksize = (end - start) + 1
      const file = fs.createReadStream(filePath, { start, end })
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      }
      res.writeHead(206, head)
      file.pipe(res)
    } else {
      // Sin range, enviar todo el archivo
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      }
      res.writeHead(200, head)
      fs.createReadStream(filePath).pipe(res)
    }
  } catch (error) {
    console.error('Error streaming video:', error)
    res.status(500).json({ error: error.message })
  }
}

router.get('/live/:cameraId', streamCurrentRecording)
router.get('/current/:cameraId', streamCurrentRecording)

// === RUTAS PARA GRABACIONES DE SENSORES ===

// GET /api/media/sensors/recordings/:cameraId - Listar grabaciones de sensores
router.get('/sensors/recordings/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params
    const recordings = sensorRecorder.getRecordings(parseInt(cameraId))
    
    res.json({
      cameraId: parseInt(cameraId),
      recordings
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/sensors/data/:cameraId/:filename - Obtener datos de una grabación
router.get('/sensors/data/:cameraId/:filename', (req, res) => {
  try {
    const { cameraId, filename } = req.params
    const data = sensorRecorder.readRecording(parseInt(cameraId), filename)
    
    res.json({
      filename,
      recordCount: data.length,
      data
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/sensors/download/:cameraId/:filename - Descargar grabación de sensores
router.get('/sensors/download/:cameraId/:filename', (req, res) => {
  try {
    const { cameraId, filename } = req.params
    const recordings = sensorRecorder.getRecordings(parseInt(cameraId))
    const recording = recordings.find(r => r.filename === filename)

    if (!recording) {
      return res.status(404).json({ error: 'Grabación no encontrada' })
    }

    res.download(recording.path, filename)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/media/sensors/recording/:cameraId/:filename - Eliminar grabación de sensores
router.delete('/sensors/recording/:cameraId/:filename', (req, res) => {
  try {
    const { cameraId, filename } = req.params
    const result = sensorRecorder.deleteRecording(parseInt(cameraId), filename)
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/sensors/status/:cameraId - Estado de grabación de sensores
router.get('/sensors/status/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params
    const status = sensorRecorder.getRecordingStatus(parseInt(cameraId))
    
    res.json({
      isRecording: status !== null,
      ...status
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/media/sensors/record/:cameraId - Registrar datos de sensor (usado por MQTT)
router.post('/sensors/record/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params
    const sensorData = req.body
    
    const success = sensorRecorder.recordSensorData(parseInt(cameraId), sensorData)
    
    if (success) {
      res.json({ success: true })
    } else {
      res.status(400).json({ error: 'No hay grabación activa' })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// === FIN RUTAS SENSORES ===

// GET /api/media/hls/:cameraId/index.m3u8 - Servir manifest HLS (alternativa al puerto 8889)
router.get('/hls/:cameraId/index.m3u8', (req, res) => {
  try {
    const { cameraId } = req.params
    const streamKey = `camera_${cameraId}`
    const hlsPath = path.join(process.cwd(), 'media', 'live', streamKey, 'index.m3u8')
    
    if (!fs.existsSync(hlsPath)) {
      return res.status(404).json({ error: 'HLS manifest no encontrado. Espera unos segundos.' })
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.sendFile(hlsPath)
  } catch (error) {
    console.error('Error sirviendo HLS manifest:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/media/hls/:cameraId/:segment - Servir segmentos HLS
router.get('/hls/:cameraId/:segment', (req, res) => {
  try {
    const { cameraId, segment } = req.params
    const streamKey = `camera_${cameraId}`
    const segmentPath = path.join(process.cwd(), 'media', 'live', streamKey, segment)
    
    if (!fs.existsSync(segmentPath)) {
      return res.status(404).json({ error: 'Segmento no encontrado' })
    }

    res.setHeader('Content-Type', 'video/MP2T')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.sendFile(segmentPath)
  } catch (error) {
    console.error('Error sirviendo segmento HLS:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
