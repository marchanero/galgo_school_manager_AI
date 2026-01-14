import express from 'express'
import storageManager from '../services/storageManager.js'

const router = express.Router()

/**
 * GET /storage/status
 * Obtiene el estado actual del almacenamiento
 */
router.get('/status', async (req, res) => {
  try {
    const diskInfo = await storageManager.getDiskInfo()
    
    if (!diskInfo) {
      return res.status(500).json({
        success: false,
        error: 'No se pudo obtener información del disco'
      })
    }
    
    res.json({
      success: true,
      data: {
        disk: diskInfo,
        status: storageManager.status,
        alertLevel: storageManager.status.alertLevel
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
 * GET /storage/summary
 * Obtiene resumen completo de almacenamiento
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await storageManager.getSummary()
    
    res.json({
      success: true,
      data: summary
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /storage/recordings
 * Lista todas las grabaciones con metadatos
 */
router.get('/recordings', async (req, res) => {
  try {
    const { scenario, camera, type, olderThan } = req.query
    
    let recordings = await storageManager.getRecordingsList()
    
    // Filtrar por escenario
    if (scenario) {
      recordings = recordings.filter(r => r.scenario === scenario)
    }
    
    // Filtrar por cámara
    if (camera) {
      recordings = recordings.filter(r => r.cameraId === String(camera))
    }
    
    // Filtrar por tipo
    if (type) {
      recordings = recordings.filter(r => r.type === type)
    }
    
    // Filtrar por antigüedad
    if (olderThan) {
      const days = parseInt(olderThan)
      recordings = recordings.filter(r => r.ageInDays >= days)
    }
    
    // Calcular totales
    const totalSize = recordings.reduce((sum, r) => sum + r.size, 0)
    
    res.json({
      success: true,
      data: {
        count: recordings.length,
        totalSize,
        totalSizeFormatted: storageManager.formatBytes(totalSize),
        recordings: recordings.map(r => ({
          ...r,
          filepath: undefined // No exponer rutas absolutas
        }))
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
 * GET /storage/config
 * Obtiene la configuración actual
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      warningThreshold: storageManager.config.warningThreshold,
      criticalThreshold: storageManager.config.criticalThreshold,
      autoCleanThreshold: storageManager.config.autoCleanThreshold,
      defaultRetentionDays: storageManager.config.defaultRetentionDays,
      minFreeSpaceGB: storageManager.config.minFreeSpaceGB,
      checkIntervalMs: storageManager.config.checkInterval,
      retentionPolicies: Object.fromEntries(storageManager.config.retentionPolicies)
    }
  })
})

/**
 * PUT /storage/config
 * Actualiza la configuración
 */
router.put('/config', (req, res) => {
  try {
    const {
      warningThreshold,
      criticalThreshold,
      autoCleanThreshold,
      defaultRetentionDays,
      minFreeSpaceGB
    } = req.body
    
    const updates = {}
    
    if (warningThreshold !== undefined) {
      if (warningThreshold < 0 || warningThreshold > 100) {
        return res.status(400).json({
          success: false,
          error: 'warningThreshold debe estar entre 0 y 100'
        })
      }
      updates.warningThreshold = warningThreshold
    }
    
    if (criticalThreshold !== undefined) {
      if (criticalThreshold < 0 || criticalThreshold > 100) {
        return res.status(400).json({
          success: false,
          error: 'criticalThreshold debe estar entre 0 y 100'
        })
      }
      updates.criticalThreshold = criticalThreshold
    }
    
    if (autoCleanThreshold !== undefined) {
      if (autoCleanThreshold < 0 || autoCleanThreshold > 100) {
        return res.status(400).json({
          success: false,
          error: 'autoCleanThreshold debe estar entre 0 y 100'
        })
      }
      updates.autoCleanThreshold = autoCleanThreshold
    }
    
    if (defaultRetentionDays !== undefined) {
      if (defaultRetentionDays < 1) {
        return res.status(400).json({
          success: false,
          error: 'defaultRetentionDays debe ser mayor a 0'
        })
      }
      updates.defaultRetentionDays = defaultRetentionDays
    }
    
    if (minFreeSpaceGB !== undefined) {
      if (minFreeSpaceGB < 0) {
        return res.status(400).json({
          success: false,
          error: 'minFreeSpaceGB debe ser mayor o igual a 0'
        })
      }
      updates.minFreeSpaceGB = minFreeSpaceGB
    }
    
    storageManager.updateConfig(updates)
    
    res.json({
      success: true,
      message: 'Configuración actualizada',
      data: {
        warningThreshold: storageManager.config.warningThreshold,
        criticalThreshold: storageManager.config.criticalThreshold,
        autoCleanThreshold: storageManager.config.autoCleanThreshold,
        defaultRetentionDays: storageManager.config.defaultRetentionDays,
        minFreeSpaceGB: storageManager.config.minFreeSpaceGB
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
 * PUT /storage/retention/:scenario
 * Establece política de retención para un escenario
 */
router.put('/retention/:scenario', (req, res) => {
  try {
    const { scenario } = req.params
    const { days } = req.body
    
    if (!days || days < 1) {
      return res.status(400).json({
        success: false,
        error: 'days debe ser mayor a 0'
      })
    }
    
    storageManager.setRetentionPolicy(scenario, days)
    
    res.json({
      success: true,
      message: `Retención para "${scenario}" establecida a ${days} días`,
      data: {
        scenario,
        retentionDays: days
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
 * POST /storage/cleanup
 * Ejecuta limpieza manual
 */
router.post('/cleanup', async (req, res) => {
  try {
    if (storageManager.status.autoCleanRunning) {
      return res.status(409).json({
        success: false,
        error: 'Ya hay una limpieza en progreso'
      })
    }
    
    // Ejecutar limpieza en background
    storageManager.autoCleanup()
    
    res.json({
      success: true,
      message: 'Limpieza iniciada',
      note: 'La limpieza se ejecuta en segundo plano'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * DELETE /storage/scenario/:scenario
 * Elimina grabaciones de un escenario
 */
router.delete('/scenario/:scenario', async (req, res) => {
  try {
    const { scenario } = req.params
    const { olderThan } = req.query
    const days = olderThan ? parseInt(olderThan) : 0
    
    const result = await storageManager.deleteScenarioRecordings(scenario, days)
    
    res.json({
      success: true,
      message: `Eliminadas ${result.deletedCount} grabaciones del escenario "${scenario}"`,
      data: result
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * DELETE /storage/camera/:cameraId
 * Elimina grabaciones de una cámara
 */
router.delete('/camera/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params
    const { olderThan } = req.query
    const days = olderThan ? parseInt(olderThan) : 0
    
    const result = await storageManager.deleteCameraRecordings(cameraId, days)
    
    res.json({
      success: true,
      message: `Eliminadas ${result.deletedCount} grabaciones de la cámara ${cameraId}`,
      data: result
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /storage/check
 * Fuerza una verificación de disco
 */
router.post('/check', async (req, res) => {
  try {
    const diskInfo = await storageManager.checkDiskSpace()
    
    res.json({
      success: true,
      data: {
        disk: diskInfo,
        alertLevel: storageManager.status.alertLevel
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
