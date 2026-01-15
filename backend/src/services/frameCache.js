import { EventEmitter } from 'events'

/**
 * FrameCache - Caché inteligente de frames para streaming
 * 
 * Características:
 * - Buffer circular por cámara
 * - Limpieza automática por TTL
 * - Estadísticas de hit/miss
 * - Compresión opcional
 * - Soporte multi-resolución
 */
class FrameCache extends EventEmitter {
  constructor() {
    super()
    
    // Cache por cámara
    this.caches = new Map()
    
    // Configuración
    this.config = {
      maxFramesPerCamera: 30,      // Frames en buffer
      frameTTL: 5000,              // TTL en ms
      cleanupInterval: 10000,      // Limpieza cada 10s
      enableMultiResolution: true,  // Guardar múltiples resoluciones
      resolutions: ['original', '720p', '480p', '240p']
    }
    
    // Estadísticas
    this.stats = {
      totalFramesCached: 0,
      totalHits: 0,
      totalMisses: 0,
      evictions: 0,
      memoryUsed: 0
    }
    
    // Timer de limpieza
    this.cleanupTimer = null
  }

  /**
   * Inicia el servicio de caché
   */
  start() {
    if (this.cleanupTimer) return
    
    console.log('🎞️ Iniciando FrameCache')
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * Detiene el servicio
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.caches.clear()
    console.log('🛑 FrameCache detenido')
  }

  /**
   * Almacena un frame en caché
   */
  set(cameraId, frame, options = {}) {
    const { resolution = 'original', timestamp = Date.now() } = options
    
    // Obtener o crear caché para esta cámara
    if (!this.caches.has(cameraId)) {
      this.caches.set(cameraId, {
        frames: [],
        resolutions: new Map(),
        lastAccess: Date.now()
      })
    }
    
    const cache = this.caches.get(cameraId)
    
    // Crear entrada de frame
    const frameEntry = {
      data: frame,
      timestamp,
      resolution,
      size: frame.length || 0,
      createdAt: Date.now()
    }
    
    // Almacenar en buffer circular
    if (this.config.enableMultiResolution) {
      if (!cache.resolutions.has(resolution)) {
        cache.resolutions.set(resolution, [])
      }
      const resBuffer = cache.resolutions.get(resolution)
      resBuffer.push(frameEntry)
      
      // Evictar si excede límite
      while (resBuffer.length > this.config.maxFramesPerCamera) {
        resBuffer.shift()
        this.stats.evictions++
      }
    } else {
      cache.frames.push(frameEntry)
      
      while (cache.frames.length > this.config.maxFramesPerCamera) {
        cache.frames.shift()
        this.stats.evictions++
      }
    }
    
    cache.lastAccess = Date.now()
    this.stats.totalFramesCached++
    this.stats.memoryUsed += frameEntry.size
    
    // Emitir evento
    this.emit('frameAdded', { cameraId, resolution, size: frameEntry.size })
  }

  /**
   * Obtiene el último frame de una cámara
   */
  getLatest(cameraId, resolution = 'original') {
    const cache = this.caches.get(cameraId)
    
    if (!cache) {
      this.stats.totalMisses++
      return null
    }
    
    cache.lastAccess = Date.now()
    
    let frames
    if (this.config.enableMultiResolution) {
      frames = cache.resolutions.get(resolution)
      
      // Fallback a original si no existe la resolución
      if (!frames || frames.length === 0) {
        frames = cache.resolutions.get('original')
      }
    } else {
      frames = cache.frames
    }
    
    if (!frames || frames.length === 0) {
      this.stats.totalMisses++
      return null
    }
    
    const latest = frames[frames.length - 1]
    
    // Verificar TTL
    if (Date.now() - latest.createdAt > this.config.frameTTL) {
      this.stats.totalMisses++
      return null
    }
    
    this.stats.totalHits++
    return latest.data
  }

  /**
   * Obtiene múltiples frames recientes
   */
  getRecent(cameraId, count = 5, resolution = 'original') {
    const cache = this.caches.get(cameraId)
    
    if (!cache) return []
    
    cache.lastAccess = Date.now()
    
    let frames
    if (this.config.enableMultiResolution) {
      frames = cache.resolutions.get(resolution) || cache.resolutions.get('original') || []
    } else {
      frames = cache.frames
    }
    
    // Obtener últimos N frames válidos
    const now = Date.now()
    return frames
      .slice(-count)
      .filter(f => now - f.createdAt <= this.config.frameTTL)
      .map(f => f.data)
  }

  /**
   * Verifica si hay frames disponibles
   */
  hasFrames(cameraId) {
    const cache = this.caches.get(cameraId)
    if (!cache) return false
    
    if (this.config.enableMultiResolution) {
      for (const [, frames] of cache.resolutions) {
        if (frames.length > 0) return true
      }
      return false
    }
    
    return cache.frames.length > 0
  }

  /**
   * Limpia frames expirados
   */
  cleanup() {
    const now = Date.now()
    let cleaned = 0
    let freedMemory = 0
    
    for (const [cameraId, cache] of this.caches) {
      if (this.config.enableMultiResolution) {
        for (const [resolution, frames] of cache.resolutions) {
          const validFrames = frames.filter(f => {
            const isValid = now - f.createdAt <= this.config.frameTTL
            if (!isValid) {
              cleaned++
              freedMemory += f.size
            }
            return isValid
          })
          cache.resolutions.set(resolution, validFrames)
        }
      } else {
        const validFrames = cache.frames.filter(f => {
          const isValid = now - f.createdAt <= this.config.frameTTL
          if (!isValid) {
            cleaned++
            freedMemory += f.size
          }
          return isValid
        })
        cache.frames = validFrames
      }
      
      // Eliminar cache de cámara si está vacío y sin acceso reciente
      if (!this.hasFrames(cameraId) && now - cache.lastAccess > 60000) {
        this.caches.delete(cameraId)
      }
    }
    
    if (cleaned > 0) {
      this.stats.memoryUsed = Math.max(0, this.stats.memoryUsed - freedMemory)
      this.emit('cleanup', { cleaned, freedMemory })
    }
  }

  /**
   * Invalida caché de una cámara
   */
  invalidate(cameraId) {
    if (this.caches.has(cameraId)) {
      this.caches.delete(cameraId)
      this.emit('invalidated', { cameraId })
    }
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    const hitRate = this.stats.totalHits + this.stats.totalMisses > 0
      ? (this.stats.totalHits / (this.stats.totalHits + this.stats.totalMisses) * 100).toFixed(1)
      : 0
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      activeCameras: this.caches.size,
      memoryUsedFormatted: this.formatBytes(this.stats.memoryUsed)
    }
  }

  /**
   * Obtiene estado por cámara
   */
  getCameraStats(cameraId) {
    const cache = this.caches.get(cameraId)
    
    if (!cache) return null
    
    const stats = {
      cameraId,
      lastAccess: cache.lastAccess,
      resolutions: {}
    }
    
    if (this.config.enableMultiResolution) {
      for (const [resolution, frames] of cache.resolutions) {
        stats.resolutions[resolution] = {
          frameCount: frames.length,
          oldestFrame: frames[0]?.createdAt,
          newestFrame: frames[frames.length - 1]?.createdAt,
          totalSize: frames.reduce((sum, f) => sum + f.size, 0)
        }
      }
    } else {
      stats.frameCount = cache.frames.length
    }
    
    return stats
  }

  /**
   * Actualiza configuración
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig)
    console.log('⚙️ Configuración de FrameCache actualizada')
  }

  /**
   * Formatea bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Singleton
const frameCache = new FrameCache()

export default frameCache
