const API_BASE_URL = '/api'

export const api = {
  // Cámaras
  async getCameras() {
    const response = await fetch(`${API_BASE_URL}/cameras`)
    if (!response.ok) throw new Error('Error al obtener cámaras')
    return response.json()
  },

  async getCamera(id) {
    const response = await fetch(`${API_BASE_URL}/cameras/${id}`)
    if (!response.ok) throw new Error('Cámara no encontrada')
    return response.json()
  },

  async createCamera(data) {
    const response = await fetch(`${API_BASE_URL}/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Error al crear cámara')
    return response.json()
  },

  async updateCamera(id, data) {
    const response = await fetch(`${API_BASE_URL}/cameras/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Error al actualizar cámara')
    return response.json()
  },

  async deleteCamera(id) {
    const response = await fetch(`${API_BASE_URL}/cameras/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Error al eliminar cámara')
    return response.json()
  },

  async testCamera(id) {
    const response = await fetch(`${API_BASE_URL}/cameras/${id}/test`)
    if (!response.ok) throw new Error('Error al probar cámara')
    return response.json()
  },

  // Streams
  async getStreamStatus() {
    const response = await fetch(`${API_BASE_URL}/streams/status`)
    if (!response.ok) throw new Error('Error al obtener estado')
    return response.json()
  },

  async getHealth() {
    const response = await fetch(`${API_BASE_URL}/health`)
    if (!response.ok) throw new Error('Servidor no disponible')
    return response.json()
  },

  // Replicación
  async getReplicationStats() {
    const response = await fetch(`${API_BASE_URL}/replication/stats`)
    if (!response.ok) throw new Error('Error al obtener estadísticas de replicación')
    return response.json()
  },

  async getReplicationConfig() {
    const response = await fetch(`${API_BASE_URL}/replication/config`)
    if (!response.ok) throw new Error('Error al obtener configuración de replicación')
    return response.json()
  },

  async saveReplicationConfig(config) {
    const response = await fetch(`${API_BASE_URL}/replication/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    if (!response.ok) throw new Error('Error al guardar configuración de replicación')
    return response.json()
  },

  async startReplication() {
    const response = await fetch(`${API_BASE_URL}/replication/start`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Error al iniciar replicación')
    return response.json()
  },

  async getReplicationDiskInfo() {
    const response = await fetch(`${API_BASE_URL}/replication/disk-info`)
    if (!response.ok) throw new Error('Error al obtener información del disco local')
    return response.json()
  },

  // Almacenamiento
  async getStorageStatus() {
    const response = await fetch(`${API_BASE_URL}/storage/status`)
    if (!response.ok) throw new Error('Error al obtener estado de almacenamiento')
    return response.json()
  },

  async getStorageSummary() {
    const response = await fetch(`${API_BASE_URL}/storage/summary`)
    if (!response.ok) throw new Error('Error al obtener resumen de almacenamiento')
    return response.json()
  },

  async getStorageConfig() {
    const response = await fetch(`${API_BASE_URL}/storage/config`)
    if (!response.ok) throw new Error('Error al obtener configuración de almacenamiento')
    return response.json()
  },

  async updateStorageConfig(config) {
    const response = await fetch(`${API_BASE_URL}/storage/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    if (!response.ok) throw new Error('Error al actualizar configuración de almacenamiento')
    return response.json()
  },

  async getStorageRecordings(filters = {}) {
    const params = new URLSearchParams(filters)
    const response = await fetch(`${API_BASE_URL}/storage/recordings?${params}`)
    if (!response.ok) throw new Error('Error al obtener grabaciones')
    return response.json()
  },

  async triggerStorageCleanup() {
    const response = await fetch(`${API_BASE_URL}/storage/cleanup`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Error al iniciar limpieza')
    return response.json()
  },

  async checkStorageSpace() {
    const response = await fetch(`${API_BASE_URL}/storage/check`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Error al verificar espacio')
    return response.json()
  },

  async setRetentionPolicy(scenario, days) {
    const response = await fetch(`${API_BASE_URL}/storage/retention/${encodeURIComponent(scenario)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days })
    })
    if (!response.ok) throw new Error('Error al establecer política de retención')
    return response.json()
  },

  async deleteScenarioRecordings(scenario, olderThanDays = 0) {
    const params = olderThanDays > 0 ? `?olderThan=${olderThanDays}` : ''
    const response = await fetch(`${API_BASE_URL}/storage/scenario/${encodeURIComponent(scenario)}${params}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Error al eliminar grabaciones del escenario')
    return response.json()
  },

  async deleteCameraRecordings(cameraId, olderThanDays = 0) {
    const params = olderThanDays > 0 ? `?olderThan=${olderThanDays}` : ''
    const response = await fetch(`${API_BASE_URL}/storage/camera/${cameraId}${params}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Error al eliminar grabaciones de la cámara')
    return response.json()
  },

  // Grabaciones Resilientes
  async getRecordingsStatus() {
    const response = await fetch(`${API_BASE_URL}/recordings/status`)
    if (!response.ok) throw new Error('Error al obtener estado de grabaciones')
    return response.json()
  },

  async getRecordingStats(cameraId) {
    const response = await fetch(`${API_BASE_URL}/recordings/${cameraId}/stats`)
    if (!response.ok) throw new Error('Error al obtener estadísticas')
    return response.json()
  },

  async startRecording(data) {
    const response = await fetch(`${API_BASE_URL}/recordings/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Error al iniciar grabación')
    return response.json()
  },

  async stopRecording(cameraId) {
    const response = await fetch(`${API_BASE_URL}/recordings/${cameraId}/stop`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Error al detener grabación')
    return response.json()
  },

  async stopAllRecordings() {
    const response = await fetch(`${API_BASE_URL}/recordings/stop-all`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Error al detener grabaciones')
    return response.json()
  },

  async updateRecordingsConfig(config) {
    const response = await fetch(`${API_BASE_URL}/recordings/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    if (!response.ok) throw new Error('Error al actualizar configuración')
    return response.json()
  },

  async isRecording(cameraId) {
    const response = await fetch(`${API_BASE_URL}/recordings/${cameraId}/is-recording`)
    if (!response.ok) throw new Error('Error al verificar grabación')
    return response.json()
  },

  // Post-procesamiento de Video
  async getProcessingStatus() {
    const response = await fetch(`${API_BASE_URL}/processing/status`)
    if (!response.ok) throw new Error('Error al obtener estado de procesamiento')
    return response.json()
  },

  async getProcessingConfig() {
    const response = await fetch(`${API_BASE_URL}/processing/config`)
    if (!response.ok) throw new Error('Error al obtener configuración')
    return response.json()
  },

  async updateProcessingConfig(config) {
    const response = await fetch(`${API_BASE_URL}/processing/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    if (!response.ok) throw new Error('Error al actualizar configuración')
    return response.json()
  },

  async generateThumbnail(data) {
    const response = await fetch(`${API_BASE_URL}/processing/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Error al generar thumbnail')
    return response.json()
  },

  async generateBatchThumbnails(options = {}) {
    const response = await fetch(`${API_BASE_URL}/processing/thumbnails/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })
    if (!response.ok) throw new Error('Error al generar thumbnails')
    return response.json()
  },

  async getProcessingThumbnails() {
    const response = await fetch(`${API_BASE_URL}/processing/thumbnails`)
    if (!response.ok) throw new Error('Error al obtener thumbnails')
    return response.json()
  },

  async compressVideo(data) {
    const response = await fetch(`${API_BASE_URL}/processing/compress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Error al comprimir video')
    return response.json()
  },

  async compressOldVideos(options = {}) {
    const response = await fetch(`${API_BASE_URL}/processing/compress/old`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })
    if (!response.ok) throw new Error('Error al comprimir videos antiguos')
    return response.json()
  },

  async extractClip(data) {
    const response = await fetch(`${API_BASE_URL}/processing/clip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Error al extraer clip')
    return response.json()
  },

  async getProcessingClips() {
    const response = await fetch(`${API_BASE_URL}/processing/clips`)
    if (!response.ok) throw new Error('Error al obtener clips')
    return response.json()
  },

  async getVideoInfo(videoPath) {
    const response = await fetch(`${API_BASE_URL}/processing/video-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath })
    })
    if (!response.ok) throw new Error('Error al obtener info de video')
    return response.json()
  },

  async cancelProcessingTask(taskId) {
    const response = await fetch(`${API_BASE_URL}/processing/task/${taskId}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Error al cancelar tarea')
    return response.json()
  }
}

export default api
