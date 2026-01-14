import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import ConfirmModal from './ConfirmModal'
import { toast } from 'react-hot-toast'
import {
  Play,
  Square,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Video,
  Clock,
  Wifi,
  WifiOff,
  Film,
  Calendar,
  HardDrive,
  Trash2,
  Download,
  Image,
  FolderOpen
} from 'lucide-react'

/**
 * RecordingDashboard - Panel de control de grabaciones resilientes
 * 
 * Muestra estado de grabaciones con reconexión automática
 */
export default function RecordingDashboard() {
  const [recordings, setRecordings] = useState([])
  const [savedRecordings, setSavedRecordings] = useState([])
  const [config, setConfig] = useState({})
  const [cameras, setCameras] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [editConfig, setEditConfig] = useState({})
  const [activeTab, setActiveTab] = useState('active') // 'active' | 'saved'
  const [filterScenario, setFilterScenario] = useState('')
  const [filterCamera, setFilterCamera] = useState('')
  // Estado para confirmación de detener grabación
  const [confirmStop, setConfirmStop] = useState({ isOpen: false, cameraId: null, cameraName: '' })
  const [confirmStopAll, setConfirmStopAll] = useState(false)
  // Estado para confirmación de eliminar grabación guardada
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, recording: null })
  // Estado para generación de thumbnails
  const [generatingThumbnail, setGeneratingThumbnail] = useState(null)

  // Cargar datos - combina grabaciones de recordingManager y mediaServer
  const loadData = useCallback(async () => {
    try {
      const [statusRes, mediaRes, camerasRes, storageRes] = await Promise.all([
        api.getRecordingsStatus().catch(() => ({ data: { recordings: [], config: {} } })),
        api.getMediaStatus().catch(() => ({ recording: [], recordingDetails: [] })),
        api.getCameras(),
        api.getStorageRecordings().catch(() => ({ data: { recordings: [] } }))
      ])
      
      // Grabaciones del recordingManager
      const recordingManagerRecs = statusRes.data?.recordings || []
      
      // Grabaciones guardadas
      setSavedRecordings(storageRes.data?.recordings || [])
      
      // Grabaciones del mediaServer (convertir al mismo formato)
      const mediaServerRecs = (mediaRes.recordingDetails || []).map(detail => ({
        cameraId: detail.cameraId,
        cameraName: detail.cameraName || `Cámara ${detail.cameraId}`,
        status: 'recording',
        startedAt: detail.startTime,
        elapsedSeconds: detail.elapsedSeconds || 0,
        scenarioName: detail.scenarioName,
        source: 'mediaServer',
        lastActivity: Date.now(),
        bytesWritten: 0,
        reconnectAttempts: 0
      }))
      
      // Combinar sin duplicados (priorizar mediaServer)
      const mediaServerIds = new Set(mediaServerRecs.map(r => r.cameraId))
      const combined = [
        ...mediaServerRecs,
        ...recordingManagerRecs.filter(r => !mediaServerIds.has(r.cameraId))
      ]
      
      setRecordings(combined)
      setConfig(statusRes.data?.config || {})
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

  // Solicitar confirmación para detener grabación individual
  const requestStopRecording = (cameraId, cameraName, source) => {
    setConfirmStop({ isOpen: true, cameraId, cameraName, source })
  }

  // Confirmar y detener grabación individual
  const confirmStopRecording = async () => {
    try {
      // Intentar detener en ambos sistemas para asegurar que se detiene
      const stopPromises = [
        api.stopRecording(confirmStop.cameraId).catch(() => {}),
        api.stopMediaRecording(confirmStop.cameraId).catch(() => {})
      ]
      await Promise.all(stopPromises)
      
      toast.success(`Grabación de "${confirmStop.cameraName}" detenida`)
      setConfirmStop({ isOpen: false, cameraId: null, cameraName: '', source: null })
      loadData()
    } catch (error) {
      console.error('Error deteniendo grabación:', error)
      toast.error('Error al detener grabación')
    }
  }

  // Solicitar confirmación para detener todas
  const requestStopAll = () => {
    setConfirmStopAll(true)
  }

  // Confirmar y detener todas las grabaciones
  const confirmStopAllRecordings = async () => {
    try {
      // Detener en ambos sistemas
      await Promise.all([
        api.stopAllRecordings().catch(() => {}),
        api.stopAllMediaRecordings().catch(() => {})
      ])
      toast.success('Todas las grabaciones detenidas')
      setConfirmStopAll(false)
      loadData()
    } catch (error) {
      console.error('Error deteniendo grabaciones:', error)
      toast.error('Error al detener grabaciones')
    }
  }

  // Solicitar confirmación para eliminar grabación guardada
  const requestDeleteRecording = (recording) => {
    setConfirmDelete({ isOpen: true, recording })
  }

  // Confirmar y eliminar grabación guardada
  const confirmDeleteRecording = async () => {
    const { recording } = confirmDelete
    if (!recording) return
    
    try {
      await api.deleteStorageRecording(
        recording.scenario,
        recording.date,
        recording.cameraId,
        recording.filename
      )
      toast.success(`Grabación "${recording.filename}" eliminada`)
      setConfirmDelete({ isOpen: false, recording: null })
      loadData()
    } catch (error) {
      console.error('Error eliminando grabación:', error)
      toast.error('Error al eliminar grabación')
    }
  }

  // Generar thumbnail para una grabación
  const handleGenerateThumbnail = async (recording) => {
    setGeneratingThumbnail(recording.filename)
    try {
      await api.generateThumbnail(
        recording.scenario,
        recording.date,
        recording.cameraId,
        recording.filename
      )
      toast.success('Thumbnail añadido a la cola de procesamiento')
      // Recargar después de un momento para que se genere
      setTimeout(() => loadData(), 3000)
    } catch (error) {
      console.error('Error generando thumbnail:', error)
      toast.error('Error al generar thumbnail')
    } finally {
      setGeneratingThumbnail(null)
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
    
    if (secondsAgo < 5) return { text: 'En vivo', color: 'text-green-500', icon: Wifi }
    if (secondsAgo < 30) return { text: `Hace ${secondsAgo}s`, color: 'text-green-400', icon: Wifi }
    if (secondsAgo < 60) return { text: `Hace ${secondsAgo}s`, color: 'text-yellow-500', icon: Wifi }
    return { text: `Hace ${Math.floor(secondsAgo / 60)}m`, color: 'text-red-500', icon: WifiOff }
  }

  // Formatear tamaño de archivo
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Formatear fecha legible
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Obtener URL del thumbnail para un video
  const getThumbnailUrl = (recording) => {
    // Construir la URL del thumbnail basándose en el nombre del video
    const videoName = recording.filename?.replace('.mp4', '') || ''
    return `/api/storage/thumbnail/${videoName}_thumb.jpg`
  }

  // Construir URL de descarga
  const getDownloadUrl = (recording) => {
    const params = new URLSearchParams({
      scenario: recording.scenario,
      date: recording.date,
      cameraId: recording.cameraId,
      filename: recording.filename
    })
    return `/api/storage/download?${params}`
  }

  // Filtrar grabaciones guardadas
  const filteredSavedRecordings = savedRecordings.filter(rec => {
    if (filterScenario && rec.scenario !== filterScenario) return false
    if (filterCamera && rec.cameraId !== filterCamera) return false
    return true
  })

  // Obtener escenarios únicos para el filtro
  const uniqueScenarios = [...new Set(savedRecordings.map(r => r.scenario).filter(Boolean))]
  const uniqueCameras = [...new Set(savedRecordings.map(r => r.cameraId).filter(Boolean))]

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Video className="h-7 w-7" />
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
            <Settings className="h-6 w-6" />
          </button>
          
          {recordings.length > 0 && (
            <button
              onClick={requestStopAll}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
            >
              <Square className="h-5 w-5" />
              Detener Todas
            </button>
          )}
          
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Actualizar"
          >
            <RefreshCw className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Activas ({recordings.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'saved'
              ? 'border-green-500 text-green-600 dark:text-green-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4" />
            Guardadas ({savedRecordings.length})
          </div>
        </button>
      </div>

      {/* Estado de reconexión */}
      {activeTab === 'active' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-6 w-6 text-blue-500" />
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
      )}

      {/* Grabaciones activas */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Grabaciones Activas ({recordings.length})
          </h3>
          
          {recordings.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Video className="h-12 w-12 mx-auto text-gray-400 mb-2" />
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
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {recording.cameraName}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => requestStopRecording(recording.cameraId, recording.cameraName)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Detener grabación"
                    >
                      <Square className="h-5 w-5" />
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
                        <Clock className="h-4 w-4" />
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
                          <AlertTriangle className="h-4 w-4" />
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
      )}

      {/* Cámaras disponibles */}
      {activeTab === 'active' && (
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
                      <Play className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Grabaciones guardadas */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-gray-400" />
              <select
                value={filterScenario}
                onChange={(e) => setFilterScenario(e.target.value)}
                className="px-3 py-1.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              >
                <option value="">Todos los escenarios</option>
                {uniqueScenarios.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-gray-400" />
              <select
                value={filterCamera}
                onChange={(e) => setFilterCamera(e.target.value)}
                className="px-3 py-1.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              >
                <option value="">Todas las cámaras</option>
                {uniqueCameras.map(c => (
                  <option key={c} value={c}>Cámara {c}</option>
                ))}
              </select>
            </div>
            
            <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {filteredSavedRecordings.length} grabaciones
            </div>
          </div>

          {/* Lista de grabaciones */}
          {filteredSavedRecordings.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Film className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">No hay grabaciones guardadas</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                Las grabaciones aparecerán aquí cuando se detengan
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredSavedRecordings.map((recording, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-100 dark:bg-gray-900 group">
                    <img
                      src={getThumbnailUrl(recording)}
                      alt={recording.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                    <div className="hidden absolute inset-0 items-center justify-center bg-gray-200 dark:bg-gray-700 flex-col gap-2">
                      <Image className="h-10 w-10 text-gray-400" />
                      <button
                        onClick={() => handleGenerateThumbnail(recording)}
                        disabled={generatingThumbnail === recording.filename}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                      >
                        {generatingThumbnail === recording.filename ? 'Generando...' : 'Generar Thumbnail'}
                      </button>
                    </div>
                    {/* Duración */}
                    {recording.duration && (
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded">
                        {formatDuration(recording.duration * 1000)}
                      </div>
                    )}
                    {/* Botón de generar thumbnail en hover */}
                    <button
                      onClick={() => handleGenerateThumbnail(recording)}
                      disabled={generatingThumbnail === recording.filename}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 disabled:opacity-50"
                      title="Regenerar thumbnail"
                    >
                      <Image className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* Info */}
                  <div className="p-3">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate" title={recording.filename}>
                      {recording.filename}
                    </h4>
                    
                    <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(recording.created)}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3.5 w-3.5" />
                        <span>{recording.sizeFormatted || formatBytes(recording.size)}</span>
                      </div>
                      
                      {recording.scenario && (
                        <div className="flex items-center gap-1">
                          <FolderOpen className="h-3.5 w-3.5" />
                          <span className="truncate">{recording.scenario}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Acciones */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <a
                        href={getDownloadUrl(recording)}
                        download={recording.filename}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Descargar
                      </a>
                      <button
                        onClick={() => requestDeleteRecording(recording)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Eliminar grabación"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Modal de confirmación para detener grabación individual */}
      <ConfirmModal
        isOpen={confirmStop.isOpen}
        onClose={() => setConfirmStop({ isOpen: false, cameraId: null, cameraName: '' })}
        onConfirm={confirmStopRecording}
        title="Detener Grabación"
        message={`¿Estás seguro de que deseas detener la grabación de "${confirmStop.cameraName}"? El archivo se guardará automáticamente.`}
        confirmText="Sí, detener"
        cancelText="Cancelar"
        isDanger={true}
      />

      {/* Modal de confirmación para detener todas las grabaciones */}
      <ConfirmModal
        isOpen={confirmStopAll}
        onClose={() => setConfirmStopAll(false)}
        onConfirm={confirmStopAllRecordings}
        title="Detener Todas las Grabaciones"
        message={`¿Estás seguro de que deseas detener todas las grabaciones (${recordings.length} activas)? Todos los archivos se guardarán automáticamente.`}
        confirmText="Sí, detener todas"
        cancelText="Cancelar"
        isDanger={true}
      />

      {/* Modal de confirmación para eliminar grabación guardada */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, recording: null })}
        onConfirm={confirmDeleteRecording}
        title="Eliminar Grabación"
        message={`¿Estás seguro de que deseas eliminar "${confirmDelete.recording?.filename}"? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        isDanger={true}
      />
    </div>
  )
}
