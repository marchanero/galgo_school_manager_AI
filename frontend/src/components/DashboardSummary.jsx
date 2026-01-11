import React, { useState, useEffect } from 'react'
import { useRecording } from '../contexts/RecordingContext'
import { useMQTT } from '../contexts/MQTTContext'
import { useScenario } from '../contexts/ScenarioContext'
import api from '../services/api'
import CameraThumbnail from './CameraThumbnail'
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
  Maximize2
} from 'lucide-react'

const DashboardSummary = () => {
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [cameraRecordings, setCameraRecordings] = useState([])
  const [sensorRecordings, setSensorRecordings] = useState([])
  const [recordingTab, setRecordingTab] = useState('video')
  const [cameraStatus, setCameraStatus] = useState(new Map())
  const [syncStatus, setSyncStatus] = useState({ isConnected: false, isSyncing: false })
  const [stats, setStats] = useState({
    totalCameras: 0,
    activeCameras: 0,
    recordingCameras: 0,
    totalSensors: 0,
    activeSensors: 0,
    messagesPerSecond: 0,
    mqttStatus: 'disconnected'
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
    stopAllRecordings
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

  // Timer para grabación
  useEffect(() => {
    let interval
    if (recordingState === 'recording') {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [recordingState])

  // Sync con recording context
  useEffect(() => {
    if (activeRecordingsCount > 0 && recordingState === 'idle') {
      setRecordingState('recording')
    } else if (activeRecordingsCount === 0 && recordingState === 'recording') {
      setRecordingState('idle')
      setElapsedTime(0)
    }
  }, [activeRecordingsCount, recordingState])

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

  const handleStopRecording = async () => {
    await stopAllRecordings()
    setRecordingState('idle')
    setElapsedTime(0)
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

  // Obtener sensores activos para mostrar (únicos y filtrados)
  const activeSensorsList = React.useMemo(() => {
    const uniqueSensors = new Map()
    
    // Procesar sensores del contexto MQTT
    Array.from(sensorData.entries()).forEach(([sensorId, data]) => {
      // Verificar que el sensor esté activo (última actualización < 10 segundos)
      const isRecent = Date.now() - new Date(data.timestamp).getTime() < 10000
      if (isRecent) {
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
  }, [sensorData])

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
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
            recordingState === 'recording' 
              ? 'bg-red-50 dark:bg-red-900/20' 
              : 'bg-gray-50 dark:bg-gray-700/50'
          }`}>
            <Clock className={`w-4 h-4 ${
              recordingState === 'recording' 
                ? 'text-red-500' 
                : 'text-gray-400'
            }`} />
            <span className={`font-mono text-sm font-medium ${
              recordingState === 'recording' 
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
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
              mqttConnected 
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
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
              syncStatus.isSyncing 
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
          <div className={`rounded-xl shadow-sm border overflow-hidden transition-all ${
            recordingState === 'recording'
              ? 'bg-gradient-to-r from-red-500 to-red-600 border-red-400'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={recordingState === 'recording' ? handleStopRecording : handleStartRecording}
                    disabled={cameras.length === 0}
                    className={`flex items-center justify-center w-14 h-14 rounded-full transition-all transform hover:scale-105 active:scale-95 ${
                      recordingState === 'recording'
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
                    <h3 className={`text-lg font-bold ${
                      recordingState === 'recording' ? 'text-white' : 'text-gray-900 dark:text-white'
                    }`}>
                      {recordingState === 'recording' ? 'Grabando...' : 'Iniciar Grabación'}
                    </h3>
                    <p className={`text-sm ${
                      recordingState === 'recording' ? 'text-red-100' : 'text-gray-500 dark:text-gray-400'
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
                    
                    return (
                      <CameraThumbnail
                        key={camera.id}
                        camera={camera}
                        isActive={status.active}
                        isRecording={isRecordingCamera}
                        selected={selectedCameraId === camera.id}
                        onClick={() => setSelectedCameraId(camera.id)}
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
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    recordingTab === 'video'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <FileVideo className="w-4 h-4 inline mr-1.5" />
                  Video ({cameraRecordings.length})
                </button>
                <button
                  onClick={() => setRecordingTab('sensors')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    recordingTab === 'sensors'
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
          <div className="grid grid-cols-2 gap-3">
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

          {/* Sensores Activos */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                Sensores Activos
              </h3>
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                mqttConnected 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${mqttConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                {mqttConnected ? 'Live' : 'Offline'}
              </span>
            </div>
            
            <div className="p-4">
              {activeSensorsList.length === 0 ? (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                  <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin sensores activos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeSensorsList.map((sensor) => (
                    <div
                      key={sensor.id}
                      className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {sensor.type}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {sensor.id}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {typeof sensor.value === 'object' 
                            ? (sensor.value?.heart_rate || sensor.value?.value || '---')
                            : sensor.value || '---'
                          }
                        </p>
                        <p className="text-xs text-green-500">
                          <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                          Hace {Math.round(sensor.lastSeen / 1000)}s
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Acciones Rápidas
            </h4>
            <div className="space-y-2">
              <button 
                onClick={() => window.location.hash = '#camaras'}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-500" />
                  Gestionar Cámaras
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button 
                onClick={() => window.location.hash = '#escenarios'}
                className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Theater className="w-4 h-4 text-purple-500" />
                  Gestionar Escenarios
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardSummary
