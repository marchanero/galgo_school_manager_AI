import express from 'express'
import replicationService from '../services/replicationService.js'

const router = express.Router()

// GET /api/replication/stats - Obtener estadísticas
router.get('/stats', async (req, res) => {
  try {
    const stats = await replicationService.getStats()
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/replication/config - Obtener configuración actual
router.get('/config', (req, res) => {
  res.json({
    schedule: replicationService.schedule,
    enabled: replicationService.enabled,
    retentionDays: replicationService.retentionDays,
    deleteAfterExport: replicationService.deleteAfterExport
  })
})

// POST /api/replication/config - Guardar configuración
router.post('/config', async (req, res) => {
  const { schedule, enabled, retentionDays, deleteAfterExport } = req.body
  
  if (!schedule) {
    return res.status(400).json({ error: 'Schedule es requerido' })
  }

  const success = await replicationService.saveConfig(
    schedule, 
    enabled, 
    parseInt(retentionDays || 0), 
    deleteAfterExport
  )
  
  if (success) {
    res.json({ success: true, message: 'Configuración guardada' })
  } else {
    res.status(500).json({ error: 'Error guardando configuración' })
  }
})

// POST /api/replication/start - Iniciar replicación manual
router.post('/start', async (req, res) => {
  try {
    // No esperar a que termine, responder rápido
    replicationService.replicate({ force: true })
      .then(result => console.log('Resultado replicación manual:', result))
      .catch(err => console.error('Error replicación manual:', err))

    res.json({
      success: true,
      message: 'Proceso de replicación iniciado en segundo plano'
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router