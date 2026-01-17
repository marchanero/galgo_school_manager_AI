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

// GET /api/replication/server-config - Obtener configuración del servidor de backup
router.get('/server-config', (req, res) => {
  try {
    const serverConfig = replicationService.getServerConfig()
    res.json(serverConfig)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/replication/server-config - Guardar configuración del servidor de backup
router.post('/server-config', async (req, res) => {
  try {
    const {
      useMock,
      engine,
      host,
      port,
      user,
      password,
      sshKeyPath,
      remotePath,
      rcloneRemote,
      transfers,
      retries,
      verifyHash,
      backoffBase,
      backoffMax,
      remoteMaxUsePercent
    } = req.body

    const serverSettings = {
      useMock: useMock !== undefined ? useMock : true,
      engine: engine || 'rclone',
      host: host || '',
      port: parseInt(port) || 22,
      user: user || '',
      password: password || '',
      sshKeyPath: sshKeyPath || '',
      remotePath: remotePath || '/mnt/backups/cameras',
      rcloneRemote: rcloneRemote || 'truenas',
      transfers: parseInt(transfers) || 4,
      retries: parseInt(retries) || 10,
      verifyHash: verifyHash !== undefined ? verifyHash : true,
      backoffBase: parseInt(backoffBase) || 2,
      backoffMax: parseInt(backoffMax) || 300,
      remoteMaxUsePercent: parseInt(remoteMaxUsePercent) || 90
    }

    const success = await replicationService.saveServerConfig(serverSettings)
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Configuración del servidor guardada',
        config: replicationService.getServerConfig()
      })
    } else {
      res.status(500).json({ error: 'Error guardando configuración del servidor' })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
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

// GET /api/replication/disk-info - Obtener información del disco local
router.get('/disk-info', async (req, res) => {
  try {
    const diskInfo = await replicationService.getLocalDiskInfo()
    res.json(diskInfo)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/replication/remote-disk-info - Obtener información del disco remoto
router.get('/remote-disk-info', async (req, res) => {
  try {
    const diskInfo = await replicationService.getRemoteDiskInfo()
    res.json(diskInfo)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/replication/status - Estado completo del sistema de replicación
router.get('/status', async (req, res) => {
  try {
    const status = await replicationService.getStatus()
    res.json(status)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/replication/pending - Archivos pendientes de sincronizar
router.get('/pending', async (req, res) => {
  try {
    const pendingCount = await replicationService.getPendingFilesCount()
    res.json({ pendingFiles: pendingCount })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/replication/test-connection - Probar conexión al servidor remoto
router.post('/test-connection', async (req, res) => {
  try {
    const result = await replicationService.testConnection()
    res.json(result)
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/replication/progress - Obtener progreso actual de la replicación
router.get('/progress', (req, res) => {
  const progress = replicationService.currentProgress
  const isReplicating = replicationService.isReplicating
  
  res.json({
    isReplicating,
    progress: progress ? {
      transferred: progress.transferred,
      total: progress.total,
      percent: progress.percent,
      speed: progress.speed,
      eta: progress.eta,
      timestamp: progress.timestamp
    } : null
  })
})

export default router