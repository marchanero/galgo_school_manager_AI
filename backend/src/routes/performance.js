import express from 'express'
import performanceManager from '../services/performanceManager.js'
import hardwareDetector from '../services/hardwareDetector.js'
import frameCache from '../services/frameCache.js'

const router = express.Router()

/**
 * GET /api/performance/status
 * Obtiene estado completo del sistema de rendimiento
 */
router.get('/status', (req, res) => {
  try {
    const status = performanceManager.getStatus()
    res.json({ success: true, ...status })
  } catch (error) {
    console.error('Error obteniendo estado:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/performance/hardware
 * Obtiene información de hardware detectado
 */
router.get('/hardware', (req, res) => {
  try {
    const hardware = performanceManager.getHardwareInfo()
    res.json({ success: true, hardware })
  } catch (error) {
    console.error('Error obteniendo info de hardware:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/performance/detect
 * Fuerza re-detección de hardware
 */
router.post('/detect', async (req, res) => {
  try {
    const capabilities = await hardwareDetector.detect()
    res.json({ success: true, capabilities })
  } catch (error) {
    console.error('Error detectando hardware:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/performance/benchmark
 * Ejecuta benchmark de encoders
 */
router.post('/benchmark', async (req, res) => {
  try {
    console.log('🏃 Iniciando benchmark de encoders...')
    const results = await performanceManager.runBenchmark()
    res.json({ 
      success: true, 
      results,
      recommended: hardwareDetector.capabilities.recommended
    })
  } catch (error) {
    console.error('Error ejecutando benchmark:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/performance/metrics
 * Obtiene métricas actuales del sistema
 */
router.get('/metrics', (req, res) => {
  try {
    res.json({ 
      success: true, 
      metrics: performanceManager.metrics,
      state: performanceManager.state
    })
  } catch (error) {
    console.error('Error obteniendo métricas:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/performance/profile
 * Cambia el perfil de encoding
 */
router.put('/profile', (req, res) => {
  try {
    const { profile } = req.body
    
    if (!profile) {
      return res.status(400).json({ success: false, error: 'profile es requerido' })
    }
    
    const result = performanceManager.setProfile(profile)
    res.json(result)
  } catch (error) {
    console.error('Error cambiando perfil:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/performance/hwaccel
 * Habilita/deshabilita aceleración por hardware
 */
router.put('/hwaccel', (req, res) => {
  try {
    const { enabled } = req.body
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled debe ser boolean' })
    }
    
    const result = performanceManager.setHwAccel(enabled)
    res.json(result)
  } catch (error) {
    console.error('Error configurando hwaccel:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/performance/config
 * Obtiene configuración del sistema de rendimiento
 */
router.get('/config', (req, res) => {
  res.json({ 
    success: true, 
    config: performanceManager.config
  })
})

/**
 * PUT /api/performance/config
 * Actualiza configuración
 */
router.put('/config', (req, res) => {
  try {
    performanceManager.updateConfig(req.body)
    res.json({ 
      success: true, 
      config: performanceManager.config 
    })
  } catch (error) {
    console.error('Error actualizando configuración:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/performance/cache
 * Obtiene estadísticas del frame cache
 */
router.get('/cache', (req, res) => {
  try {
    const stats = frameCache.getStats()
    res.json({ success: true, cache: stats })
  } catch (error) {
    console.error('Error obteniendo stats de caché:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/performance/cache/:cameraId
 * Obtiene estadísticas de caché para una cámara
 */
router.get('/cache/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params
    const stats = frameCache.getCameraStats(parseInt(cameraId))
    
    if (!stats) {
      return res.status(404).json({ success: false, error: 'No hay caché para esta cámara' })
    }
    
    res.json({ success: true, stats })
  } catch (error) {
    console.error('Error obteniendo stats de cámara:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/performance/cache/:cameraId
 * Invalida caché de una cámara
 */
router.delete('/cache/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params
    frameCache.invalidate(parseInt(cameraId))
    res.json({ success: true, message: 'Caché invalidada' })
  } catch (error) {
    console.error('Error invalidando caché:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/performance/cache/config
 * Actualiza configuración del frame cache
 */
router.post('/cache/config', (req, res) => {
  try {
    frameCache.updateConfig(req.body)
    res.json({ 
      success: true, 
      config: frameCache.config 
    })
  } catch (error) {
    console.error('Error actualizando configuración de caché:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/performance/encoder-args
 * Obtiene argumentos FFmpeg recomendados
 */
router.get('/encoder-args', (req, res) => {
  try {
    const { type = 'recording', profile, inputUrl, outputPath } = req.query
    
    let args
    if (type === 'streaming') {
      args = performanceManager.getStreamingArgs({ inputUrl })
    } else {
      args = performanceManager.getRecordingArgs({ profile, inputUrl, outputPath })
    }
    
    res.json({
      success: true,
      type,
      encoder: performanceManager.state.activeEncoder,
      profile: profile || performanceManager.state.currentProfile,
      args
    })
  } catch (error) {
    console.error('Error obteniendo args de encoder:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/performance/adaptive-config
 * Obtiene configuración adaptativa basada en velocidad de red
 */
router.post('/adaptive-config', (req, res) => {
  try {
    const { networkSpeed } = req.body
    
    if (typeof networkSpeed !== 'number') {
      return res.status(400).json({ success: false, error: 'networkSpeed debe ser número (Mbps)' })
    }
    
    const config = performanceManager.getAdaptiveStreamConfig(networkSpeed)
    res.json({ success: true, networkSpeed, config })
  } catch (error) {
    console.error('Error obteniendo config adaptativa:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
