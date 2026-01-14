import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { 
  PhotoIcon, 
  FilmIcon, 
  ScissorsIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  Cog6ToothIcon,
  FolderOpenIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'

/**
 * VideoProcessing - Panel de post-procesamiento de video
 */
export default function VideoProcessing() {
  const [activeTab, setActiveTab] = useState('thumbnails')
  const [queueStatus, setQueueStatus] = useState({ queue: [], stats: {} })
  const [thumbnails, setThumbnails] = useState([])
  const [clips, setClips] = useState([])
  const [config, setConfig] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [editConfig, setEditConfig] = useState({})
  
  // Estados para formularios
  const [clipForm, setClipForm] = useState({
    videoPath: '',
    startTime: '00:00:00',
    duration: 30,
    reencode: false
  })
  const [compressForm, setCompressForm] = useState({
    olderThanDays: 7,
    dryRun: true
  })

  // Cargar datos
  const loadData = useCallback(async () => {
    try {
      const [statusRes, thumbsRes, clipsRes, configRes] = await Promise.all([
        api.getProcessingStatus(),
        api.getProcessingThumbnails(),
        api.getProcessingClips(),
        api.getProcessingConfig()
      ])
      
      setQueueStatus(statusRes.data || { queue: [], stats: {} })
      setThumbnails(thumbsRes.data?.thumbnails || [])
      setClips(clipsRes.data?.clips || [])
      setConfig(configRes.data?.config || {})
      setIsLoading(false)
    } catch (error) {
      console.error('Error cargando datos:', error)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [loadData])

  // Generar thumbnails en lote
  const generateBatchThumbnails = async () => {
    try {
      const result = await api.generateBatchThumbnails({ recursive: true, force: false })
      alert(`Generados: ${result.data.summary.generated}, Omitidos: ${result.data.summary.skipped}`)
      loadData()
    } catch (error) {
      console.error('Error generando thumbnails:', error)
      alert('Error generando thumbnails')
    }
  }

  // Extraer clip
  const extractClip = async () => {
    if (!clipForm.videoPath || !clipForm.startTime) {
      alert('Ruta de video y tiempo de inicio son requeridos')
      return
    }
    
    try {
      await api.extractClip({
        videoPath: clipForm.videoPath,
        startTime: clipForm.startTime,
        duration: clipForm.duration,
        reencode: clipForm.reencode,
        async: true
      })
      alert('Tarea de extracción añadida a la cola')
      loadData()
    } catch (error) {
      console.error('Error extrayendo clip:', error)
      alert('Error extrayendo clip')
    }
  }

  // Comprimir videos antiguos
  const compressOldVideos = async () => {
    try {
      const result = await api.compressOldVideos({
        olderThanDays: compressForm.olderThanDays,
        dryRun: compressForm.dryRun
      })
      
      if (compressForm.dryRun) {
        alert(`Modo prueba: Se encontraron ${result.data.videosFound} videos`)
      } else {
        alert(`Comprimidos: ${result.data.videosCompressed}, Espacio liberado: ${result.data.totalSpaceSavedFormatted}`)
      }
      loadData()
    } catch (error) {
      console.error('Error comprimiendo:', error)
      alert('Error comprimiendo videos')
    }
  }

  // Cancelar tarea
  const cancelTask = async (taskId) => {
    try {
      await api.cancelProcessingTask(taskId)
      loadData()
    } catch (error) {
      console.error('Error cancelando tarea:', error)
    }
  }

  // Guardar configuración
  const saveConfig = async () => {
    try {
      await api.updateProcessingConfig(editConfig)
      setShowConfig(false)
      loadData()
    } catch (error) {
      console.error('Error guardando configuración:', error)
    }
  }

  // Formatear fecha
  const formatDate = (date) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
            <FilmIcon className="h-7 w-7" />
            Post-procesamiento de Video
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Thumbnails, compresión y extracción de clips
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
          
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Actualizar"
          >
            <ArrowPathIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <PhotoIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Thumbnails</span>
          </div>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200 mt-1">
            {queueStatus.stats?.thumbnailsGenerated || 0}
          </p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <ScissorsIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Clips</span>
          </div>
          <p className="text-2xl font-bold text-green-800 dark:text-green-200 mt-1">
            {queueStatus.stats?.clipsExtracted || 0}
          </p>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <FolderOpenIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Comprimidos</span>
          </div>
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-200 mt-1">
            {queueStatus.stats?.videosCompressed || 0}
          </p>
        </div>
        
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <ClockIcon className="h-5 w-5" />
            <span className="text-sm font-medium">En cola</span>
          </div>
          <p className="text-2xl font-bold text-orange-800 dark:text-orange-200 mt-1">
            {queueStatus.queueLength || 0}
          </p>
        </div>
      </div>

      {/* Cola de tareas */}
      {(queueStatus.currentTask || queueStatus.queue?.length > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            Cola de Procesamiento
          </h3>
          
          <div className="space-y-2">
            {queueStatus.currentTask && (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                <div className="flex items-center gap-2">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">
                    {queueStatus.currentTask.type}
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    (procesando)
                  </span>
                </div>
              </div>
            )}
            
            {queueStatus.queue?.map((task) => (
              <div 
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {task.type}
                  </span>
                </div>
                <button
                  onClick={() => cancelTask(task.id)}
                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {[
            { id: 'thumbnails', label: 'Thumbnails', icon: PhotoIcon },
            { id: 'clips', label: 'Clips', icon: ScissorsIcon },
            { id: 'compress', label: 'Compresión', icon: FolderOpenIcon }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Contenido de tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {/* Tab Thumbnails */}
        {activeTab === 'thumbnails' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Thumbnails Generados ({thumbnails.length})
              </h3>
              <button
                onClick={generateBatchThumbnails}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <PhotoIcon className="h-5 w-5" />
                Generar para todos los videos
              </button>
            </div>
            
            {thumbnails.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay thumbnails generados
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {thumbnails.map((thumb) => (
                  <div key={thumb.name} className="relative group">
                    <img
                      src={`/thumbnails/${thumb.name}`}
                      alt={thumb.name}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <p className="text-white text-xs text-center px-2 truncate">
                        {thumb.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Clips */}
        {activeTab === 'clips' && (
          <div className="space-y-6">
            {/* Formulario de extracción */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Extraer Nuevo Clip
                </h3>
                
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Ruta del video
                  </label>
                  <input
                    type="text"
                    value={clipForm.videoPath}
                    onChange={(e) => setClipForm({...clipForm, videoPath: e.target.value})}
                    placeholder="recordings/escenario/2024-01-14/camera_1/..."
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Inicio (HH:MM:SS)
                    </label>
                    <input
                      type="text"
                      value={clipForm.startTime}
                      onChange={(e) => setClipForm({...clipForm, startTime: e.target.value})}
                      className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Duración (seg)
                    </label>
                    <input
                      type="number"
                      value={clipForm.duration}
                      onChange={(e) => setClipForm({...clipForm, duration: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      min="1"
                    />
                  </div>
                </div>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={clipForm.reencode}
                    onChange={(e) => setClipForm({...clipForm, reencode: e.target.checked})}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Recodificar (más lento, corte preciso)
                  </span>
                </label>
                
                <button
                  onClick={extractClip}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                >
                  <ScissorsIcon className="h-5 w-5" />
                  Extraer Clip
                </button>
              </div>
              
              {/* Lista de clips */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Clips Generados ({clips.length})
                </h3>
                
                {clips.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay clips generados
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {clips.map((clip) => (
                      <div 
                        key={clip.name}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-xs">
                            {clip.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {clip.sizeFormatted} • {formatDate(clip.createdAt)}
                          </p>
                        </div>
                        <a
                          href={`/clips/${clip.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        >
                          <PlayIcon className="h-5 w-5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Compresión */}
        {activeTab === 'compress' && (
          <div className="space-y-6">
            <div className="max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Comprimir Videos Antiguos
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Videos con más de X días
                  </label>
                  <input
                    type="number"
                    value={compressForm.olderThanDays}
                    onChange={(e) => setCompressForm({...compressForm, olderThanDays: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    min="1"
                  />
                </div>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={compressForm.dryRun}
                    onChange={(e) => setCompressForm({...compressForm, dryRun: e.target.checked})}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Modo prueba (solo listar, no comprimir)
                  </span>
                </label>
                
                <button
                  onClick={compressOldVideos}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    compressForm.dryRun
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-orange-500 hover:bg-orange-600 text-white'
                  }`}
                >
                  <FolderOpenIcon className="h-5 w-5" />
                  {compressForm.dryRun ? 'Buscar videos' : 'Comprimir videos'}
                </button>
              </div>
              
              <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Nota:</strong> La compresión reduce el tamaño pero puede tardar varios minutos por archivo.
                  El CRF actual es {config.compressionCrf || 28} (menor = mejor calidad, mayor tamaño).
                </p>
              </div>
            </div>
            
            {/* Estadísticas de compresión */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Estadísticas de Compresión
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Espacio total liberado: <strong>{formatBytes(queueStatus.stats?.totalSpaceSaved || 0)}</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de configuración */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Configuración de Procesamiento
            </h3>
            
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300">Thumbnails</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Ancho
                  </label>
                  <input
                    type="number"
                    value={editConfig.thumbnailWidth || 320}
                    onChange={(e) => setEditConfig({...editConfig, thumbnailWidth: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Alto
                  </label>
                  <input
                    type="number"
                    value={editConfig.thumbnailHeight || 180}
                    onChange={(e) => setEditConfig({...editConfig, thumbnailHeight: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
              
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mt-4">Compresión</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    CRF (0-51)
                  </label>
                  <input
                    type="number"
                    value={editConfig.compressionCrf || 28}
                    onChange={(e) => setEditConfig({...editConfig, compressionCrf: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    min="0"
                    max="51"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Preset
                  </label>
                  <select
                    value={editConfig.compressionPreset || 'medium'}
                    onChange={(e) => setEditConfig({...editConfig, compressionPreset: e.target.value})}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="ultrafast">ultrafast</option>
                    <option value="fast">fast</option>
                    <option value="medium">medium</option>
                    <option value="slow">slow</option>
                  </select>
                </div>
              </div>
              
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mt-4">Clips</h4>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Duración por defecto (seg)
                </label>
                <input
                  type="number"
                  value={editConfig.defaultClipDuration || 30}
                  onChange={(e) => setEditConfig({...editConfig, defaultClipDuration: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="1"
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

// Helper para formatear bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
