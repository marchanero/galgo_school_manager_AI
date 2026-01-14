import express from 'express'
import { spawn } from 'child_process'
import { cameraConfig } from '../config.js'

const router = express.Router()

// Función para capturar un frame rápidamente
async function captureFrame(rtspUrl) {
  return new Promise((resolve, reject) => {
    // Asegurarse de que la URL está completa
    if (!rtspUrl || !rtspUrl.startsWith('rtsp://')) {
      console.error(`❌ URL inválida: ${rtspUrl}`)
      reject(new Error('URL RTSP inválida'))
      return
    }

    const ffmpegArgs = [
      '-rtsp_transport', 'tcp',
      '-timeout', '5000000',
      '-i', rtspUrl,
      '-vframes', '1',
      '-f', 'image2',
      '-q:v', '10',
      '-'
    ]

    console.log(`🔍 FFmpeg iniciando... URL: ${rtspUrl}`)
    
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      shell: false
    })

    let buffer = Buffer.alloc(0)
    let timedOut = false
    let stderr = ''

    const timeout = setTimeout(() => {
      timedOut = true
      console.log('⏱️ Timeout FFmpeg (5s)')
      ffmpegProcess.kill('SIGKILL')
      reject(new Error('Timeout FFmpeg'))
    }, 5000)

    ffmpegProcess.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
    })

    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    ffmpegProcess.on('close', (code) => {
      clearTimeout(timeout)
      
      if (timedOut) {
        return
      }

      if (buffer.length > 100) {
        console.log(`✅ Frame capturado: ${buffer.length} bytes`)
        resolve(buffer)
      } else {
        let errorMsg = 'FFmpeg sin datos'
        
        if (stderr.includes('Connection refused')) {
          errorMsg = 'Cámara rechazó conexión'
        } else if (stderr.includes('Connection timed out')) {
          errorMsg = 'Timeout conexión cámara'
        } else if (stderr.includes('Authentication failed')) {
          errorMsg = 'Credenciales incorrectas'
        } else if (stderr.includes('403') || stderr.includes('401')) {
          errorMsg = 'Acceso denegado (Auth)'
        }
        
        // Log del stderr para debugging
        if (stderr.length > 0 && !stderr.includes('frame=') && !stderr.includes('fps=')) {
          const stderrLines = stderr.split('\n').filter(l => l.trim()).slice(-3).join(' | ')
          console.error(`❌ ${errorMsg} - stderr: ${stderrLines.substring(0, 150)}`)
        } else {
          console.error(`❌ ${errorMsg}`)
        }
        
        reject(new Error(errorMsg))
      }
    })

    ffmpegProcess.on('error', (error) => {
      clearTimeout(timeout)
      console.error('❌ Error proceso:', error.message)
      reject(error)
    })
  })
}

// GET stream MJPEG - envía frames continuamente
router.get('/:cameraId/live', async (req, res) => {
  try {
    const { cameraId } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })
    
    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    console.log(`📹 Stream iniciado: ${camera.name}`)

    const boundary = 'BOUNDARY'
    res.writeHead(200, {
      'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive'
    })

    let isConnected = true
    let frameCount = 0
    let consecutiveErrors = 0

    const sendFrames = async () => {
      while (isConnected) {
        try {
          const frame = await captureFrame(camera.rtspUrl)
          
          if (!isConnected) break

          consecutiveErrors = 0

          try {
            res.write(`--${boundary}\r\n`)
            res.write('Content-Type: image/jpeg\r\n')
            res.write(`Content-Length: ${frame.length}\r\n\r\n`)
            res.write(frame)
            res.write('\r\n')
            frameCount++
            console.log(`✅ Frame ${frameCount} enviado`)
          } catch (e) {
            isConnected = false
            break
          }

          // Esperar 1 segundo para siguiente frame (1 fps) - da más tiempo a FFmpeg
          await new Promise(r => setTimeout(r, 1000))

        } catch (error) {
          consecutiveErrors++
          if (consecutiveErrors > 3) {
            console.error('❌ Demasiados errores consecutivos')
            isConnected = false
            break
          }
          console.log(`⚠️ Error #${consecutiveErrors}, reintentando...`)
          await new Promise(r => setTimeout(r, 500))
        }
      }
    }

    res.on('close', () => {
      console.log(`🔌 Desconectado después de ${frameCount} frames`)
      isConnected = false
    })

    sendFrames()

  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET estado de conexión de cámara (para dashboard)
router.get('/status/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })
    
    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    try {
      // Intentar capturar un frame rápido para verificar conectividad
      const frame = await captureFrame(camera.rtspUrl)
      res.json({ 
        active: true,
        cameraId: camera.id,
        name: camera.name,
        lastCheck: new Date().toISOString()
      })
    } catch (error) {
      res.json({
        active: false,
        cameraId: camera.id,
        name: camera.name,
        lastCheck: new Date().toISOString(),
        error: error.message
      })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET información de stream
router.get('/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })
    
    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    res.json({ 
      success: true,
      camera: {
        id: camera.id,
        name: camera.name,
        liveUrl: `/api/stream/${camera.id}/live`
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET diagnóstico de cámara
router.get('/:cameraId/test', async (req, res) => {
  try {
    const { cameraId } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })
    
    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    console.log(`🔍 Testeando cámara ${camera.name}`)
    console.log(`📍 URL almacenada: ${camera.rtspUrl}`)
    console.log(`📊 Longitud URL: ${camera.rtspUrl.length} caracteres`)

    try {
      const frame = await captureFrame(camera.rtspUrl)
      res.json({
        success: true,
        message: 'Conexión exitosa',
        frameSize: frame.length,
        urlUsed: camera.rtspUrl,
        urlLength: camera.rtspUrl.length
      })
    } catch (error) {
      res.json({
        success: false,
        error: error.message,
        urlUsed: camera.rtspUrl,
        urlLength: camera.rtspUrl.length,
        hint: 'Verifica que la cámara esté encendida y alcanzable'
      })
    }

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET snapshot - captura un frame único como JPEG (para thumbnails)
router.get('/:cameraId/snapshot', async (req, res) => {
  try {
    const { cameraId } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(cameraId) }
    })
    
    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    try {
      const frame = await captureFrame(camera.rtspUrl)
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': frame.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      })
      res.end(frame)
    } catch (error) {
      // Devolver una imagen de error/placeholder
      res.status(503).json({ error: error.message })
    }

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
