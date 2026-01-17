/**
 * MockAdapter - Adaptador simulado para testing y desarrollo
 * 
 * Simula transferencias sin servidor remoto real
 */
class MockAdapter {
  constructor(config = {}) {
    this.config = {
      mockCapacityTB: config.mockCapacityTB || 6,
      mockSpeedMBps: config.mockSpeedMBps || 125
    }
  }

  /**
   * Formatea bytes a string legible
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Simula transferencia con progreso artificial
   */
  async transfer(localPath, remotePath, onProgress = null) {
    console.log('🔧 Modo MOCK: simulando transferencia...')
    
    const totalSteps = 20
    const totalSize = 1024 * 1024 * 1024 * 5.2 // 5.2 GB simulados
    
    for (let i = 1; i <= totalSteps; i++) {
      await new Promise(r => setTimeout(r, 250)) // 5 segundos total
      
      const percent = Math.round((i / totalSteps) * 100)
      const transferred = Math.round((totalSize * percent) / 100)
      
      const progressData = {
        transferred: this._formatBytes(transferred),
        total: this._formatBytes(totalSize),
        percent,
        speed: `${this.config.mockSpeedMBps} MB/s`,
        eta: `${Math.ceil((totalSteps - i) * 0.25)}s`,
        timestamp: new Date().toISOString()
      }
      
      if (onProgress) {
        onProgress(progressData)
      }
    }
    
    return { success: true, isMock: true }
  }

  /**
   * Simula información de espacio remoto
   */
  getRemoteDiskInfo() {
    const totalTB = this.config.mockCapacityTB
    const totalGB = totalTB * 1024
    const usePercent = Math.floor(Math.random() * 30) + 10
    const usedGB = Math.floor((totalGB * usePercent) / 100)
    const freeGB = totalGB - usedGB
    
    return {
      available: true,
      isMock: true,
      total: totalGB * 1024 * 1024 * 1024,
      used: usedGB * 1024 * 1024 * 1024,
      free: freeGB * 1024 * 1024 * 1024,
      totalGB,
      usedGB,
      freeGB,
      usePercent,
      canTransfer: usePercent < 85,
      isCritical: usePercent >= 95,
      lastChecked: new Date().toISOString()
    }
  }

  /**
   * Mock no requiere configuración
   */
  async setupRemote() {
    console.log('🔧 Mock adapter: no requiere configuración')
    return true
  }

  /**
   * Nombre del adaptador
   */
  getName() {
    return 'mock'
  }
}

export default MockAdapter
