import { EventEmitter } from 'events'
import hardwareDetector from './hardwareDetector.js'
import frameCache from './frameCache.js'

/**
 * PerformanceManager - Gestión centralizada de rendimiento
 * 
 * Coordina:
 * - Detección de hardware
 * - Perfiles de encoding
 * - Caché de frames
 * - Métricas de rendimiento
 * - Optimización adaptativa
 */
class PerformanceManager extends EventEmitter {
  constructor() {
    super()
    
    this.initialized = false
    
    // Referencias a servicios
    this.hardwareDetector = hardwareDetector
    this.frameCache = frameCache
    
    // Estado actual
    this.state = {
      activeEncoder: null,
      currentProfile: 'balanced',
      hwAccelEnabled: false,
      adaptiveMode: true
    }
    
    // Métricas en tiempo real
    this.metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      activeStreams: 0,
      activeRecordings: 0,
      totalFps: 0,
      droppedFrames: 0,
      networkBandwidth: 0
    }
    
    // Configuración
    this.config = {
      // Umbrales de CPU para cambio de perfil
      cpuHighThreshold: 80,      // Cambiar a performance
      cpuLowThreshold: 40,       // Cambiar a high quality
      
      // Intervalo de monitoreo
      metricsInterval: 5000,
      
      // Adaptación automática
      adaptiveEnabled: true,
      minAdaptiveInterval: 30000,  // No cambiar más seguido que cada 30s
      
      // Streaming
      defaultStreamFps: 15,
      defaultStreamQuality: 'medium',
      
      // Grabación
      defaultRecordingProfile: 'balanced',
      useHwAccelIfAvailable: true
    }
    
    // Último cambio de perfil
    this.lastProfileChange = 0
    
    // Timer de métricas
    this.metricsTimer = null
  }

  /**
   * Inicializa el sistema de rendimiento
   */
  async initialize() {
    if (this.initialized) return
    
    console.log('🚀 Inicializando PerformanceManager...')
    
    // Detectar hardware
    await this.hardwareDetector.detect()
    
    // Configurar encoder basado en hardware
    this.state.activeEncoder = this.hardwareDetector.capabilities.recommended
    this.state.hwAccelEnabled = this.state.activeEncoder !== 'libx264'
    
    // Iniciar frame cache
    this.frameCache.start()
    
    // Iniciar monitoreo de métricas
    this.startMetricsMonitoring()
    
    this.initialized = true
    
    console.log('✅ PerformanceManager inicializado')
    console.log(`   Encoder: ${this.state.activeEncoder}`)
    console.log(`   HW Accel: ${this.state.hwAccelEnabled ? 'Habilitado' : 'Deshabilitado'}`)
    
    this.emit('initialized', this.getStatus())
  }

  /**
   * Inicia monitoreo de métricas del sistema
   */
  startMetricsMonitoring() {
    if (this.metricsTimer) return
    
    this.metricsTimer = setInterval(async () => {
      await this.updateMetrics()
      
      if (this.config.adaptiveEnabled) {
        this.adaptProfile()
      }
    }, this.config.metricsInterval)
  }

  /**
   * Detiene monitoreo
   */
  stopMetricsMonitoring() {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
      this.metricsTimer = null
    }
  }

  /**
   * Actualiza métricas del sistema
   */
  async updateMetrics() {
    try {
      const os = await import('os')
      
      // CPU usage (aproximado)
      const cpus = os.cpus()
      let totalIdle = 0
      let totalTick = 0
      
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type]
        }
        totalIdle += cpu.times.idle
      }
      
      this.metrics.cpuUsage = Math.round((1 - totalIdle / totalTick) * 100)
      
      // Memory usage
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      this.metrics.memoryUsage = Math.round((1 - freeMem / totalMem) * 100)
      
      // Frame cache stats
      const cacheStats = this.frameCache.getStats()
      this.metrics.cacheHitRate = cacheStats.hitRate
      this.metrics.cacheMemory = cacheStats.memoryUsed
      
      this.emit('metricsUpdated', this.metrics)
      
    } catch (error) {
      console.error('Error actualizando métricas:', error.message)
    }
  }

  /**
   * Adapta el perfil de encoding según la carga
   */
  adaptProfile() {
    const now = Date.now()
    
    // No cambiar muy frecuentemente
    if (now - this.lastProfileChange < this.config.minAdaptiveInterval) {
      return
    }
    
    let newProfile = this.state.currentProfile
    
    if (this.metrics.cpuUsage > this.config.cpuHighThreshold) {
      // CPU alta - reducir calidad
      if (this.state.currentProfile === 'high') {
        newProfile = 'balanced'
      } else if (this.state.currentProfile === 'balanced') {
        newProfile = 'performance'
      }
    } else if (this.metrics.cpuUsage < this.config.cpuLowThreshold) {
      // CPU baja - aumentar calidad
      if (this.state.currentProfile === 'performance') {
        newProfile = 'balanced'
      } else if (this.state.currentProfile === 'balanced') {
        newProfile = 'high'
      }
    }
    
    if (newProfile !== this.state.currentProfile) {
      console.log(`🔄 Adaptando perfil: ${this.state.currentProfile} → ${newProfile} (CPU: ${this.metrics.cpuUsage}%)`)
      this.state.currentProfile = newProfile
      this.lastProfileChange = now
      
      this.emit('profileChanged', {
        oldProfile: this.state.currentProfile,
        newProfile,
        reason: 'adaptive',
        cpuUsage: this.metrics.cpuUsage
      })
    }
  }

  /**
   * Obtiene argumentos FFmpeg optimizados para grabación
   */
  getRecordingArgs(options = {}) {
    const encoder = this.config.useHwAccelIfAvailable 
      ? this.state.activeEncoder 
      : 'libx264'
    
    return this.hardwareDetector.getRecordingArgs({
      encoder,
      profile: options.profile || this.state.currentProfile,
      ...options
    })
  }

  /**
   * Obtiene argumentos FFmpeg optimizados para streaming
   */
  getStreamingArgs(options = {}) {
    return this.hardwareDetector.getStreamingArgs({
      encoder: this.state.activeEncoder,
      fps: options.fps || this.config.defaultStreamFps,
      ...options
    })
  }

  /**
   * Obtiene configuración de calidad para streaming según red
   */
  getAdaptiveStreamConfig(networkSpeed) {
    // networkSpeed en Mbps
    if (networkSpeed < 1) {
      return {
        fps: 10,
        scale: '480:270',
        quality: 'low',
        bitrate: '500k'
      }
    } else if (networkSpeed < 5) {
      return {
        fps: 15,
        scale: '854:480',
        quality: 'medium',
        bitrate: '1500k'
      }
    } else if (networkSpeed < 10) {
      return {
        fps: 25,
        scale: '1280:720',
        quality: 'high',
        bitrate: '3000k'
      }
    } else {
      return {
        fps: 30,
        scale: null, // Original
        quality: 'ultra',
        bitrate: '6000k'
      }
    }
  }

  /**
   * Cambia el perfil de encoding manualmente
   */
  setProfile(profile) {
    if (!['high', 'balanced', 'performance', 'lowlatency'].includes(profile)) {
      throw new Error(`Perfil inválido: ${profile}`)
    }
    
    this.state.currentProfile = profile
    this.lastProfileChange = Date.now()
    
    this.emit('profileChanged', {
      newProfile: profile,
      reason: 'manual'
    })
    
    return { success: true, profile }
  }

  /**
   * Habilita/deshabilita aceleración por hardware
   */
  setHwAccel(enabled) {
    this.state.hwAccelEnabled = enabled
    
    if (enabled) {
      this.state.activeEncoder = this.hardwareDetector.capabilities.recommended
    } else {
      this.state.activeEncoder = 'libx264'
    }
    
    this.emit('hwAccelChanged', {
      enabled,
      encoder: this.state.activeEncoder
    })
    
    return { success: true, hwAccel: enabled, encoder: this.state.activeEncoder }
  }

  /**
   * Ejecuta benchmark de encoders
   */
  async runBenchmark() {
    return await this.hardwareDetector.runFullBenchmark()
  }

  /**
   * Obtiene estado completo
   */
  getStatus() {
    return {
      initialized: this.initialized,
      state: this.state,
      metrics: this.metrics,
      hardware: this.hardwareDetector.capabilities,
      cache: this.frameCache.getStats(),
      config: this.config
    }
  }

  /**
   * Obtiene capacidades de hardware
   */
  getHardwareInfo() {
    return this.hardwareDetector.capabilities
  }

  /**
   * Actualiza configuración
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig)
    
    // Propagar a sub-servicios si es necesario
    if (newConfig.frameCacheConfig) {
      this.frameCache.updateConfig(newConfig.frameCacheConfig)
    }
    
    console.log('⚙️ Configuración de PerformanceManager actualizada')
  }

  /**
   * Cierre graceful
   */
  stop() {
    console.log('🛑 Deteniendo PerformanceManager...')
    this.stopMetricsMonitoring()
    this.frameCache.stop()
  }
}

// Singleton
const performanceManager = new PerformanceManager()

export default performanceManager
