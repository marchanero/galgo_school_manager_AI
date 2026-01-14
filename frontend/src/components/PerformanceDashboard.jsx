import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { 
  Cpu as CpuChipIcon, 
  Server as ServerIcon,
  Zap as BoltIcon,
  RefreshCw as ArrowPathIcon,
  BarChart2 as ChartBarIcon,
  Settings as Cog6ToothIcon,
  Play as PlayIcon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  Activity as SignalIcon,
  Clock as ClockIcon
} from 'lucide-react'

/**
 * PerformanceDashboard - Panel de monitoreo y optimización de rendimiento
 */
export default function PerformanceDashboard() {
  const [status, setStatus] = useState(null)
  const [benchmarkResults, setBenchmarkResults] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBenchmarking, setIsBenchmarking] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [editConfig, setEditConfig] = useState({})

  // Cargar datos
  const loadData = useCallback(async () => {
    try {
      const response = await api.getPerformanceStatus()
      setStatus(response.data)
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

  // Cambiar perfil
  const setProfile = async (profile) => {
    try {
      await api.setPerformanceProfile(profile)
      loadData()
    } catch (error) {
      console.error('Error cambiando perfil:', error)
      alert('Error cambiando perfil')
    }
  }

  // Toggle HW Accel
  const toggleHwAccel = async () => {
    try {
      await api.setHwAccel(!status?.state?.hwAccelEnabled)
      loadData()
    } catch (error) {
      console.error('Error configurando hwaccel:', error)
      alert('Error configurando aceleración por hardware')
    }
  }

  // Ejecutar benchmark
  const runBenchmark = async () => {
    setIsBenchmarking(true)
    try {
      const response = await api.runPerformanceBenchmark()
      setBenchmarkResults(response.data)
      loadData()
    } catch (error) {
      console.error('Error ejecutando benchmark:', error)
      alert('Error ejecutando benchmark')
    }
    setIsBenchmarking(false)
  }

  // Re-detectar hardware
  const detectHardware = async () => {
    try {
      await api.detectHardware()
      loadData()
    } catch (error) {
      console.error('Error detectando hardware:', error)
    }
  }

  // Guardar configuración
  const saveConfig = async () => {
    try {
      await api.updatePerformanceConfig(editConfig)
      setShowConfig(false)
      loadData()
    } catch (error) {
      console.error('Error guardando configuración:', error)
    }
  }

  // Formatear bytes
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const { state, metrics, hardware, cache, config } = status || {}

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BoltIcon className="h-7 w-7" />
            Rendimiento del Sistema
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Hardware, encoding y optimización
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditConfig(config || {})
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

      {/* Métricas en tiempo real */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* CPU */}
        <div className={`rounded-lg p-4 ${
          metrics?.cpuUsage > 80 ? 'bg-red-50 dark:bg-red-900/20' :
          metrics?.cpuUsage > 60 ? 'bg-yellow-50 dark:bg-yellow-900/20' :
          'bg-green-50 dark:bg-green-900/20'
        }`}>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <CpuChipIcon className="h-5 w-5" />
            <span className="text-sm font-medium">CPU</span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${
            metrics?.cpuUsage > 80 ? 'text-red-600 dark:text-red-400' :
            metrics?.cpuUsage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-green-600 dark:text-green-400'
          }`}>
            {metrics?.cpuUsage || 0}%
          </p>
        </div>
        
        {/* Memoria */}
        <div className={`rounded-lg p-4 ${
          metrics?.memoryUsage > 80 ? 'bg-red-50 dark:bg-red-900/20' :
          metrics?.memoryUsage > 60 ? 'bg-yellow-50 dark:bg-yellow-900/20' :
          'bg-blue-50 dark:bg-blue-900/20'
        }`}>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <ServerIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Memoria</span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${
            metrics?.memoryUsage > 80 ? 'text-red-600 dark:text-red-400' :
            metrics?.memoryUsage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-blue-600 dark:text-blue-400'
          }`}>
            {metrics?.memoryUsage || 0}%
          </p>
        </div>
        
        {/* Cache Hit Rate */}
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <SignalIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Cache Hit</span>
          </div>
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-200 mt-1">
            {cache?.hitRate || '0%'}
          </p>
        </div>
        
        {/* Perfil activo */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <ChartBarIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Perfil</span>
          </div>
          <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-200 mt-1 capitalize">
            {state?.currentProfile || 'balanced'}
          </p>
        </div>
      </div>

      {/* Hardware Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Hardware Detectado
          </h3>
          <button
            onClick={detectHardware}
            className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Re-detectar
          </button>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Sistema */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-600 dark:text-gray-400">CPU</span>
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {hardware?.cpu || 'Desconocido'}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-600 dark:text-gray-400">GPU</span>
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {hardware?.gpu || 'No detectada'}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-600 dark:text-gray-400">Núcleos CPU</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {hardware?.systemInfo?.cpus || 0}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-600 dark:text-gray-400">Memoria Total</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatBytes(hardware?.systemInfo?.totalMemory)}
              </span>
            </div>
          </div>
          
          {/* Encoders */}
          <div>
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">
              Encoders Disponibles
            </h4>
            
            <div className="space-y-2">
              {(hardware?.encoders || ['libx264']).map((encoder) => (
                <div 
                  key={encoder}
                  className={`flex items-center justify-between p-2 rounded ${
                    encoder === hardware?.recommended 
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700'
                  }`}
                >
                  <span className="font-mono text-sm text-gray-900 dark:text-white">
                    {encoder}
                  </span>
                  {encoder === hardware?.recommended && (
                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                      Recomendado
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Perfiles de Encoding */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Perfil de Encoding
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'high', label: 'Alta Calidad', desc: 'Mejor calidad, más CPU' },
              { id: 'balanced', label: 'Balanceado', desc: 'Equilibrio calidad/rendimiento' },
              { id: 'performance', label: 'Rendimiento', desc: 'Menor uso de CPU' },
              { id: 'lowlatency', label: 'Baja Latencia', desc: 'Para tiempo real' }
            ].map((profile) => (
              <button
                key={profile.id}
                onClick={() => setProfile(profile.id)}
                className={`p-3 rounded-lg text-left transition-all ${
                  state?.currentProfile === profile.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <p className="font-medium">{profile.label}</p>
                <p className={`text-xs ${
                  state?.currentProfile === profile.id 
                    ? 'text-blue-100' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {profile.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Aceleración por Hardware */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Aceleración por Hardware
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Usar GPU para encoding
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Encoder activo: <span className="font-mono">{state?.activeEncoder}</span>
                </p>
              </div>
              
              <button
                onClick={toggleHwAccel}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  state?.hwAccelEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    state?.hwAccelEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <button
              onClick={runBenchmark}
              disabled={isBenchmarking}
              className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isBenchmarking ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Ejecutando benchmark...
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5" />
                  Ejecutar Benchmark
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados de Benchmark */}
      {benchmarkResults && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Resultados de Benchmark
          </h3>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {benchmarkResults.results?.map((result) => (
              <div 
                key={result.encoder}
                className={`p-4 rounded-lg ${
                  result.encoder === benchmarkResults.recommended
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : result.success 
                      ? 'bg-gray-50 dark:bg-gray-700'
                      : 'bg-red-50 dark:bg-red-900/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {result.success ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-mono text-sm text-gray-900 dark:text-white">
                    {result.encoder}
                  </span>
                </div>
                
                {result.success ? (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {result.fps}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">FPS</p>
                  </div>
                ) : (
                  <p className="text-sm text-red-500">No disponible</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estadísticas de Cache */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Frame Cache
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {cache?.totalFramesCached || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Frames cacheados</p>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {cache?.totalHits || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Hits</p>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {cache?.totalMisses || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Misses</p>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {cache?.hitRate || '0%'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Hit Rate</p>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {cache?.memoryUsedFormatted || '0 B'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Memoria</p>
          </div>
        </div>
      </div>

      {/* Modal de configuración */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Configuración de Rendimiento
            </h3>
            
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300">Adaptación Automática</h4>
              
              <label className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Habilitada</span>
                <input
                  type="checkbox"
                  checked={editConfig.adaptiveEnabled}
                  onChange={(e) => setEditConfig({...editConfig, adaptiveEnabled: e.target.checked})}
                  className="h-5 w-5 text-blue-600 rounded"
                />
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Umbral CPU alto (%)
                  </label>
                  <input
                    type="number"
                    value={editConfig.cpuHighThreshold || 80}
                    onChange={(e) => setEditConfig({...editConfig, cpuHighThreshold: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    min="50"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Umbral CPU bajo (%)
                  </label>
                  <input
                    type="number"
                    value={editConfig.cpuLowThreshold || 40}
                    onChange={(e) => setEditConfig({...editConfig, cpuLowThreshold: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    min="10"
                    max="50"
                  />
                </div>
              </div>
              
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mt-4">Streaming</h4>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  FPS por defecto
                </label>
                <input
                  type="number"
                  value={editConfig.defaultStreamFps || 15}
                  onChange={(e) => setEditConfig({...editConfig, defaultStreamFps: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="5"
                  max="60"
                />
              </div>
              
              <label className="flex items-center justify-between mt-4">
                <span className="text-gray-600 dark:text-gray-400">Usar HW Accel si disponible</span>
                <input
                  type="checkbox"
                  checked={editConfig.useHwAccelIfAvailable}
                  onChange={(e) => setEditConfig({...editConfig, useHwAccelIfAvailable: e.target.checked})}
                  className="h-5 w-5 text-blue-600 rounded"
                />
              </label>
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
