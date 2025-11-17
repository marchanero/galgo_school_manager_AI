import axios from 'axios'

// Configuración de la API de EMQX - usa URL relativa para que pase por el proxy
const EMQX_API_BASE = '/api/v5'
const EMQX_API_KEY = import.meta.env.VITE_EMQX_API_KEY
const EMQX_API_SECRET = import.meta.env.VITE_EMQX_API_SECRET

// Crear instancia de axios
const emqxClient = axios.create({
  baseURL: EMQX_API_BASE
})

// Interceptor para agregar autenticación con API Key
emqxClient.interceptors.request.use(config => {
  if (EMQX_API_KEY && EMQX_API_SECRET) {
    const credentials = btoa(`${EMQX_API_KEY}:${EMQX_API_SECRET}`)
    config.headers.Authorization = `Basic ${credentials}`
  }
  return config
})

export const emqxApi = {
  /**
   * Obtener información general del cluster
   */
  async getClusterInfo() {
    try {
      const response = await emqxClient.get('/stats')
      return response.data
    } catch (error) {
      console.error('Error obteniendo información del cluster:', error)
      throw error
    }
  },

  /**
   * Obtener lista de clientes conectados
   */
  async getConnectedClients(page = 1, limit = 100) {
    try {
      const response = await emqxClient.get('/clients', {
        params: {
          page,
          limit
        }
      })
      return response.data
    } catch (error) {
      console.error('Error obteniendo clientes conectados:', error)
      throw error
    }
  },

  /**
   * Obtener detalles de un cliente específico
   */
  async getClientDetails(clientId) {
    try {
      const response = await emqxClient.get(`/clients/${clientId}`)
      return response.data
    } catch (error) {
      console.error(`Error obteniendo detalles del cliente ${clientId}:`, error)
      throw error
    }
  },

  /**
   * Obtener lista de suscripciones
   */
  async getSubscriptions(page = 1, limit = 100) {
    try {
      const response = await emqxClient.get('/subscriptions', {
        params: {
          page,
          limit
        }
      })
      return response.data
    } catch (error) {
      console.error('Error obteniendo suscripciones:', error)
      throw error
    }
  },

  /**
   * Obtener información de un nodo específico
   */
  async getNodeInfo(node) {
    try {
      const response = await emqxClient.get(`/nodes/${node}`)
      return response.data
    } catch (error) {
      console.error(`Error obteniendo información del nodo ${node}:`, error)
      throw error
    }
  },

  /**
   * Obtener lista de todos los nodos
   */
  async getNodes() {
    try {
      const response = await emqxClient.get('/nodes')
      return response.data
    } catch (error) {
      console.error('Error obteniendo nodos:', error)
      throw error
    }
  },

  /**
   * Obtener estadísticas de tópicos
   */
  async getTopicMetrics() {
    try {
      const response = await emqxClient.get('/stats')
      return response.data
    } catch (error) {
      console.error('Error obteniendo métricas de tópicos:', error)
      throw error
    }
  },

  /**
   * Obtener lista de tópicos activos
   */
  async getTopics(page = 1, limit = 100) {
    try {
      const response = await emqxClient.get('/topics', {
        params: {
          page,
          limit
        }
      })
      return response.data
    } catch (error) {
      console.error('Error obteniendo tópicos:', error)
      throw error
    }
  },

  /**
   * Obtener rutas de tópicos (routes)
   */
  async getRoutes(page = 1, limit = 100) {
    try {
      const response = await emqxClient.get('/routes', {
        params: {
          page,
          limit
        }
      })
      return response.data
    } catch (error) {
      console.error('Error obteniendo rutas:', error)
      throw error
    }
  },

  /**
   * Obtener métricas específicas de un tópico
   */
  async getTopicSpecificMetrics(topic) {
    try {
      const response = await emqxClient.get(`/topic-metrics/${encodeURIComponent(topic)}`)
      return response.data
    } catch (error) {
      console.error(`Error obteniendo métricas del tópico ${topic}:`, error)
      throw error
    }
  },

  /**
   * Obtener suscriptores de un tópico específico
   */
  async getTopicSubscribers(topic) {
    try {
      const response = await emqxClient.get(`/topics/${encodeURIComponent(topic)}/subscribers`)
      return response.data
    } catch (error) {
      console.error(`Error obteniendo suscriptores del tópico ${topic}:`, error)
      throw error
    }
  },

  /**
   * Obtener información detallada de un tópico
   */
  async getTopicDetails(topic) {
    try {
      const response = await emqxClient.get(`/topics/${encodeURIComponent(topic)}`)
      return response.data
    } catch (error) {
      console.error(`Error obteniendo detalles del tópico ${topic}:`, error)
      throw error
    }
  },

  /**
   * Obtener métricas de mensajes por segundo
   */
  async getMessageRateMetrics() {
    try {
      const response = await emqxClient.get('/stats')
      return {
        messages_received: response.data.messages?.received || 0,
        messages_sent: response.data.messages?.sent || 0,
        messages_dropped: response.data.messages?.dropped || 0,
        messages_retained: response.data.messages?.retained || 0,
        messages_delivered: response.data.messages?.delivered || 0,
        messages_acked: response.data.messages?.acked || 0
      }
    } catch (error) {
      console.error('Error obteniendo métricas de mensajes:', error)
      throw error
    }
  },

  /**
   * Obtener información de conexiones
   */
  async getConnectionMetrics() {
    try {
      const response = await emqxClient.get('/stats')
      return {
        connections_active: response.data.connections?.active || 0,
        connections_inactive: response.data.connections?.inactive || 0,
        connections_max: response.data.connections?.max || 0,
        sessions_active: response.data.sessions?.active || 0,
        sessions_persistent: response.data.sessions?.persistent || 0
      }
    } catch (error) {
      console.error('Error obteniendo métricas de conexiones:', error)
      throw error
    }
  }
}
