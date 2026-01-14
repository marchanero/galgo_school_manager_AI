/**
 * EMQX Proxy Routes
 * Proxy para la API de EMQX - evita problemas de CORS
 */

import express from 'express'
import axios from 'axios'

const router = express.Router()

// Configuración de EMQX
const EMQX_API_BASE = process.env.EMQX_API_URL || 'http://100.82.84.24:18083/api/v5'
const EMQX_API_KEY = process.env.EMQX_API_KEY || 'admin'
const EMQX_API_SECRET = process.env.EMQX_API_SECRET || 'galgo2526'

// Cliente axios para EMQX
const emqxClient = axios.create({
  baseURL: EMQX_API_BASE,
  timeout: 10000,
  auth: {
    username: EMQX_API_KEY,
    password: EMQX_API_SECRET
  }
})

/**
 * GET /api/emqx/stats
 * Obtener estadísticas del cluster
 */
router.get('/stats', async (req, res) => {
  try {
    const response = await emqxClient.get('/stats')
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
  try {
    const response = await emqxClient.get('/clients', { params: req.query })
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
    const response = await emqxClient.get(`/clients/${encodeURIComponent(req.params.clientId)}`)
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
  try {
    const response = await emqxClient.get('/subscriptions', { params: req.query })
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
  try {
    const response = await emqxClient.get('/nodes')
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
  try {
    const response = await emqxClient.get('/topics', { params: req.query })
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
    const response = await emqxClient.get('/routes', { params: req.query })
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
  try {
    const response = await emqxClient.get('/stats')
    res.json({
      status: 'connected',
      emqxUrl: EMQX_API_BASE,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(503).json({
      status: 'disconnected',
      emqxUrl: EMQX_API_BASE,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

export default router
