import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const RecordingContext = createContext()

export function RecordingProvider({ children }) {
  // Cargar estado de grabación desde localStorage
  const [recordings, setRecordings] = useState(() => {
    try {
      const saved = localStorage.getItem('recordingState')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Convertir el array guardado de vuelta a Map
        return new Map(parsed.map(([key, value]) => [
          key,
          { ...value, startedAt: value.startedAt ? new Date(value.startedAt) : null }
        ]))
      }
    } catch (error) {
      console.error('Error cargando estado de grabación:', error)
    }
    return new Map()
  })

  const [globalRecordingStatus, setGlobalRecordingStatus] = useState('idle') // 'idle', 'starting', 'recording', 'stopping'
  const [initialSyncDone, setInitialSyncDone] = useState(false)
  const [isSyncing, setIsSyncing] = useState(true)

  // Persistir estado de grabación en localStorage
  useEffect(() => {
    try {
      // Convertir Map a array para poder serializar con JSON
      const recordingsArray = Array.from(recordings.entries())
      localStorage.setItem('recordingState', JSON.stringify(recordingsArray))
    } catch (error) {
      console.error('Error guardando estado de grabación:', error)
    }
  }, [recordings])

  /**
   * Sincroniza el estado inicial desde el backend al cargar la página
   * Verifica qué grabaciones siguen activas realmente en el servidor
   */
  useEffect(() => {
    let pollingInterval = null
    let attempts = 0
    const FAST_POLLING_DURATION = 10000 // 10 segundos
    const POLLING_INTERVAL = 2000 // 2 segundos

    const performSync = async () => {
      try {
        if (attempts === 0) setIsSyncing(true)
        console.log(`🔄 Sincronizando estado de grabaciones (intento ${attempts + 1})...`)

        // Obtener estado global del sistema de grabación SINCRONIZADA
        const response = await fetch('/api/recordings/sync/status')
        if (!response.ok) throw new Error('Network response was not ok')

        const backendStatus = await response.json()

        // Si es el primer intento o hay cambios significativos, loguear
        if (attempts === 0) console.log('📊 Estado del backend (Sync):', backendStatus)

        // Crear mapa de detalles de grabación desde el backend
        const recordingDetailsMap = new Map()
        if (backendStatus.sessions) {
          for (const session of backendStatus.sessions) {
            recordingDetailsMap.set(session.cameraId, session)
          }
        }

        const activeBackendRecordings = new Set(
          (backendStatus.sessions || []).map(s => s.cameraId)
        )

        setRecordings(prev => {
          const updated = new Map()
          let hasChanges = false

          // Mantener y actualizar grabaciones activas
          for (const [cameraId, recordingInfo] of prev.entries()) {
            if (activeBackendRecordings.has(cameraId)) {
              const detail = recordingDetailsMap.get(cameraId)
              // Comprobamos si hay cambios reales para evitar re-renders innecesarios si es posible
              // (Simplificado: siempre actualizamos si está activo para tener el elapsedSeconds fresco)
              updated.set(cameraId, {
                ...recordingInfo,
                status: 'recording',
                startedAt: detail?.startTime ? new Date(detail.startTime) : recordingInfo.startedAt,
                elapsedSeconds: detail?.elapsedSeconds || 0,
                scenarioName: detail?.scenarioName || recordingInfo.scenarioName
              })
            }
          }

          // Agregar nuevas grabaciones del backend
          for (const cameraId of activeBackendRecordings) {
            if (!updated.has(cameraId)) {
              const detail = recordingDetailsMap.get(cameraId)
              updated.set(cameraId, {
                status: 'recording',
                cameraName: `Cámara ${cameraId}`,
                startedAt: detail?.startTime ? new Date(detail.startTime) : new Date(),
                elapsedSeconds: detail?.elapsedSeconds || 0,
                scenarioName: detail?.scenarioName
              })
              hasChanges = true
            }
          }

          // Detectar si se eliminaron grabaciones
          if (prev.size !== updated.size) hasChanges = true

          return updated.size !== prev.size || hasChanges ? updated : prev
        })

        if (!initialSyncDone) setInitialSyncDone(true)

      } catch (error) {
        console.error('❌ Error sincronizando estado:', error)
        // No marcamos initialSyncDone como true si falla el primer intento crítico, 
        // pero para evitar bloqueo de UI podríamos querer hacerlo después de varios intentos
      } finally {
        setIsSyncing(false)
        attempts++
      }
    }

    // Ejecutar inmediatamente
    performSync()

    // Configurar polling rápido
    pollingInterval = setInterval(() => {
      performSync()
    }, POLLING_INTERVAL)

    // Detener polling después de FAST_POLLING_DURATION
    const timeoutId = setTimeout(() => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        console.log('⏹️ Polling rápido inicial finalizado')
      }
    }, FAST_POLLING_DURATION)

    return () => {
      if (pollingInterval) clearInterval(pollingInterval)
      clearTimeout(timeoutId)
    }
  }, []) // Solo al montar

  /**
   * Re-sincroniza el estado cuando la página vuelve a ser visible
   * Esto maneja el caso de cerrar y reabrir pestaña/navegador sin recargar
   */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Página visible, re-sincronizando estado...')

        try {
          const response = await fetch('/api/media/status')
          const backendStatus = await response.json()

          // Crear mapa de detalles de grabación desde el backend
          const recordingDetailsMap = new Map()
          if (backendStatus.recordingDetails) {
            for (const detail of backendStatus.recordingDetails) {
              recordingDetailsMap.set(detail.cameraId, detail)
            }
          }

          const activeBackendRecordings = new Set(
            (backendStatus.recording || []).map(key => {
              const match = key.match(/camera_(\d+)/)
              return match ? parseInt(match[1]) : null
            }).filter(id => id !== null)
          )

          console.log('🔄 Grabaciones activas detectadas:', Array.from(activeBackendRecordings))

          setRecordings(prev => {
            const updated = new Map()

            // Mantener solo las grabaciones activas en backend
            for (const [cameraId, recordingInfo] of prev.entries()) {
              if (activeBackendRecordings.has(cameraId)) {
                const detail = recordingDetailsMap.get(cameraId)
                updated.set(cameraId, {
                  ...recordingInfo,
                  status: 'recording',
                  startedAt: detail?.startTime ? new Date(detail.startTime) : recordingInfo.startedAt,
                  elapsedSeconds: detail?.elapsedSeconds || 0,
                  scenarioName: detail?.scenarioName || recordingInfo.scenarioName
                })
              }
            }

            // Agregar grabaciones del backend que no tenemos
            for (const cameraId of activeBackendRecordings) {
              if (!updated.has(cameraId)) {
                const detail = recordingDetailsMap.get(cameraId)
                updated.set(cameraId, {
                  status: 'recording',
                  cameraName: `Cámara ${cameraId}`,
                  startedAt: detail?.startTime ? new Date(detail.startTime) : new Date(),
                  elapsedSeconds: detail?.elapsedSeconds || 0,
                  scenarioName: detail?.scenarioName
                })
              }
            }

            return updated
          })

        } catch (error) {
          console.error('❌ Error re-sincronizando:', error)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // También escuchar pageshow para cuando se restaura desde bfcache
    const handlePageShow = (event) => {
      if (event.persisted) {
        console.log('📄 Página restaurada desde caché, re-sincronizando...')
        handleVisibilityChange()
      }
    }
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])

  /**
   * Sincroniza el estado de grabación desde el backend
   * IMPORTANTE: Esta función NO limpia el estado si backend dice false
   * Solo actualiza si backend confirma que SÍ está grabando
   * Para limpiar, usar stopRecording explícitamente
   */
  const syncRecordingStatus = useCallback(async (cameraId, cameraName) => {
    try {
      const response = await fetch(`/api/recordings/sync/${cameraId}/status`)

      // 404 means no active session - this is normal, not an error
      if (response.status === 404) {
        return false
      }

      const data = await response.json()

      console.log(`🔄 Sync status camera ${cameraId}:`, data)

      if (data.success && data.session && data.session.status === 'recording') {
        // Solo actualizar si backend confirma grabación activa
        setRecordings(prev => {
          const existing = prev.get(cameraId)
          if (!existing) {
            console.log(`✅ Camera ${cameraId} confirmada grabando (agregando a estado)`)
            return new Map(prev).set(cameraId, {
              status: 'recording',
              cameraName,
              startedAt: new Date(data.session.masterTimestamp),
              elapsedSeconds: data.session.duration || 0,
              scenarioName: data.session.scenarioName
            })
          }
          // Ya existe, no cambiar
          return prev
        })
        return true
      }
      return false
    } catch (error) {
      console.error('Error sincronizando estado:', error)
      return false
    }
  }, [])

  /**
   * Inicia grabación para una cámara específica
   * @param {number} cameraId - ID de la cámara
   * @param {string} cameraName - Nombre de la cámara
   * @param {Object} options - Opciones adicionales
   * @param {number} options.scenarioId - ID del escenario activo
   * @param {string} options.scenarioName - Nombre del escenario activo
   */
  const startRecording = useCallback(async (cameraId, cameraName, options = {}) => {
    try {
      console.log('📹 RecordingContext.startRecording llamado:', {
        cameraId,
        cameraName,
        options,
        hasScenarioId: !!options.scenarioId,
        hasScenarioName: !!options.scenarioName
      })

      setRecordings(prev => new Map(prev).set(cameraId, {
        status: 'starting',
        cameraName,
        startedAt: null
      }))

      const requestBody = {
        camera: { id: cameraId, name: cameraName, rtspUrl: 'auto' }, // El backend resolverá la URL si es necesario o la tomará de la BD
        scenarioId: options.scenarioId,
        scenarioName: options.scenarioName,
        sensorTopics: [] // Opcional: especificar topics
      }

      console.log('📤 Enviando request a backend (Sync):', {
        url: `/api/recordings/sync/start`,
        body: requestBody
      })

      const response = await fetch(`/api/recordings/sync/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      console.log('📥 Respuesta del backend:', data)

      if (!data.success) {
        throw new Error(data.error || 'Error iniciando grabación')
      }

      setRecordings(prev => new Map(prev).set(cameraId, {
        status: 'recording',
        cameraName,
        scenarioId: options.scenarioId,
        scenarioName: options.scenarioName,
        startedAt: new Date()
      }))

      console.log(`✅ Grabación iniciada: ${cameraName}${options.scenarioName ? ` (${options.scenarioName})` : ''}`)
      return { success: true, data }

    } catch (error) {
      console.error('❌ Error iniciando grabación:', error)
      setRecordings(prev => new Map(prev).set(cameraId, {
        status: 'error',
        cameraName,
        error: error.message
      }))
      return { success: false, error: error.message }
    }
  }, [])

  /**
   * Detiene grabación para una cámara específica
   */
  const stopRecording = useCallback(async (cameraId) => {
    try {
      const current = recordings.get(cameraId)
      setRecordings(prev => new Map(prev).set(cameraId, {
        ...current,
        status: 'stopping'
      }))

      const response = await fetch(`/api/recordings/sync/${cameraId}/stop`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error deteniendo grabación')
      }

      // SOLO AHORA limpiar el estado después de confirmar que backend detuvo
      setRecordings(prev => {
        const next = new Map(prev)
        next.delete(cameraId)
        return next
      })

      console.log(`🛑 Grabación detenida y estado limpiado: ${current?.cameraName}`)
      return { success: true, data }

    } catch (error) {
      console.error('❌ Error deteniendo grabación:', error)

      // En caso de error, restaurar estado anterior
      setRecordings(prev => {
        const current = prev.get(cameraId)
        if (current) {
          return new Map(prev).set(cameraId, {
            ...current,
            status: 'recording' // Volver a recording si falló
          })
        }
        return prev
      })

      return { success: false, error: error.message }
    }
  }, [recordings])

  /**
   * Inicia grabación para todas las cámaras
   * @param {Array} cameras - Lista de cámaras
   * @param {Object} options - Opciones de grabación (scenarioId, scenarioName)
   */
  const startAllRecordings = useCallback(async (cameras, options = {}) => {
    setGlobalRecordingStatus('starting')

    const results = await Promise.allSettled(
      cameras.map(camera => startRecording(camera.id, camera.name, options))
    )

    setGlobalRecordingStatus('recording')
    return results
  }, [startRecording])

  /**
   * Detiene grabación para todas las cámaras
   */
  const stopAllRecordings = useCallback(async () => {
    setGlobalRecordingStatus('stopping')

    const cameraIds = Array.from(recordings.keys())
    const results = await Promise.allSettled(
      cameraIds.map(id => stopRecording(id))
    )

    setGlobalRecordingStatus('idle')
    return results
  }, [recordings, stopRecording])

  /**
   * Obtiene estado de grabación de una cámara
   */
  const getRecordingStatus = useCallback((cameraId) => {
    return recordings.get(cameraId) || { status: 'idle' }
  }, [recordings])

  /**
   * Verifica si una cámara está grabando
   */
  const isRecording = useCallback((cameraId) => {
    const status = recordings.get(cameraId)?.status
    return status === 'recording' || status === 'starting'
  }, [recordings])

  /**
   * Obtiene lista de grabaciones de una cámara
   */
  const getRecordings = useCallback(async (cameraId) => {
    try {
      const response = await fetch(`/api/media/recordings/${cameraId}`)
      const data = await response.json()
      return data.recordings || []
    } catch (error) {
      console.error('Error obteniendo grabaciones:', error)
      return []
    }
  }, [])

  /**
   * Descarga una grabación
   */
  const downloadRecording = useCallback((cameraId, filename) => {
    window.open(`/api/media/download/${cameraId}/${filename}`, '_blank')
  }, [])

  /**
   * Elimina una grabación
   */
  const deleteRecording = useCallback(async (cameraId, filename) => {
    try {
      const response = await fetch(`/api/media/recording/${cameraId}/${filename}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      return { success: data.success, message: data.message }
    } catch (error) {
      console.error('Error eliminando grabación:', error)
      return { success: false, error: error.message }
    }
  }, [])

  /**
   * Obtiene el tiempo transcurrido más largo de todas las grabaciones activas
   * Útil para mostrar el temporizador principal
   */
  const getMaxElapsedSeconds = useCallback(() => {
    let maxElapsed = 0
    for (const [, recordingInfo] of recordings.entries()) {
      if (recordingInfo.startedAt) {
        const elapsed = Math.floor((Date.now() - new Date(recordingInfo.startedAt).getTime()) / 1000)
        if (elapsed > maxElapsed) {
          maxElapsed = elapsed
        }
      }
      // También considerar elapsedSeconds sincronizado del backend
      if (recordingInfo.elapsedSeconds && recordingInfo.elapsedSeconds > maxElapsed) {
        maxElapsed = recordingInfo.elapsedSeconds
      }
    }
    return maxElapsed
  }, [recordings])

  /**
   * Obtiene la primera fecha de inicio de grabación (la más antigua)
   */
  const getOldestStartTime = useCallback(() => {
    let oldest = null
    for (const [, recordingInfo] of recordings.entries()) {
      if (recordingInfo.startedAt) {
        const startTime = new Date(recordingInfo.startedAt)
        if (!oldest || startTime < oldest) {
          oldest = startTime
        }
      }
    }
    return oldest
  }, [recordings])

  const value = {
    // Estado
    recordings,
    globalRecordingStatus,
    initialSyncDone,
    isSyncing,

    // Acciones individuales
    startRecording,
    stopRecording,
    syncRecordingStatus,

    // Acciones globales
    startAllRecordings,
    stopAllRecordings,

    // Consultas
    getRecordingStatus,
    isRecording,
    getRecordings,

    // Gestión de archivos
    downloadRecording,
    deleteRecording,

    // Estadísticas y tiempo
    activeRecordingsCount: recordings.size,
    isAnyRecording: recordings.size > 0,
    getMaxElapsedSeconds,
    getOldestStartTime
  }

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  )
}

// Hook debe estar después del Provider para compatibilidad con HMR
export function useRecording() {
  const context = useContext(RecordingContext)
  if (!context) {
    throw new Error('useRecording must be used within a RecordingProvider')
  }
  return context
}
