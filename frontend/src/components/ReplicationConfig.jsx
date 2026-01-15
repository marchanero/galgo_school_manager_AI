import { useState, useEffect } from 'react'
import { 
  Cloud, RefreshCw, Save, Play, Clock, Calendar, 
  Trash2, HardDrive, CheckCircle, AlertCircle, 
  Loader2, ToggleLeft, ToggleRight, Info
} from 'lucide-react'
import api from '../services/api'

export default function ReplicationConfig() {
  const [config, setConfig] = useState({
    schedule: '0 3 * * *',
    enabled: false,
    retentionDays: 0,
    deleteAfterExport: false
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const data = await api.getReplicationConfig()
      setConfig(data)
    } catch (error) {
      console.error('Error fetching replication config:', error)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setMessage(null)
    try {
      await api.saveReplicationConfig(config)
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' })
    } catch (error) {
      console.error('Error saving config:', error)
      setMessage({ type: 'error', text: 'Error al guardar la configuración' })
    } finally {
      setLoading(false)
    }
  }

  const handleManualReplication = async () => {
    setLoading(true)
    setMessage(null)
    try {
      await api.startReplication()
      setMessage({ type: 'success', text: 'Replicación manual iniciada' })
    } catch (error) {
      console.error('Error starting replication:', error)
      setMessage({ type: 'error', text: 'Error al iniciar replicación' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Configuración de Replicación
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sincronización automática de grabaciones
            </p>
          </div>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Toggle Principal */}
        <div 
          onClick={() => setConfig({ ...config, enabled: !config.enabled })}
          className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${
            config.enabled 
              ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800' 
              : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              config.enabled 
                ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                : 'bg-gray-200 dark:bg-gray-600'
            }`}>
              <RefreshCw className={`w-5 h-5 ${config.enabled ? 'text-emerald-600' : 'text-gray-500'}`} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Replicación Automática
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {config.enabled ? 'Sincronización programada activa' : 'La sincronización está desactivada'}
              </p>
            </div>
          </div>
          {config.enabled ? (
            <ToggleRight className="w-10 h-10 text-emerald-500" />
          ) : (
            <ToggleLeft className="w-10 h-10 text-gray-400" />
          )}
        </div>

        {/* Schedule Configuration */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-indigo-500" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Programación</h4>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expresión Cron
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={config.schedule}
                  onChange={(e) => setConfig({ ...config, schedule: e.target.value })}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="0 3 * * *"
                />
                <div className="px-4 py-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm text-indigo-700 dark:text-indigo-400 font-medium">
                    Diario 3:00 AM
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Formato: minuto hora día mes díaSemana
              </p>
            </div>
          </div>
        </div>

        {/* Retention Policy */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-5 h-5 text-amber-600" />
            <h4 className="font-semibold text-amber-800 dark:text-amber-300">Política de Retención Local</h4>
          </div>
          
          <div className="space-y-4">
            <div 
              onClick={() => setConfig({ ...config, deleteAfterExport: !config.deleteAfterExport })}
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                config.deleteAfterExport 
                  ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700' 
                  : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Trash2 className={`w-5 h-5 ${config.deleteAfterExport ? 'text-amber-600' : 'text-gray-400'}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Eliminar archivos locales después de sincronizar
                </span>
              </div>
              {config.deleteAfterExport ? (
                <CheckCircle className="w-5 h-5 text-amber-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-500" />
              )}
            </div>

            <div className={`transition-all ${config.deleteAfterExport ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <label className="block text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                Mantener archivos por (días)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={config.retentionDays}
                  onChange={(e) => setConfig({ ...config, retentionDays: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-3 border border-amber-300 dark:border-amber-700 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center font-semibold focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  días antes de eliminar
                </span>
              </div>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>0 = eliminar inmediatamente después de sincronizar exitosamente</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {loading ? 'Guardando...' : 'Guardar Configuración'}
          </button>
          
          <button
            onClick={handleManualReplication}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Ejecutar Ahora
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`flex items-center gap-3 p-4 rounded-xl ${
            message.type === 'success' 
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}
      </div>
    </div>
  )
}
