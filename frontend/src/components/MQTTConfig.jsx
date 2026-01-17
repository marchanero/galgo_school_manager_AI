import { useState } from 'react'
import {
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Database,
  Settings
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useMQTTData } from '../hooks/mqtt/useMQTTData'
import ServerConfigPanel from './mqtt/ServerConfigPanel'
import MonitoringTabs from './mqtt/MonitoringTabs'

const API_BASE = '/api/emqx'

/**
 * MQTTConfig - Main coordinator for EMQX configuration and monitoring
 * 
 * Refactored from 1056 lines to ~200 lines by:
 * - Extracting data fetching to useMQTTData hook
 * - Delegating server config to ServerConfigPanel
 * - Delegating monitoring to MonitoringTabs
 */
export default function MQTTConfig() {
  const [activeTab, setActiveTab] = useState('overview')

  // Use custom hook for all EMQX data
  const {
    health,
    stats,
    clients,
    subscriptions,
    topics,
    nodes,
    listeners,
    alarms,
    servers,
    isLoading,
    loadData,
    reloadServers
  } = useMQTTData()

  // Connection status
  const isConnected = health?.status === 'connected'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              EMQX Broker
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configuración y monitoreo MQTT
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isConnected
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isConnected ? 'Conectado' : 'Desconectado'}
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Server Banner */}
      {servers.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Servidor EMQX Activo</span>
            </div>
            <button
              onClick={() => setActiveTab('servers')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Gestionar Servidores
            </button>
          </div>
          {servers.find(s => s.isActive) ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Nombre:</span>
                <p className="font-medium text-gray-900 dark:text-white">{servers.find(s => s.isActive)?.name}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Broker:</span>
                <p className="font-mono text-gray-900 dark:text-white">{servers.find(s => s.isActive)?.broker}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Usuario:</span>
                <p className="font-mono text-gray-900 dark:text-white">{servers.find(s => s.isActive)?.username || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Estado:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">
                  <Database className="w-3 h-3" />
                  Conectado
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              <p>No hay servidor activo. Ve a la pestaña "Servidores" para activar uno.</p>
            </div>
          )}
        </div>
      )}

      {/* Alarms Alert */}
      {alarms.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Alarmas Activas ({alarms.length})</span>
          </div>
          <div className="space-y-2">
            {alarms.slice(0, 5).map((alarm, idx) => (
              <div key={idx} className="text-sm text-red-600 dark:text-red-300">
                {alarm.name}: {alarm.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content - Conditional Rendering */}
      {activeTab === 'servers' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <ServerConfigPanel servers={servers} onReload={reloadServers} />
        </div>
      ) : (
        <MonitoringTabs
          stats={stats}
          clients={clients}
          subscriptions={subscriptions}
          topics={topics}
          nodes={nodes}
          listeners={listeners}
          onLoadData={loadData}
        />
      )}
    </div>
  )
}
