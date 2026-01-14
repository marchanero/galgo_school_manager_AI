import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { 
  Play as PlayIcon, 
  Square as StopIcon, 
  RefreshCw as ArrowPathIcon,
  AlertTriangle as ExclamationTriangleIcon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  Settings as Cog6ToothIcon,
  Video as VideoCameraIcon,
  Clock as ClockIcon,
  Activity as SignalIcon,
  WifiOff as SignalSlashIcon
} from 'lucide-react'

/**
 * RecordingDashboard - Panel de control de grabaciones resilientes
 * 
 * Muestra estado de grabaciones con reconexión automática
 */
export default function RecordingDashboard() {
  const [recordings, setRecordings] = useState([])
  const [config, setConfig] = useState({})
  const [cameras, setCameras] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [editConfig, setEditConfig] = useState({})

  // Cargar datos
  const loadData = useCallback(async () => {
    try {
      const [statusRes, camerasRes] = await Promise.all([
        api.getRecordingsStatus(),
        api.getCameras()
      ])
      
      setRecordings(statusRes.data.recordings || [])
      setConfig(statusRes.data.config || {})
      setCameras(camerasRes.data || [])
      setIsLoading(false)
    } catch (error) {
      console.error('Error cargando datos:', error)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    // Actualizar cada 5 segundos
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [loadData])

  // Iniciar grabación
  const startRecording = async (camera) => {
    try {
      await api.startRecording({
        camera: {
          id: camera.id,
          name: camera.name,
          rtspUrl: camera.rtspUrl
        }
      })
      loadData()
    } catch (error) {
      console.error('Error iniciando grabación:', error)
    }
  }

  // Detener grabación
  const stopRecording = async (cameraId) => {
    try {
      await api.stopRecording(cameraId)
      loadData()
    } catch (error) {
      console.error('Error deteniendo grabación:', error)
    }
  }

  // Detener todas
  const stopAll = async () => {
    try {
      await api.stopAllRecordings()
      loadData()
    } catch (error) {
      console.error('Error deteniendo grabaciones:', error)
    }
  }

  // Guardar configuración
  const saveConfig = async () => {
    try {
      await api.updateRecordingsConfig(editConfig)
      setShowConfig(false)
      loadData()
    } catch (error) {
      console.error('Error guardando configuración:', error)
    }
  }

  // Formatear duración
  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  // Formatear última actividad
  const getActivityStatus = (lastActivity) => {
    const secondsAgo = Math.floor((Date.now() - lastActivity) / 1000)
    
    if (secondsAgo < 5) return { text: 'En vivo', color: 'text-green-500', icon: SignalIcon }
    if (secondsAgo < 30) return { text: `Hace ${secondsAgo}s`, color: 'text-green-400', icon: SignalIcon }
    if (secondsAgo < 60) return { text: `Hace ${secondsAgo}s`, color: 'text-yellow-500', icon: SignalIcon }
    return { text: `Hace ${Math.floor(secondsAgo / 60)}m`, color: 'text-red-500', icon: SignalSlashIcon }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <VideoCameraIcon className="h-7 w-7" />
            Grabaciones Resilientes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Reconexión automática y monitoreo de salud
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditConfig(config)
              setShowConfig(true)
            }}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Configuración"
          >
            <Cog6ToothIcon className="h-6 w-6" />
          </button>
          
          {recordings.length > 0 && (
            <button
              onClick={stopAll}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
            >
              <StopIcon className="h-5 w-5" />
              Detener Todas
            </button>
          )}
          
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Actualizar"
          >
            <ArrowPathIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Estado de reconexión */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <ArrowPathIcon className="h-6 w-6 text-blue-500" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Reconexión Automática: {config.autoReconnect ? 'Habilitada' : 'Deshabilitada'}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Máximo {config.maxReconnectAttempts || 10} intentos • 
              Verificación cada {(config.healthCheckInterval || 30000) / 1000}s
            </p>
          </div>
        </div>
      </div>

      {/* Grabaciones activas */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Grabaciones Activas ({recordings.length})
        </h3>
        
        {recordings.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <VideoCameraIcon className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500 dark:text-gray-400">No hay grabaciones activas</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recordings.map((recording) => {
              const activity = getActivityStatus(recording.lastActivity)
              const ActivityIcon = activity.icon
              
              return (
                <div
                  key={recording.cameraId}
                  className={`bg-white dark:bg-gray-800 rounded-lg border p-4 ${
                    recording.isHealthy 
                      ? 'border-green-200 dark:border-green-800' 
                      : 'border-red-200 dark:border-red-800'
                  }`}
                >
                  {/* Header de cámara */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {recording.isHealthy ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {recording.cameraName}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => stopRecording(recording.cameraId)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Detener grabación"
                    >
                      <StopIcon className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {/* Info del escenario */}
                  {recording.scenarioName && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                      📋 {recording.scenarioName}
                    </div>
                  )}
                  
                  {/* Estadísticas */}
                  <div className="space-y-2 text-sm">
                    {/* Duración */}
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        Duración
                      </span>
                      <span>{formatDuration(recording.duration)}</span>
                    </div>
                    
                    {/* Frames */}
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span>Frames procesados</span>
                      <span className="font-mono">{recording.framesProcessed?.toLocaleString() || 0}</span>
                    </div>
                    
                    {/* Última actividad */}
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <ActivityIcon className={`h-4 w-4 ${activity.color}`} />
                        Actividad
                      </span>
                      <span className={activity.color}>{activity.text}</span>
                    </div>
                    
                    {/* Reconexiones */}
                    {recording.reconnectAttempts > 0 && (
                      <div className="flex items-center justify-between text-yellow-600 dark:text-yellow-400">
                        <span className="flex items-center gap-1">
                          <ExclamationTriangleIcon className="h-4 w-4" />
                          Reconexiones
                        </span>
                        <span>{recording.reconnectAttempts}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Errores recientes */}
                  {recording.errors && recording.errors.length > 0 && (
                    <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
                      <p className="text-red-600 dark:text-red-400 font-medium mb-1">
                        Últimos errores:
                      </p>
                      {recording.errors.slice(-2).map((err, idx) => (
                        <p key={idx} className="text-red-500 dark:text-red-400 truncate">
                          {err.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cámaras disponibles */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Cámaras Disponibles
        </h3>
        
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {cameras.map((camera) => {
            const isRecording = recordings.some(r => r.cameraId === camera.id)
            
            return (
              <div
                key={camera.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {camera.name}
                  </p>
                  <p className={`text-xs ${camera.isActive ? 'text-green-500' : 'text-gray-400'}`}>
                    {camera.isActive ? 'Activa' : 'Inactiva'}
                  </p>
                </div>
                
                {isRecording ? (
                  <div className="flex items-center gap-1 text-red-500">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs">REC</span>
                  </div>
                ) : (
                  <button
                    onClick={() => startRecording(camera)}
                    disabled={!camera.isActive}
                    className={`p-2 rounded ${
                      camera.isActive
                        ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                    title={camera.isActive ? 'Iniciar grabación' : 'Cámara inactiva'}
                  >
                    <PlayIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de configuración */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Configuración de Grabaciones
            </h3>
            
            <div className="space-y-4">
              {/* Auto reconexión */}
              <label className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">Reconexión automática</span>
                <input
                  type="checkbox"
                  checked={editConfig.autoReconnect}
                  onChange={(e) => setEditConfig({...editConfig, autoReconnect: e.target.checked})}
                  className="h-5 w-5 text-blue-600 rounded"
                />
              </label>
              
              {/* Máximo reintentos */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Máximo reintentos (0 = infinito)
                </label>
                <input
                  type="number"
                  value={editConfig.maxReconnectAttempts || 0}
                  onChange={(e) => setEditConfig({...editConfig, maxReconnectAttempts: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="0"
                />
              </div>
              
              {/* Delay de reconexión */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Delay entre reintentos (ms)
                </label>
                <input
                  type="number"
                  value={editConfig.reconnectDelay || 5000}
                  onChange={(e) => setEditConfig({...editConfig, reconnectDelay: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="1000"
                  step="1000"
                />
              </div>
              
              {/* Intervalo de salud */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Verificación de salud (ms)
                </label>
                <input
                  type="number"
                  value={editConfig.healthCheckInterval || 30000}
                  onChange={(e) => setEditConfig({...editConfig, healthCheckInterval: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="5000"
                  step="5000"
                />
              </div>
              
              {/* Timeout de stale */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Timeout sin actividad (ms)
                </label>
                <input
                  type="number"
                  value={editConfig.staleTimeout || 60000}
                  onChange={(e) => setEditConfig({...editConfig, staleTimeout: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="10000"
                  step="10000"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={saveConfig}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
