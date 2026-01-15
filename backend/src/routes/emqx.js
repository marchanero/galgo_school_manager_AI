/**
 * EMQX Proxy Routes
 * Proxy para la API de EMQX - evita problemas de CORS
 */

import express from 'express'
import axios from 'axios'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

// Configuración de EMQX por defecto
let EMQX_CONFIG = {
  broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
  apiUrl: process.env.EMQX_API_URL || 'http://localhost:18083/api/v5',
  apiKey: process.env.EMQX_API_KEY || 'admin',
  apiSecret: process.env.EMQX_API_SECRET || 'galgo2526',
  hasApi: true // Indica si el broker tiene API REST accesible
}

/**
 * Detectar si un broker tiene API accesible
 * Brokers públicos como broker.emqx.io no tienen API
 */
function isLocalBroker(brokerUrl) {
  if (!brokerUrl) return false
  return brokerUrl.includes('localhost') || 
         brokerUrl.includes('127.0.0.1') || 
         brokerUrl.includes('100.82.') ||  // Tailscale
         brokerUrl.includes('192.168.')    // Red local
}

// Cargar configuración de la base de datos al iniciar
async function loadConfigFromDB() {
  try {
    const dbConfig = await prisma.mqttConfig.findFirst({ where: { isActive: true } })
    if (dbConfig) {
      const hasApi = isLocalBroker(dbConfig.broker)
      EMQX_CONFIG = {
        broker: dbConfig.broker,
        apiUrl: hasApi ? dbConfig.broker.replace('mqtt://', 'http://').replace(':1883', ':18083/api/v5') : null,
        apiKey: dbConfig.username,
        apiSecret: dbConfig.password,
        hasApi
      }
      console.log(`✅ Configuración EMQX cargada: ${dbConfig.name} (API: ${hasApi ? 'Sí' : 'No'})`)
    }
  } catch (error) {
    console.log('⚠️ Usando configuración EMQX por defecto:', error.message)
  }
}
loadConfigFromDB()

/**
 * Cliente axios para EMQX con Basic Auth (API Key)
 * Las API Keys de EMQX usan Basic Auth: apiKey:apiSecret
 */
function getEmqxClient() {
  return axios.create({
    baseURL: EMQX_CONFIG.apiUrl,
    timeout: 10000,
    auth: {
      username: EMQX_CONFIG.apiKey,
      password: EMQX_CONFIG.apiSecret
    },
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

/**
 * GET /api/emqx/stats
 * Obtener estadísticas del cluster
 */
router.get('/stats', async (req, res) => {
  if (!EMQX_CONFIG.hasApi) {
    return res.json([{ node: 'external', 'connections.count': 0, 'subscriptions.count': 0, apiAvailable: false }])
  }
  try {
    const response = await getEmqxClient().get('/stats')
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /stats:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo estadísticas de EMQX',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/clients
 * Obtener clientes conectados
 */
router.get('/clients', async (req, res) => {
  if (!EMQX_CONFIG.hasApi) return res.json({ data: [], meta: { count: 0 } })
  try {
    const response = await getEmqxClient().get('/clients', { params: req.query })
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /clients:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo clientes de EMQX',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/clients/:clientId
 * Obtener detalles de un cliente específico
 */
router.get('/clients/:clientId', async (req, res) => {
  try {
    const response = await getEmqxClient().get(`/clients/${encodeURIComponent(req.params.clientId)}`)
    res.json(response.data)
  } catch (error) {
    console.error(`Error proxy EMQX /clients/${req.params.clientId}:`, error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo detalles del cliente',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/subscriptions
 * Obtener suscripciones activas
 */
router.get('/subscriptions', async (req, res) => {
  if (!EMQX_CONFIG.hasApi) return res.json({ data: [], meta: { count: 0 } })
  try {
    const response = await getEmqxClient().get('/subscriptions', { params: req.query })
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /subscriptions:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo suscripciones de EMQX',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/nodes
 * Obtener nodos del cluster
 */
router.get('/nodes', async (req, res) => {
  if (!EMQX_CONFIG.hasApi) return res.json([])
  try {
    const response = await getEmqxClient().get('/nodes')
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /nodes:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo nodos de EMQX',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/topics
 * Obtener tópicos activos
 */
router.get('/topics', async (req, res) => {
  if (!EMQX_CONFIG.hasApi) return res.json({ data: [], meta: { count: 0 } })
  try {
    const response = await getEmqxClient().get('/topics', { params: req.query })
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /topics:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo tópicos de EMQX',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/routes
 * Obtener rutas de mensajes
 */
router.get('/routes', async (req, res) => {
  try {
    const response = await getEmqxClient().get('/routes', { params: req.query })
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /routes:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo rutas de EMQX',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/health
 * Verificar conectividad con EMQX
 */
router.get('/health', async (req, res) => {
  // Para brokers públicos sin API, reportar como conectado (solo MQTT)
  if (!EMQX_CONFIG.hasApi) {
    return res.json({
      status: 'mqtt_only',
      broker: EMQX_CONFIG.broker,
      apiAvailable: false,
      timestamp: new Date().toISOString()
    })
  }
  try {
    const response = await getEmqxClient().get('/stats')
    res.json({
      status: 'connected',
      emqxUrl: EMQX_CONFIG.apiUrl,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(503).json({
      status: 'disconnected',
      emqxUrl: EMQX_CONFIG.apiUrl,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * GET /api/emqx/servers
 * Listar todos los servidores EMQX configurados
 */
router.get('/servers', async (req, res) => {
  try {
    const servers = await prisma.mqttConfig.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    })
    
    res.json({
      success: true,
      data: servers.map(s => ({
        id: s.id,
        name: s.name,
        broker: s.broker,
        username: s.username,
        clientId: s.clientId,
        isActive: s.isActive,
        isDefault: s.isDefault,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }))
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/emqx/servers
 * Crear nuevo servidor EMQX
 */
router.post('/servers', async (req, res) => {
  try {
    const { name, broker, username, password, clientId, setActive } = req.body
    
    if (!name || !broker) {
      return res.status(400).json({
        success: false,
        error: 'Nombre y broker son requeridos'
      })
    }
    
    // Si se activa este servidor, desactivar los demás
    if (setActive) {
      await prisma.mqttConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      })
    }
    
    const newServer = await prisma.mqttConfig.create({
      data: {
        name,
        broker,
        username: username || 'admin',
        password: password || 'galgo2526',
        clientId: clientId || `camera_rtsp_${Date.now()}`,
        isActive: !!setActive,
        isDefault: false
      }
    })
    
    // Si es activo, actualizar configuración en memoria
    if (setActive) {
      EMQX_CONFIG = {
        broker: newServer.broker,
        apiUrl: newServer.broker.replace('mqtt://', 'http://').replace(':1883', ':18083/api/v5'),
        apiKey: newServer.username,
        apiSecret: newServer.password
      }
      console.log('✅ Nuevo servidor EMQX activado:', newServer.name)
    }
    
    res.json({
      success: true,
      message: 'Servidor creado correctamente',
      data: newServer
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * PUT /api/emqx/servers/:id
 * Actualizar servidor EMQX existente
 */
router.put('/servers/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, broker, username, password, clientId } = req.body
    
    const updated = await prisma.mqttConfig.update({
      where: { id: parseInt(id) },
      data: {
        name,
        broker,
        username,
        password,
        clientId
      }
    })
    
    // Si es el servidor activo, actualizar configuración en memoria
    if (updated.isActive) {
      EMQX_CONFIG = {
        broker: updated.broker,
        apiUrl: updated.broker.replace('mqtt://', 'http://').replace(':1883', ':18083/api/v5'),
        apiKey: updated.username,
        apiSecret: updated.password
      }
    }
    
    res.json({
      success: true,
      message: 'Servidor actualizado',
      data: updated
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * DELETE /api/emqx/servers/:id
 * Eliminar servidor EMQX
 */
router.delete('/servers/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const server = await prisma.mqttConfig.findUnique({ where: { id: parseInt(id) } })
    
    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Servidor no encontrado'
      })
    }
    
    if (server.isDefault) {
      return res.status(400).json({
        success: false,
        error: 'No se puede eliminar el servidor por defecto'
      })
    }
    
    await prisma.mqttConfig.delete({ where: { id: parseInt(id) } })
    
    res.json({
      success: true,
      message: 'Servidor eliminado'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/emqx/servers/:id/activate
 * Activar un servidor EMQX (y desactivar los demás)
 */
router.post('/servers/:id/activate', async (req, res) => {
  try {
    const { id } = req.params
    
    // Desactivar todos
    await prisma.mqttConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    })
    
    // Activar el seleccionado
    const activated = await prisma.mqttConfig.update({
      where: { id: parseInt(id) },
      data: { isActive: true }
    })
    
    // Actualizar configuración en memoria
    EMQX_CONFIG = {
      broker: activated.broker,
      apiUrl: activated.broker.replace('mqtt://', 'http://').replace(':1883', ':18083/api/v5'),
      apiKey: activated.username,
      apiSecret: activated.password
    }
    
    // Notificar al servicio MQTT para reconectar
    try {
      const mqttService = (await import('../services/mqttService.js')).default
      await mqttService.updateConfig({
        broker: activated.broker,
        username: activated.username,
        password: activated.password,
        clientId: activated.clientId
      })
    } catch (e) {
      console.log('⚠️ No se pudo reconectar MQTT automáticamente:', e.message)
    }
    
    console.log('✅ Servidor EMQX activado:', activated.name)
    
    res.json({
      success: true,
      message: `Servidor "${activated.name}" activado`,
      data: activated
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/emqx/config
 * Obtener configuración actual de conexión (servidor activo)
 */
router.get('/config', async (req, res) => {
  try {
    // Intentar obtener de la base de datos
    const dbConfig = await prisma.mqttConfig.findFirst({ where: { isActive: true } })
    
    res.json({
      success: true,
      data: {
        id: dbConfig?.id || null,
        name: dbConfig?.name || 'Por Defecto',
        broker: EMQX_CONFIG.broker,
        apiUrl: EMQX_CONFIG.apiUrl,
        apiKey: EMQX_CONFIG.apiKey,
        apiSecret: dbConfig?.password || EMQX_CONFIG.apiSecret,
        clientId: dbConfig?.clientId || 'camera_rtsp_server',
        isPersisted: !!dbConfig
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * PUT /api/emqx/config
 * Guardar configuración de conexión
 */
router.put('/config', async (req, res) => {
  try {
    const { broker, apiKey, apiSecret, clientId } = req.body
    
    if (!broker) {
      return res.status(400).json({
        success: false,
        error: 'El broker es requerido'
      })
    }
    
    // Desactivar configuraciones anteriores
    await prisma.mqttConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    })
    
    // Crear nueva configuración
    const newConfig = await prisma.mqttConfig.create({
      data: {
        broker,
        username: apiKey || 'admin',
        password: apiSecret || 'galgo2526',
        clientId: clientId || 'camera_rtsp_server',
        isActive: true
      }
    })
    
    // Actualizar configuración en memoria
    EMQX_CONFIG = {
      broker,
      apiUrl: broker.replace('mqtt://', 'http://').replace(':1883', ':18083/api/v5'),
      apiKey: apiKey || 'admin',
      apiSecret: apiSecret || 'galgo2526'
    }
    
    console.log('✅ Configuración EMQX guardada:', { broker, apiKey })
    
    res.json({
      success: true,
      message: 'Configuración guardada correctamente',
      data: {
        id: newConfig.id,
        broker: newConfig.broker,
        apiKey: newConfig.username,
        clientId: newConfig.clientId
      }
    })
  } catch (error) {
    console.error('Error guardando configuración EMQX:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/emqx/test-connection
 * Probar conexión con la configuración proporcionada
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { broker, apiKey, apiSecret } = req.body
    
    const testApiUrl = broker.replace('mqtt://', 'http://').replace(':1883', ':18083/api/v5')
    
    const testClient = axios.create({
      baseURL: testApiUrl,
      timeout: 5000,
      auth: {
        username: apiKey || 'admin',
        password: apiSecret || 'galgo2526'
      }
    })
    
    const response = await testClient.get('/stats')
    
    res.json({
      success: true,
      message: 'Conexión exitosa',
      data: {
        broker,
        apiUrl: testApiUrl,
        stats: response.data
      }
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'No se pudo conectar con el broker',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/listeners
 * Obtener listeners configurados
 */
router.get('/listeners', async (req, res) => {
  try {
    const response = await getEmqxClient().get('/listeners')
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /listeners:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo listeners de EMQX',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/authentication
 * Obtener configuración de autenticación
 */
router.get('/authentication', async (req, res) => {
  try {
    const response = await getEmqxClient().get('/authentication')
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /authentication:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo autenticación de EMQX',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/authorization/sources
 * Obtener fuentes de autorización
 */
router.get('/authorization/sources', async (req, res) => {
  try {
    const response = await getEmqxClient().get('/authorization/sources')
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /authorization/sources:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo fuentes de autorización',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/metrics
 * Obtener métricas detalladas
 */
router.get('/metrics', async (req, res) => {
  try {
    const response = await getEmqxClient().get('/metrics')
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /metrics:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo métricas de EMQX',
      message: error.message
    })
  }
})

/**
 * DELETE /api/emqx/clients/:clientId
 * Desconectar un cliente
 */
router.delete('/clients/:clientId', async (req, res) => {
  try {
    await getEmqxClient().delete(`/clients/${encodeURIComponent(req.params.clientId)}`)
    res.json({ success: true, message: 'Cliente desconectado' })
  } catch (error) {
    console.error(`Error desconectando cliente ${req.params.clientId}:`, error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error desconectando cliente',
      message: error.message
    })
  }
})

/**
 * POST /api/emqx/publish
 * Publicar mensaje a un topic
 */
router.post('/publish', async (req, res) => {
  try {
    const { topic, payload, qos = 0, retain = false } = req.body
    
    if (!topic || payload === undefined) {
      return res.status(400).json({
        error: 'Se requiere topic y payload'
      })
    }
    
    const response = await getEmqxClient().post('/publish', {
      topic,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      qos,
      retain
    })
    
    res.json({ success: true, data: response.data })
  } catch (error) {
    console.error('Error publicando mensaje:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error publicando mensaje',
      message: error.message
    })
  }
})

/**
 * GET /api/emqx/alarms
 * Obtener alarmas activas
 */
router.get('/alarms', async (req, res) => {
  try {
    const response = await getEmqxClient().get('/alarms')
    res.json(response.data)
  } catch (error) {
    console.error('Error proxy EMQX /alarms:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Error obteniendo alarmas de EMQX',
      message: error.message
    })
  }
})

export default router
