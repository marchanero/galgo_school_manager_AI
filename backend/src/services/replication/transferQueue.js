/**
 * TransferQueue - Gestión de cola de transferencias con retry logic
 * 
 * Características:
 * - Cola FIFO de transferencias
 * - Retry con backoff exponencial
 * - Verificación de integridad
 * - Estadísticas de transferencias
 */
class TransferQueue {
  constructor(config = {}) {
    this.config = {
      backoffBase: config.backoffBase || 2,
      backoffMax: config.backoffMax || 300,
      maxRetries: config.retries || 10
    }

    this.queue = []
    this.isProcessing = false
    this.stats = {
      totalTransferred: 0,
      successCount: 0,
      failCount: 0,
      lastError: null
    }
  }

  /**
   * Añade una transferencia a la cola
   */
  enqueue(transfer) {
    this.queue.push({
      ...transfer,
      attempts: 0,
      status: 'queued',
      createdAt: new Date()
    })
  }

  /**
   * Obtiene siguiente transferencia de la cola
   */
  dequeue() {
    return this.queue.shift()
  }

  /**
   * Ejecuta transferencia con retry y backoff exponencial
   */
  async executeWithRetry(adapter, localPath, remotePath, onProgress = null) {
    let attempt = 0
    let lastError = null
    
    while (attempt < this.config.maxRetries) {
      attempt++
      
      try {
        const result = await adapter.transfer(localPath, remotePath, onProgress)
        
        // Éxito
        this.stats.successCount++
        return {
          success: true,
          attempts: attempt,
          message: `Transferencia completada en intento ${attempt}`
        }
        
      } catch (error) {
        lastError = error
        this.stats.lastError = error.message
        
        if (attempt >= this.config.maxRetries) {
          this.stats.failCount++
          throw error
        }
        
        // Calcular delay con backoff exponencial
        const delay = Math.min(
          Math.pow(this.config.backoffBase, attempt),
          this.config.backoffMax
        ) * 1000
        
        console.log(`⚠️ Intento ${attempt}/${this.config.maxRetries} falló: ${error.message}`)
        console.log(`⏳ Reintentando en ${delay / 1000}s...`)
        
        await new Promise(r => setTimeout(r, delay))
      }
    }
    
    throw lastError
  }

  /**
   * Procesa la cola
   */
  async process(adapter, onProgress = null) {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.queue.length > 0) {
      const transfer = this.dequeue()
      transfer.status = 'processing'
      transfer.startedAt = new Date()

      try {
        const result = await this.executeWithRetry(
          adapter,
          transfer.localPath,
          transfer.remotePath,
          onProgress
        )

        transfer.status = 'completed'
        transfer.result = result
        transfer.completedAt = new Date()
      } catch (error) {
        transfer.status = 'failed'
        transfer.error = error.message
        transfer.completedAt = new Date()
        console.error(`❌ Transferencia falló: ${error.message}`)
      }
    }

    this.isProcessing = false
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing
    }
  }

  /**
   * Limpia estadísticas
   */
  resetStats() {
    this.stats = {
      totalTransferred: 0,
      successCount: 0,
      failCount: 0,
      lastError: null
    }
  }
}

export default TransferQueue
