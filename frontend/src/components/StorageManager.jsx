import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

/**
 * StorageManager - Componente para gestión de almacenamiento
 * 
 * Muestra:
 * - Estado del disco
 * - Configuración de retención
 * - Listado de grabaciones
 * - Acciones de limpieza
 */
export default function StorageManager() {
  const [summary, setSummary] = useState(null)
  const [config, setConfig] = useState(null)
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(true)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState('')
  const [editingConfig, setEditingConfig] = useState(false)
  const [configForm, setConfigForm] = useState({})

  // Cargar datos
  const loadData = useCallback(async () => {
    try {
      const [summaryData, configData, recordingsData] = await Promise.all([
        api.getStorageSummary(),
        api.getStorageConfig(),
        api.getStorageRecordings()
      ])
      
      setSummary(summaryData.data)
      setConfig(configData.data)
      setConfigForm(configData.data)
      setRecordings(recordingsData.data.recordings || [])
    } catch (error) {
      console.error('Error cargando datos de almacenamiento:', error)
      toast.error('Error al cargar datos de almacenamiento')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    
    // Actualizar cada 30 segundos
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  // Obtener color según nivel de alerta
  const getAlertColor = (level) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  // Obtener icono según nivel
  const getAlertIcon = (level) => {
    switch (level) {
      case 'critical': return '🔴'
      case 'warning': return '🟡'
      default: return '🟢'
    }
  }

  // Ejecutar limpieza manual
  const handleCleanup = async () => {
    if (!confirm('¿Ejecutar limpieza de grabaciones antiguas?')) return
    
    setCleaningUp(true)
    try {
      await api.triggerStorageCleanup()
      toast.success('Limpieza iniciada en segundo plano')
      
      // Recargar después de un momento
      setTimeout(loadData, 3000)
    } catch (error) {
      toast.error('Error al iniciar limpieza')
    } finally {
      setCleaningUp(false)
    }
  }

  // Verificar espacio
  const handleCheckSpace = async () => {
    try {
      const result = await api.checkStorageSpace()
      toast.success(`Espacio verificado: ${result.data.disk.usePercent}% usado`)
      loadData()
    } catch (error) {
      toast.error('Error al verificar espacio')
    }
  }

  // Guardar configuración
  const handleSaveConfig = async () => {
    try {
      await api.updateStorageConfig({
        warningThreshold: parseInt(configForm.warningThreshold),
        criticalThreshold: parseInt(configForm.criticalThreshold),
        autoCleanThreshold: parseInt(configForm.autoCleanThreshold),
        defaultRetentionDays: parseInt(configForm.defaultRetentionDays),
        minFreeSpaceGB: parseInt(configForm.minFreeSpaceGB)
      })
      toast.success('Configuración guardada')
      setEditingConfig(false)
      loadData()
    } catch (error) {
      toast.error('Error al guardar configuración')
    }
  }

  // Eliminar grabaciones de escenario
  const handleDeleteScenario = async (scenario) => {
    if (!confirm(`¿Eliminar TODAS las grabaciones del escenario "${scenario}"?`)) return
    
    try {
      const result = await api.deleteScenarioRecordings(scenario)
      toast.success(`Eliminadas ${result.data.deletedCount} grabaciones (${result.data.freedSpaceFormatted})`)
      loadData()
    } catch (error) {
      toast.error('Error al eliminar grabaciones')
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Cargando datos de almacenamiento...</span>
      </div>
    )
  }

  const alertLevel = summary?.status?.alertLevel || 'normal'
  const disk = summary?.disk

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">💾 Gestión de Almacenamiento</h2>
        <div className="flex gap-2">
          <button
            onClick={handleCheckSpace}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            🔄 Verificar
          </button>
          <button
            onClick={handleCleanup}
            disabled={cleaningUp}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {cleaningUp ? '⏳ Limpiando...' : '🧹 Limpiar Ahora'}
          </button>
        </div>
      </div>

      {/* Estado del disco */}
      <div className={`p-4 rounded-lg border ${getAlertColor(alertLevel)}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {getAlertIcon(alertLevel)} Estado del Disco
          </h3>
          <span className="text-sm opacity-75">
            Última verificación: {summary?.status?.lastCheck ? new Date(summary.status.lastCheck).toLocaleTimeString() : 'N/A'}
          </span>
        </div>
        
        {disk && (
          <>
            {/* Barra de progreso */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
              <div
                className={`h-4 rounded-full transition-all ${
                  alertLevel === 'critical' ? 'bg-red-500' :
                  alertLevel === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${disk.usePercent}%` }}
              />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Total:</span>
                <p className="font-semibold">{disk.totalFormatted}</p>
              </div>
              <div>
                <span className="text-gray-500">Usado:</span>
                <p className="font-semibold">{disk.usedFormatted} ({disk.usePercent}%)</p>
              </div>
              <div>
                <span className="text-gray-500">Disponible:</span>
                <p className="font-semibold">{disk.availableFormatted}</p>
              </div>
              <div>
                <span className="text-gray-500">Grabaciones:</span>
                <p className="font-semibold">{disk.recordingsSizeFormatted}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Configuración */}
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">⚙️ Configuración</h3>
          <button
            onClick={() => setEditingConfig(!editingConfig)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {editingConfig ? '✕ Cancelar' : '✏️ Editar'}
          </button>
        </div>

        {editingConfig ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Alerta Warning (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={configForm.warningThreshold || 75}
                onChange={(e) => setConfigForm({...configForm, warningThreshold: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Alerta Critical (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={configForm.criticalThreshold || 90}
                onChange={(e) => setConfigForm({...configForm, criticalThreshold: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Auto-limpiar (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={configForm.autoCleanThreshold || 85}
                onChange={(e) => setConfigForm({...configForm, autoCleanThreshold: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Retención (días)</label>
              <input
                type="number"
                min="1"
                value={configForm.defaultRetentionDays || 30}
                onChange={(e) => setConfigForm({...configForm, defaultRetentionDays: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSaveConfig}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
              >
                💾 Guardar
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Warning:</span>
              <p className="font-semibold">{config?.warningThreshold || 75}%</p>
            </div>
            <div>
              <span className="text-gray-500">Critical:</span>
              <p className="font-semibold">{config?.criticalThreshold || 90}%</p>
            </div>
            <div>
              <span className="text-gray-500">Auto-limpiar:</span>
              <p className="font-semibold">{config?.autoCleanThreshold || 85}%</p>
            </div>
            <div>
              <span className="text-gray-500">Retención:</span>
              <p className="font-semibold">{config?.defaultRetentionDays || 30} días</p>
            </div>
            <div>
              <span className="text-gray-500">Min. libre:</span>
              <p className="font-semibold">{config?.minFreeSpaceGB || 10} GB</p>
            </div>
          </div>
        )}
      </div>

      {/* Resumen por escenario */}
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-4">📊 Grabaciones por Escenario</h3>
        
        {summary?.recordings?.byScenario && Object.keys(summary.recordings.byScenario).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(summary.recordings.byScenario).map(([scenario, data]) => (
              <div key={scenario} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{scenario.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-gray-500">
                    {data.count} archivos • {data.sizeFormatted} • Retención: {data.retentionDays} días
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteScenario(scenario)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                >
                  🗑️ Eliminar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No hay grabaciones</p>
        )}
        
        {summary?.recordings && (
          <div className="mt-4 pt-4 border-t flex justify-between text-sm text-gray-600">
            <span>Total: {summary.recordings.total} archivos</span>
            <span>Tamaño total: {summary.recordings.totalSizeFormatted}</span>
          </div>
        )}
      </div>

      {/* Información de última limpieza */}
      {summary?.status?.lastCleanup && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-700 mb-2">🧹 Última Limpieza</h4>
          <p className="text-sm text-blue-600">
            {new Date(summary.status.lastCleanup).toLocaleString()} • 
            {summary.status.deletedFiles} archivos eliminados • 
            {summary.status.freedSpace ? `${(summary.status.freedSpace / 1024 / 1024 / 1024).toFixed(2)} GB` : '0 B'} liberados
          </p>
        </div>
      )}
    </div>
  )
}
