import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRecording } from '../contexts/RecordingContext'
import { useMQTT } from '../contexts/MQTTContext'
import { useScenario } from '../contexts/ScenarioContext'
import api from '../services/api'
import CameraThumbnail from './CameraThumbnail'
import LiveStreamThumbnail from './LiveStreamThumbnail'
import ConfirmModal from './ConfirmModal'
import { toast } from 'react-hot-toast'
import {
  Video,
  Circle,
  Radio,
  MessageSquare,
  Play,
  Square,
  Pause,
  Download,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  HardDrive,
  Activity,
  Zap,
  FileVideo,
  Database,
  ChevronRight,
  Settings,
  Theater,
  Maximize2,
  Image,
  Tv,
  Film,
  Gauge
} from 'lucide-react'

const DashboardSummary = () => {
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [cameraRecordings, setCameraRecordings] = useState([])
  const [sensorRecordings, setSensorRecordings] = useState([])
  const [recordingTab, setRecordingTab] = useState('video')
  const [cameraStatus, setCameraStatus] = useState(new Map())
  const [syncStatus, setSyncStatus] = useState({ isConnected: false, isSyncing: false })
  // Modo de visualización: 'thumbnail' (snapshots) o 'live' (streaming)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('dashboardViewMode') || 'thumbnail'
  })
  // Modal de confirmación para detener grabación
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [stats, setStats] = useState({
    totalCameras: 0,
    activeCameras: 0,
    recordingCameras: 0,
    totalSensors: 0,
    activeSensors: 0,
    messagesPerSecond: 0,
    mqttStatus: 'disconnected'
  })
  const [localDiskInfo, setLocalDiskInfo] = useState(null)
  const [remoteDiskInfo, setRemoteDiskInfo] = useState(null)
  const [diskNotifications, setDiskNotifications] = useState({
    localWarningShown: false,
    localCriticalShown: false,
    remoteWarningShown: false,
    remoteCriticalShown: false
  })

  const {
    recordings,
    isRecording,
    getRecordings,
    downloadRecording,
    deleteRecording,
    activeRecordingsCount,
    syncRecordingStatus,
    startAllRecordings,
    stopAllRecordings,
    getMaxElapsedSeconds,
    getOldestStartTime,
    initialSyncDone
  } = useRecording()

  const {
    sensorData,
    messageRate,
    totalMessages,
    isConnected: mqttConnected,
    error: mqttError
  } = useMQTT()

  const {
    scenarios,
    activeScenario,
    setActiveScenario,
    loading: scenariosLoading
  } = useScenario()

  const [recordingState, setRecordingState] = useState('idle')
  const [elapsedTime, setElapsedTime] = useState(0)

  // Referencia para el tiempo de inicio de grabación (para cálculo preciso)
  const recordingStartTime = useRef(null)
  // Referencias para funciones del contexto (evita re-renders)
  const getMaxElapsedSecondsRef = useRef(getMaxElapsedSeconds)
  const getOldestStartTimeRef = useRef(getOldestStartTime)
  getMaxElapsedSecondsRef.current = getMaxElapsedSeconds
  getOldestStartTimeRef.current = getOldestStartTime

  /**
   * Calcula el tiempo transcurrido basándose en el timestamp de inicio
   * Inmune al throttling del navegador en segundo plano
   */
  const calculateElapsedTime = useCallback(() => {
    // Primero intentar obtener del contexto de recording
    const syncedElapsed = getMaxElapsedSecondsRef.current?.() || 0
    if (syncedElapsed > 0) {
      return syncedElapsed
    }

    // Fallback al cálculo local
    if (!recordingStartTime.current) return 0
    return Math.max(0, Math.floor((Date.now() - recordingStartTime.current) / 1000))
  }, []) // Sin dependencias - usa refs

  // Timer para grabación - ahora usa cálculo basado en timestamp
  useEffect(() => {
    let interval
    if (recordingState === 'recording') {
      interval = setInterval(() => {
        setElapsedTime(calculateElapsedTime())
      }, 1000)

      // Actualizar inmediatamente
      setElapsedTime(calculateElapsedTime())
    }
    return () => clearInterval(interval)
  }, [recordingState, calculateElapsedTime])

  /**
   * Sincroniza el tiempo cuando la página vuelve a ser visible
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && recordingState === 'recording') {
        console.log('[DashboardSummary] Página visible, actualizando contador...')
        setElapsedTime(calculateElapsedTime())
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [recordingState, calculateElapsedTime])

  // Sync con recording context - incluye sincronización del timer desde backend
  useEffect(() => {
    if (activeRecordingsCount > 0 && recordingState === 'idle') {
      setRecordingState('recording')
      // Sincronizar tiempo transcurrido desde el backend
      if (initialSyncDone) {
        const syncedElapsed = getMaxElapsedSecondsRef.current?.() || 0
        const oldestStart = getOldestStartTimeRef.current?.()

        if (oldestStart) {
          recordingStartTime.current = new Date(oldestStart).getTime()
        } else {
          recordingStartTime.current = Date.now()
        }

        if (syncedElapsed > 0) {
          setElapsedTime(syncedElapsed)
        } else {
          setElapsedTime(calculateElapsedTime())
        }
      }
    } else if (activeRecordingsCount === 0 && recordingState === 'recording') {
      setRecordingState('idle')
      recordingStartTime.current = null
      setElapsedTime(0)
    }
  }, [activeRecordingsCount, recordingState, initialSyncDone, calculateElapsedTime])

  // Sincronización inicial del timer cuando se completa el sync con backend
  useEffect(() => {
    if (initialSyncDone && activeRecordingsCount > 0) {
      const syncedElapsed = getMaxElapsedSecondsRef.current?.() || 0
      const oldestStart = getOldestStartTimeRef.current?.()

      if (oldestStart) {
        recordingStartTime.current = new Date(oldestStart).getTime()
      }

      if (syncedElapsed > 0) {
        console.log('[DashboardSummary] Sincronizando timer desde backend:', syncedElapsed, 'segundos')
        setElapsedTime(syncedElapsed)
      }
    }
  }, [initialSyncDone, activeRecordingsCount])

  // Verificar estado de cámara
  const checkCameraStatus = async (cameraId) => {
    try {
      const response = await fetch(`/api/stream/status/${cameraId}`, {
        signal: AbortSignal.timeout(3000)
      })
      const data = await response.json()
      return data.active || false
    } catch {
      return true
    }
  }

  // Función para verificar niveles de disco y mostrar notificaciones
  const checkDiskLevels = (diskInfo, diskType) => {
    if (!diskInfo?.available || !diskInfo.usePercent) return

    const usePercent = diskInfo.usePercent
    const isLocal = diskType === 'local'

    // Reset notifications if disk usage drops below thresholds
    if (usePercent < 70) {
      setDiskNotifications(prev => ({
        ...prev,
        [`${diskType}WarningShown`]: false,
        [`${diskType}CriticalShown`]: false
      }))
      return
    }

    // Warning at 75%
    if (usePercent >= 75 && usePercent < 90 && !diskNotifications[`${diskType}WarningShown`]) {
      toast.warning(
        `⚠️ Disco ${isLocal ? 'Local' : 'Remoto'} casi lleno`,
        {
          description: `${usePercent}% usado. Considere liberar espacio.`,
          duration: 6000,
          style: {
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #f59e0b',
          },
        }
      )
      setDiskNotifications(prev => ({
        ...prev,
        [`${diskType}WarningShown`]: true
      }))
    }

    // Critical at 90%
    if (usePercent >= 90 && !diskNotifications[`${diskType}CriticalShown`]) {
      toast.error(
        `🚨 Disco ${isLocal ? 'Local' : 'Remoto'} CRÍTICAMENTE lleno`,
        {
          description: `${usePercent}% usado. ¡Libere espacio inmediatamente!`,
          duration: 8000,
          style: {
            background: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #dc2626',
          },
        }
      )
      setDiskNotifications(prev => ({
        ...prev,
        [`${diskType}CriticalShown`]: true
      }))
    }
  }

  // Cargar cámaras
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const data = await api.getCameras()
        setCameras(data)

        const initialStatus = new Map(
          data.map(camera => [
            camera.id,
            { active: camera.isActive, lastCheck: Date.now(), fromDB: true }
          ])
        )
        setCameraStatus(initialStatus)

        // Seleccionar automáticamente la primera cámara si no hay ninguna seleccionada
        if (data.length > 0 && !selectedCameraId) {
          // Priorizar cámaras activas, o tomar la primera disponible
          const activeCamera = data.find(camera => camera.isActive)
          const cameraToSelect = activeCamera || data[0]
          setSelectedCameraId(cameraToSelect.id)
        }

        data.forEach(camera => {
          syncRecordingStatus(camera.id, camera.name)
        })

        data.forEach(async (camera) => {
          try {
            const isActive = await checkCameraStatus(camera.id)
            setCameraStatus(prev => new Map(prev).set(camera.id, {
              active: isActive,
              lastCheck: Date.now(),
              fromDB: false
            }))
          } catch (error) {
            console.error(`Error verificando cámara ${camera.id}:`, error)
          }
        })
      } catch (error) {
        console.error('Error cargando cámaras:', error)
      }
    }

    fetchCameras()
    const interval = setInterval(fetchCameras, 60000)
    return () => clearInterval(interval)
  }, [syncRecordingStatus, selectedCameraId])

  // Cargar sync status
  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const response = await fetch('/api/sync/status')
        if (!response.ok) return // Silenciar si endpoint no existe
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const data = await response.json()
          if (data.success) {
            setSyncStatus(data.data)
          }
        }
      } catch {
        // Silenciar error si endpoint no existe
      }
    }

    fetchSyncStatus()
    const interval = setInterval(fetchSyncStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  // Cargar información del disco local
  useEffect(() => {
    const fetchDiskInfo = async () => {
      try {
        const data = await api.getReplicationDiskInfo()
        setLocalDiskInfo(data)
        if (data) checkDiskLevels(data, 'local')
      } catch (error) {
        console.error('Error cargando información del disco:', error)
        setLocalDiskInfo(null)
      }
    }

    fetchDiskInfo()
    const interval = setInterval(fetchDiskInfo, 30000) // Actualizar cada 30s
    return () => clearInterval(interval)
  }, [])

  // Cargar información del disco remoto
  useEffect(() => {
    const fetchRemoteDiskInfo = async () => {
      try {
        const response = await fetch('/api/replication/remote-disk-info')
        if (response.ok) {
          const data = await response.json()
          setRemoteDiskInfo(data)
          if (data) checkDiskLevels(data, 'remote')
        } else {
          setRemoteDiskInfo(null)
        }
      } catch (error) {
        console.error('Error cargando información del disco remoto:', error)
        setRemoteDiskInfo(null)
      }
    }

    fetchRemoteDiskInfo()
    const interval = setInterval(fetchRemoteDiskInfo, 30000) // Actualizar cada 30s
    return () => clearInterval(interval)
  }, [])

  // Actualizar estadísticas
  useEffect(() => {
    const activeSensorsCount = Array.from(sensorData.values()).filter(
      sensor => Date.now() - new Date(sensor.timestamp).getTime() < 10000
    ).length

    const activeCamerasCount = Array.from(cameraStatus.values()).filter(
      status => status.active
    ).length

    setStats({
      totalCameras: cameras.length,
      activeCameras: activeCamerasCount,
      recordingCameras: activeRecordingsCount,
      totalSensors: sensorData.size,
      activeSensors: activeSensorsCount,
      messagesPerSecond: messageRate,
      mqttStatus: mqttConnected ? 'connected' : 'disconnected',
      mqttError: mqttError,
      totalMessages: totalMessages
    })
  }, [cameras, cameraStatus, activeRecordingsCount, sensorData, messageRate, mqttConnected, mqttError, totalMessages])

  // Cargar grabaciones
  useEffect(() => {
    if (selectedCameraId) {
      loadRecordings(selectedCameraId)
    }
  }, [selectedCameraId])

  const loadRecordings = async (cameraId) => {
    const recordings = await getRecordings(cameraId)
    setCameraRecordings(recordings)

    try {
      const response = await fetch(`/api/media/sensors/recordings/${cameraId}`)
      const data = await response.json()
      setSensorRecordings(data.recordings || [])
    } catch {
      setSensorRecordings([])
    }
  }

  const handleStartRecording = async () => {
    await startAllRecordings(cameras, { scenarioName: activeScenario?.name || 'sin_escenario' })
    setRecordingState('recording')
  }

  // Mostrar modal de confirmación antes de detener
  const handleStopRecordingClick = () => {
    setShowStopConfirm(true)
  }

  // Confirmar detención de grabación
  const handleConfirmStopRecording = async () => {
    await stopAllRecordings()
    setRecordingState('idle')
    setElapsedTime(0)
    setShowStopConfirm(false)
    toast.success('Grabación detenida correctamente')
  }

  const handleDeleteRecording = async (filename) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la grabación "${filename}"?`)) return

    try {
      const result = await deleteRecording(selectedCameraId, filename)
      if (result.success) {
        // Recargar grabaciones después de eliminar
        await loadRecordings(selectedCameraId)
        // Mostrar notificación de éxito si tienes toast configurado
        console.log('Grabación eliminada exitosamente')
      } else {
        console.error('Error eliminando grabación:', result.error)
        alert('Error al eliminar la grabación')
      }
    } catch (error) {
      console.error('Error eliminando grabación:', error)
      alert('Error al eliminar la grabación')
    }
  }

  const handleDownloadRecording = async (filename) => {
    try {
      const result = await downloadRecording(selectedCameraId, filename)
      if (!result.success) {
        console.error('Error descargando grabación:', result.error)
        alert('Error al descargar la grabación')
      }
      // Si es exitoso, el browser iniciará la descarga automáticamente
    } catch (error) {
      console.error('Error descargando grabación:', error)
      alert('Error al descargar la grabación')
    }
  }

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  // Obtener IDs de sensores del escenario activo para exclusión
  const { getActiveSensors } = useScenario()
  const scenarioSensorIds = activeScenario ? getActiveSensors() : []

  // Obtener sensores activos para mostrar (únicos y filtrados)
  const activeSensorsList = React.useMemo(() => {
    const uniqueSensors = new Map()

    // Procesar sensores del contexto MQTT
    Array.from(sensorData.entries()).forEach(([sensorId, data]) => {
      // Verificar que el sensor esté activo (última actualización < 10 segundos)
      const isRecent = Date.now() - new Date(data.timestamp).getTime() < 10000

      // Excluir si ya está en el escenario activo
      const isInScenario = scenarioSensorIds.includes(sensorId) ||
        scenarioSensorIds.includes(String(sensorId))

      if (isRecent && !isInScenario) {
        uniqueSensors.set(sensorId, {
          id: sensorId,
          type: data.type || sensorId,
          value: data.value,
          timestamp: data.timestamp,
          lastSeen: Date.now() - new Date(data.timestamp).getTime()
        })
      }
    })

    // Convertir a array y ordenar por tipo/nombre
    return Array.from(uniqueSensors.values())
      .sort((a, b) => a.type.localeCompare(b.type))
      .slice(0, 5) // Mostrar máximo 5 sensores
  }, [sensorData, scenarioSensorIds])

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════════════════════
          STATUS BAR - Información de estado en una línea
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Escenario Activo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Theater className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                {activeScenario?.name || 'Sin escenario'}
              </span>
              {activeScenario && (
                <button
                  onClick={() => setActiveScenario(null)}
                  className="ml-1 text-purple-400 hover:text-purple-600 dark:hover:text-purple-300"
                  title="Desactivar escenario"
                >
                  ×
                </button>
              )}
            </div>

            {activeScenario && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Video className="w-3 h-3" />
                  {activeScenario.cameras?.length || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  {activeScenario.sensors?.length || 0}
                </span>
              </div>
            )}
          </div>

          {/* Timer de grabación */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${recordingState === 'recording'
            ? 'bg-red-50 dark:bg-red-900/20'
            : 'bg-gray-50 dark:bg-gray-700/50'
            }`}>
            <Clock className={`w-4 h-4 ${recordingState === 'recording'
              ? 'text-red-500'
              : 'text-gray-400'
              }`} />
            <span className={`font-mono text-sm font-medium ${recordingState === 'recording'
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400'
              }`}>
              {formatTime(elapsedTime)}
            </span>
            {recordingState === 'recording' && (
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {/* MQTT Status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${mqttConnected
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}>
              {mqttConnected ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">MQTT</span>
            </div>

            {/* Sync Status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${syncStatus.isSyncing
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
              : syncStatus.isConnected
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN LAYOUT - Dos columnas
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ═══════════════════════════════════════════════════════════════════
            COLUMNA IZQUIERDA - Cámaras y Control de Grabación (2/3)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-4">

          {/* Control de Grabación Principal */}
          <div className={`rounded-xl shadow-sm border overflow-hidden transition-all ${recordingState === 'recording'
            ? 'bg-gradient-to-r from-red-500 to-red-600 border-red-400'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={recordingState === 'recording' ? handleStopRecordingClick : handleStartRecording}
                    disabled={cameras.length === 0}
                    className={`flex items-center justify-center w-14 h-14 rounded-full transition-all transform hover:scale-105 active:scale-95 ${recordingState === 'recording'
                      ? 'bg-white/20 hover:bg-white/30 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {recordingState === 'recording' ? (
                      <Square className="w-6 h-6 fill-current" />
                    ) : (
                      <Play className="w-6 h-6 fill-current ml-1" />
                    )}
                  </button>

                  <div>
                    <h3 className={`text-lg font-bold ${recordingState === 'recording' ? 'text-white' : 'text-gray-900 dark:text-white'
                      }`}>
                      {recordingState === 'recording' ? 'Grabando...' : 'Iniciar Grabación'}
                    </h3>
                    <p className={`text-sm ${recordingState === 'recording' ? 'text-red-100' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                      {recordingState === 'recording'
                        ? `${activeRecordingsCount} cámara${activeRecordingsCount !== 1 ? 's' : ''} + sensores`
                        : `${cameras.length} cámara${cameras.length !== 1 ? 's' : ''} disponible${cameras.length !== 1 ? 's' : ''}`
                      }
                    </p>
                  </div>
                </div>

                {recordingState === 'recording' && (
                  <div className="text-right">
                    <div className="text-3xl font-mono font-bold text-white">
                      {formatTime(elapsedTime)}
                    </div>
                    <div className="text-xs text-red-100">
                      Duración
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Vista Rápida de Cámaras con Stream en Vivo */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-500" />
                Cámaras en Vivo
              </h3>
              <div className="flex items-center gap-2">
                {/* Toggle Thumbnail/Live */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                  <button
                    onClick={() => {
                      setViewMode('thumbnail')
                      localStorage.setItem('dashboardViewMode', 'thumbnail')
                    }}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${viewMode === 'thumbnail'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    title="Vista de snapshots (menos recursos)"
                  >
                    <Image className="w-3 h-3" />
                    <span className="hidden sm:inline">Snapshots</span>
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('live')
                      localStorage.setItem('dashboardViewMode', 'live')
                    }}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${viewMode === 'live'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    title="Streaming en vivo (más fluido)"
                  >
                    <Tv className="w-3 h-3" />
                    <span className="hidden sm:inline">Live</span>
                  </button>
                </div>

                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {stats.activeCameras}/{stats.totalCameras} activas
                </span>
                <button
                  onClick={() => window.location.hash = '#camaras'}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Ver todas las cámaras"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4">
              {cameras.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Video className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay cámaras configuradas</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {cameras.slice(0, 4).map((camera) => {
                    const status = cameraStatus.get(camera.id) || { active: false }
                    const isRecordingCamera = recordings.has(camera.id)

                    // Usar LiveStreamThumbnail o CameraThumbnail según el modo
                    const ThumbnailComponent = viewMode === 'live' ? LiveStreamThumbnail : CameraThumbnail

                    return (
                      <ThumbnailComponent
                        key={camera.id}
                        camera={camera}
                        isActive={status.active}
                        isRecording={isRecordingCamera}
                        selected={selectedCameraId === camera.id}
                        onClick={() => setSelectedCameraId(camera.id)}
                        quality="low"
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Grabaciones Recientes */}
          {selectedCameraId && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileVideo className="w-4 h-4 text-orange-500" />
                  Grabaciones - {cameras.find(c => c.id === selectedCameraId)?.name}
                </h3>
                <button
                  onClick={() => {
                    setSelectedCameraId(null)
                    setCameraRecordings([])
                    setSensorRecordings([])
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setRecordingTab('video')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${recordingTab === 'video'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                >
                  <FileVideo className="w-4 h-4 inline mr-1.5" />
                  Video ({cameraRecordings.length})
                </button>
                <button
                  onClick={() => setRecordingTab('sensors')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${recordingTab === 'sensors'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                >
                  <Database className="w-4 h-4 inline mr-1.5" />
                  Sensores ({sensorRecordings.length})
                </button>
              </div>

              <div className="p-4 max-h-64 overflow-y-auto">
                {recordingTab === 'video' ? (
                  cameraRecordings.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                      No hay grabaciones de video
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cameraRecordings.slice(0, 5).map((recording, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {recording.filename}
                            </p>
                            <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />
                                {formatFileSize(recording.size)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(recording.created).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => handleDownloadRecording(recording.filename)}
                              className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                              title="Descargar grabación"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecording(recording.filename)}
                              className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Eliminar grabación"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  sensorRecordings.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                      No hay grabaciones de sensores
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sensorRecordings.slice(0, 5).map((recording, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {recording.filename}
                            </p>
                            <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Database className="w-3 h-3" />
                                {recording.recordCount} registros
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => window.open(`/api/media/sensors/download/${selectedCameraId}/${recording.filename}`, '_blank')}
                              className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                              title="Descargar JSON"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            COLUMNA DERECHA - KPIs y Sensores (1/3)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">

          {/* KPIs Grid Compacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Cámaras */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Cámaras
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats.totalCameras}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {stats.activeCameras} activas
                  </p>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            {/* Grabando */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Grabando
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats.recordingCameras}
                  </p>
                  {stats.recordingCameras > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                      En vivo
                    </p>
                  )}
                </div>
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <Circle className="w-5 h-5 text-red-600 dark:text-red-400 fill-current" />
                </div>
              </div>
            </div>

            {/* Disco Local */}
            <div className={`rounded-xl p-4 border transition-all duration-300 ${localDiskInfo?.usePercent > 90
              ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
              : localDiskInfo?.usePercent > 75
                ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`text-xs font-medium uppercase tracking-wide ${localDiskInfo?.usePercent > 90
                    ? 'text-red-600 dark:text-red-400'
                    : localDiskInfo?.usePercent > 75
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-gray-500 dark:text-gray-400'
                    }`}>
                    Disco Local
                  </p>
                  {localDiskInfo?.available ? (
                    <div className="mt-1">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {localDiskInfo.availableGB}GB
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${localDiskInfo.usePercent > 90 ? 'bg-red-500' :
                            localDiskInfo.usePercent > 75 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                          style={{ width: `${localDiskInfo.usePercent}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {localDiskInfo.usePercent}% usado
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      No disponible
                    </p>
                  )}
                </div>
                <div className={`p-2 rounded-lg ml-2 transition-all duration-300 ${localDiskInfo?.usePercent > 90
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : localDiskInfo?.usePercent > 75
                    ? 'bg-yellow-100 dark:bg-yellow-900/30'
                    : 'bg-orange-100 dark:bg-orange-900/30'
                  }`}>
                  <HardDrive className={`w-5 h-5 transition-all duration-300 ${localDiskInfo?.usePercent > 90
                    ? 'text-red-600 dark:text-red-400'
                    : localDiskInfo?.usePercent > 75
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-orange-600 dark:text-orange-400'
                    }`} />
                </div>
              </div>
            </div>

            {/* Disco Remoto */}
            <div className={`rounded-xl p-4 border transition-all duration-300 ${remoteDiskInfo?.usePercent > 90
              ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
              : remoteDiskInfo?.usePercent > 75
                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`text-xs font-medium uppercase tracking-wide ${remoteDiskInfo?.usePercent > 90
                    ? 'text-red-600 dark:text-red-400'
                    : remoteDiskInfo?.usePercent > 75
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-500 dark:text-gray-400'
                    }`}>
                    Disco Remoto
                  </p>
                  {remoteDiskInfo?.available ? (
                    <div className="mt-1">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {remoteDiskInfo.availableGB}GB
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${remoteDiskInfo.usePercent > 90 ? 'bg-red-500' :
                            remoteDiskInfo.usePercent > 75 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                          style={{ width: `${remoteDiskInfo.usePercent}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                        {remoteDiskInfo.usePercent}% usado
                        {remoteDiskInfo.isDummy && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs rounded-full font-medium">
                            Demo
                          </span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      No configurado
                    </p>
                  )}
                </div>
                <div className={`p-2 rounded-lg ml-2 transition-all duration-300 ${remoteDiskInfo?.usePercent > 90
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : remoteDiskInfo?.usePercent > 75
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-indigo-100 dark:bg-indigo-900/30'
                  }`}>
                  <HardDrive className={`w-5 h-5 transition-all duration-300 ${remoteDiskInfo?.usePercent > 90
                    ? 'text-red-600 dark:text-red-400'
                    : remoteDiskInfo?.usePercent > 75
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-indigo-600 dark:text-indigo-400'
                    }`} />
                </div>
              </div>
            </div>

            {/* Sensores */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Sensores
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats.activeSensors}
                    <span className="text-sm font-normal text-gray-400">/{stats.totalSensors}</span>
                  </p>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Radio className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            {/* MQTT Rate */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Mensajes
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats.messagesPerSecond.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    msg/s
                  </p>
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </div>

          {/* EMQX Metrics Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-500" />
                Estado MQTT
              </h3>
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${mqttConnected
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${mqttConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                {mqttConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            <div className="p-4 grid grid-cols-3 gap-4">
              {/* Message Rate */}
              <div className="text-center">
                <div className="w-10 h-10 mx-auto rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2">
                  <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                  {messageRate.toFixed(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">msg/s</p>
              </div>

              {/* Total Messages */}
              <div className="text-center">
                <div className="w-10 h-10 mx-auto rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-2">
                  <MessageSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                  {totalMessages > 1000 ? `${(totalMessages / 1000).toFixed(1)}k` : totalMessages}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">total</p>
              </div>

              {/* Sensors Active */}
              <div className="text-center">
                <div className="w-10 h-10 mx-auto rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                  <Radio className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                  {sensorData.size}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">sensores</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Acciones Rápidas
            </h4>
            <div className="space-y-2">
              <button
                onClick={() => window.parent?.postMessage?.({ type: 'NAVIGATE_TAB', tab: 'cameras' }, '*')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-500" />
                  Gestionar Cámaras
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => window.parent?.postMessage?.({ type: 'NAVIGATE_CONFIG', subTab: 'scenarios' }, '*')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Theater className="w-4 h-4 text-purple-500" />
                  Gestionar Escenarios
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => window.parent?.postMessage?.({ type: 'NAVIGATE_CONFIG', subTab: 'recordings' }, '*')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-red-500" />
                  Ver Grabaciones
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => window.parent?.postMessage?.({ type: 'NAVIGATE_CONFIG', subTab: 'storage' }, '*')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-orange-500" />
                  Estado de Almacenamiento
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => window.parent?.postMessage?.({ type: 'NAVIGATE_CONFIG', subTab: 'performance' }, '*')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-emerald-500" />
                  Rendimiento del Sistema
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/recordings/memory-config')
                    const data = await response.json()
                    if (data.success) {
                      const config = data.memoryOptimizations
                      toast.success(`Configuración de memoria: Segmentos ${config.segmentTime}, Buffer ${config.inputBufferSize}`)
                    }
                  } catch (error) {
                    toast.error('Error obteniendo configuración de memoria')
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-500" />
                  Ver Config Memoria
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para detener grabación */}
      <ConfirmModal
        isOpen={showStopConfirm}
        onClose={() => setShowStopConfirm(false)}
        onConfirm={handleConfirmStopRecording}
        title="Detener Grabación"
        message={`¿Estás seguro de que deseas detener la grabación? Se están grabando ${activeRecordingsCount} cámara${activeRecordingsCount !== 1 ? 's' : ''} y datos de sensores. La grabación actual de ${formatTime(elapsedTime)} se guardará.`}
        confirmText="Sí, detener"
        cancelText="Continuar grabando"
        isDanger={true}
      />
    </div>
  )
}

export default DashboardSummary
