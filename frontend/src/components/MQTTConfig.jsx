import { useState, useEffect, useCallback } from 'react'
import {
  Radio,
  Wifi,
  WifiOff,
  Users,
  MessageSquare,
  Activity,
  Server,
  RefreshCw,
  Trash2,
  Send,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Settings,
  Database,
  BarChart3,
  Network,
  Save,
  TestTube,
  Edit3,
  X,
  Plus,
  Power
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const API_BASE = '/api/emqx'

/**
 * MQTTConfig - Componente de configuración y monitoreo de EMQX
 */
export default function MQTTConfig() {
  const [health, setHealth] = useState(null)
  const [stats, setStats] = useState(null)
  const [clients, setClients] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [topics, setTopics] = useState([])
  const [nodes, setNodes] = useState([])
  const [listeners, setListeners] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [alarms, setAlarms] = useState([])
  const [config, setConfig] = useState(null)
  const [servers, setServers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [publishForm, setPublishForm] = useState({ topic: '', payload: '', qos: 0, retain: false })
  const [isPublishing, setIsPublishing] = useState(false)

  // Estados para edición de servidores
  const [isAddingServer, setIsAddingServer] = useState(false)
  const [editingServerId, setEditingServerId] = useState(null)
  const [serverForm, setServerForm] = useState({
    name: '',
    broker: '',
    username: 'admin',
    password: '',
    clientId: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [activatingId, setActivatingId] = useState(null)

  // Cargar datos
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [
        healthRes,
        statsRes,
        clientsRes,
        subscriptionsRes,
        topicsRes,
        nodesRes,
        listenersRes,
        configRes,
        alarmsRes,
        serversRes
      ] = await Promise.allSettled([
        fetch(`${API_BASE}/health`).then(r => r.json()),
        fetch(`${API_BASE}/stats`).then(r => r.json()),
        fetch(`${API_BASE}/clients`).then(r => r.json()),
        fetch(`${API_BASE}/subscriptions`).then(r => r.json()),
        fetch(`${API_BASE}/topics`).then(r => r.json()),
        fetch(`${API_BASE}/nodes`).then(r => r.json()),
        fetch(`${API_BASE}/listeners`).then(r => r.json()),
        fetch(`${API_BASE}/config`).then(r => r.json()),
        fetch(`${API_BASE}/alarms`).then(r => r.json()),
        fetch(`${API_BASE}/servers`).then(r => r.json())
      ])

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value)
      // stats viene como array, extraemos el primer elemento
      if (statsRes.status === 'fulfilled') {
        const statsData = Array.isArray(statsRes.value) ? statsRes.value[0] : statsRes.value
        setStats(statsData)
      }
      if (clientsRes.status === 'fulfilled') setClients(clientsRes.value?.data || [])
      if (subscriptionsRes.status === 'fulfilled') setSubscriptions(subscriptionsRes.value?.data || [])
      if (topicsRes.status === 'fulfilled') setTopics(topicsRes.value?.data || [])
      if (nodesRes.status === 'fulfilled') setNodes(nodesRes.value || [])
      if (listenersRes.status === 'fulfilled') setListeners(listenersRes.value || [])
      if (configRes.status === 'fulfilled') setConfig(configRes.value?.data)
      if (alarmsRes.status === 'fulfilled') setAlarms(alarmsRes.value?.data || [])
      if (serversRes.status === 'fulfilled') setServers(serversRes.value?.data || [])

    } catch (error) {
      console.error('Error cargando datos EMQX:', error)
      toast.error('Error conectando con EMQX')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000) // Actualizar cada 10s
    return () => clearInterval(interval)
  }, [loadData])

  // Abrir formulario para añadir servidor
  const openAddServer = () => {
    setServerForm({
      name: '',
      broker: 'mqtt://',
      username: 'admin',
      password: '',
      clientId: `camera_rtsp_${Date.now()}`
    })
    setIsAddingServer(true)
    setEditingServerId(null)
  }

  // Abrir formulario para editar servidor
  const openEditServer = (server) => {
    setServerForm({
      name: server.name,
      broker: server.broker,
      username: server.username,
      password: '',
      clientId: server.clientId
    })
    setEditingServerId(server.id)
    setIsAddingServer(true)
  }

  // Cancelar edición
  const cancelServerForm = () => {
    setIsAddingServer(false)
    setEditingServerId(null)
    setServerForm({ name: '', broker: '', username: 'admin', password: '', clientId: '' })
  }

  // Probar conexión
  const testConnection = async () => {
    setIsTesting(true)
    try {
      const res = await fetch(`${API_BASE}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: serverForm.broker,
          apiKey: serverForm.username,
          apiSecret: serverForm.password
        })
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Conexión exitosa con el broker MQTT')
      } else {
        toast.error(data.error || 'Error de conexión')
      }
    } catch (error) {
      toast.error('No se pudo conectar con el broker')
    } finally {
      setIsTesting(false)
    }
  }

  // Guardar servidor
  const saveServer = async () => {
    if (!serverForm.name || !serverForm.broker) {
      toast.error('Nombre y broker son requeridos')
      return
    }

    setIsSaving(true)
    try {
      const url = editingServerId
        ? `${API_BASE}/servers/${editingServerId}`
        : `${API_BASE}/servers`

      const res = await fetch(url, {
        method: editingServerId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverForm)
      })

      const data = await res.json()

      if (data.success) {
        toast.success(editingServerId ? 'Servidor actualizado' : 'Servidor creado')
        cancelServerForm()
        loadData()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      toast.error('Error al guardar servidor')
    } finally {
      setIsSaving(false)
    }
  }

  // Activar servidor
  const activateServer = async (serverId) => {
    setActivatingId(serverId)
    try {
      const res = await fetch(`${API_BASE}/servers/${serverId}/activate`, {
        method: 'POST'
      })

      const data = await res.json()

      if (data.success) {
        toast.success(data.message || 'Servidor activado')
        loadData()
      } else {
        toast.error(data.error || 'Error al activar')
      }
    } catch (error) {
      toast.error('Error al activar servidor')
    } finally {
      setActivatingId(null)
    }
  }

  // Eliminar servidor
  const deleteServer = async (serverId) => {
    if (!confirm('¿Eliminar este servidor?')) return

    try {
      const res = await fetch(`${API_BASE}/servers/${serverId}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Servidor eliminado')
        loadData()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      toast.error('Error al eliminar servidor')
    }
  }

  // Desconectar cliente
  const disconnectClient = async (clientId) => {
    try {
      const res = await fetch(`${API_BASE}/clients/${encodeURIComponent(clientId)}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        toast.success('Cliente desconectado')
        loadData()
      } else {
        throw new Error('Error desconectando')
      }
    } catch (error) {
      toast.error('Error al desconectar cliente')
    }
  }

  // Publicar mensaje
  const handlePublish = async (e) => {
    e.preventDefault()
    if (!publishForm.topic || !publishForm.payload) {
      toast.error('Topic y payload son requeridos')
      return
    }

    setIsPublishing(true)
    try {
      const res = await fetch(`${API_BASE}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publishForm)
      })

      if (res.ok) {
        toast.success('Mensaje publicado')
        setPublishForm({ ...publishForm, payload: '' })
      } else {
        throw new Error('Error publicando')
      }
    } catch (error) {
      toast.error('Error al publicar mensaje')
    } finally {
      setIsPublishing(false)
    }
  }

  // Formatear bytes
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Formatear número
  const formatNumber = (num) => {
    if (!num) return '0'
    return new Intl.NumberFormat().format(num)
  }

  // Estado de conexión
  const isConnected = health?.status === 'connected'

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: BarChart3 },
    { id: 'servers', label: 'Servidores', icon: Database },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'subscriptions', label: 'Suscripciones', icon: MessageSquare },
    { id: 'topics', label: 'Topics', icon: Network },
    { id: 'publish', label: 'Publicar', icon: Send },
    { id: 'nodes', label: 'Nodos', icon: Server }
  ]

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
          {/* Estado de conexión */}
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

      {/* Servidor EMQX Activo */}
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
                  <Activity className="w-3 h-3" />
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

      {/* Alarmas */}
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

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
                    ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-6">
          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={Users}
                  label="Clientes Conectados"
                  value={stats?.['clients.connected'] || clients.length || 0}
                  color="blue"
                />
                <StatCard
                  icon={MessageSquare}
                  label="Suscripciones"
                  value={stats?.['subscriptions.count'] || subscriptions.length || 0}
                  color="green"
                />
                <StatCard
                  icon={Zap}
                  label="Mensajes Recibidos"
                  value={formatNumber(stats?.['messages.received'] || 0)}
                  color="purple"
                />
                <StatCard
                  icon={Send}
                  label="Mensajes Enviados"
                  value={formatNumber(stats?.['messages.sent'] || 0)}
                  color="orange"
                />
              </div>

              {/* Más estadísticas */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <MiniStat label="Topics" value={stats['topics.count'] || topics.length || 0} />
                  <MiniStat label="Sesiones" value={stats['sessions.count'] || 0} />
                  <MiniStat label="Conexiones" value={stats['connections.count'] || 0} />
                  <MiniStat label="Bytes In" value={formatBytes(stats['bytes.received'] || 0)} />
                  <MiniStat label="Bytes Out" value={formatBytes(stats['bytes.sent'] || 0)} />
                  <MiniStat label="Retaineds" value={stats['retained.count'] || 0} />
                </div>
              )}

              {/* Listeners */}
              {listeners.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Listeners</h3>
                  <div className="grid gap-2">
                    {listeners.map((listener, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${listener.running ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                          <span className="font-mono text-sm">{listener.id || listener.name}</span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {listener.bind || listener.port}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clients */}
          {activeTab === 'clients' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Clientes Conectados ({clients.length})
                </h3>
              </div>

              {clients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No hay clientes conectados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Client ID</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Username</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">IP</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Conectado</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-500">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((client, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-2 px-3 font-mono text-xs">{client.clientid}</td>
                          <td className="py-2 px-3">{client.username || '-'}</td>
                          <td className="py-2 px-3 font-mono text-xs">{client.ip_address}</td>
                          <td className="py-2 px-3 text-gray-500">
                            {new Date(client.connected_at).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => disconnectClient(client.clientid)}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Desconectar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Subscriptions */}
          {activeTab === 'subscriptions' && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                Suscripciones Activas ({subscriptions.length})
              </h3>

              {subscriptions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No hay suscripciones activas</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Topic</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Client ID</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">QoS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map((sub, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-2 px-3 font-mono text-xs">{sub.topic}</td>
                          <td className="py-2 px-3 font-mono text-xs">{sub.clientid}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                              QoS {sub.qos}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Topics */}
          {activeTab === 'topics' && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                Topics Activos ({topics.length})
              </h3>

              {topics.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No hay topics con actividad reciente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {topics.map((topic, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <span className="font-mono text-sm">{topic.topic}</span>
                      <span className="text-sm text-gray-500">{topic.node}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Publish */}
          {activeTab === 'publish' && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                Publicar Mensaje
              </h3>

              <form onSubmit={handlePublish} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Topic
                  </label>
                  <input
                    type="text"
                    value={publishForm.topic}
                    onChange={(e) => setPublishForm({ ...publishForm, topic: e.target.value })}
                    placeholder="camera_rtsp/sensors/test"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payload (JSON)
                  </label>
                  <textarea
                    value={publishForm.payload}
                    onChange={(e) => setPublishForm({ ...publishForm, payload: e.target.value })}
                    placeholder='{"message": "test", "value": 123}'
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  />
                </div>

                <div className="flex gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      QoS
                    </label>
                    <select
                      value={publishForm.qos}
                      onChange={(e) => setPublishForm({ ...publishForm, qos: parseInt(e.target.value) })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value={0}>0 - At most once</option>
                      <option value={1}>1 - At least once</option>
                      <option value={2}>2 - Exactly once</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={publishForm.retain}
                        onChange={(e) => setPublishForm({ ...publishForm, retain: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Retain</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPublishing || !publishForm.topic || !publishForm.payload}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {isPublishing ? 'Publicando...' : 'Publicar'}
                </button>
              </form>
            </div>
          )}

          {/* Nodes */}
          {activeTab === 'nodes' && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                Nodos del Cluster ({nodes.length})
              </h3>

              {nodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No se encontraron nodos</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {nodes.map((node, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-3 h-3 rounded-full ${node.node_status === 'running' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                        <span className="font-medium text-gray-900 dark:text-white">{node.node}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Versión:</span>
                          <p className="text-gray-900 dark:text-white">{node.version}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Uptime:</span>
                          <p className="text-gray-900 dark:text-white">{node.uptime}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Conexiones:</span>
                          <p className="text-gray-900 dark:text-white">{node.connections || 0}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Memoria:</span>
                          <p className="text-gray-900 dark:text-white">{formatBytes(node.memory_total || 0)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Servidores */}
          {activeTab === 'servers' && (
            <div className="space-y-6">
              {/* Botón añadir servidor */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Servidores EMQX Configurados
                </h3>
                {!isAddingServer && !editingServerId && (
                  <button
                    onClick={openAddServer}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Añadir Servidor
                  </button>
                )}
              </div>

              {/* Formulario añadir/editar servidor */}
              {(isAddingServer || editingServerId) && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <span className="text-lg font-medium text-purple-700 dark:text-purple-300">
                        {editingServerId ? 'Editar Servidor' : 'Nuevo Servidor EMQX'}
                      </span>
                    </div>
                    <button
                      onClick={cancelServerForm}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nombre del Servidor
                      </label>
                      <input
                        type="text"
                        value={serverForm.name}
                        onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
                        placeholder="Servidor Principal"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Broker MQTT
                      </label>
                      <input
                        type="text"
                        value={serverForm.broker}
                        onChange={(e) => setServerForm({ ...serverForm, broker: e.target.value })}
                        placeholder="mqtt://192.168.1.100:1883"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">Formato: mqtt://host:puerto</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Usuario
                      </label>
                      <input
                        type="text"
                        value={serverForm.username}
                        onChange={(e) => setServerForm({ ...serverForm, username: e.target.value })}
                        placeholder="admin"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        value={serverForm.password}
                        onChange={(e) => setServerForm({ ...serverForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Client ID
                      </label>
                      <input
                        type="text"
                        value={serverForm.clientId}
                        onChange={(e) => setServerForm({ ...serverForm, clientId: e.target.value })}
                        placeholder="galgo_school_manager"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={testConnection}
                      disabled={isTesting || !serverForm.broker}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                    >
                      <TestTube className={`w-4 h-4 ${isTesting ? 'animate-pulse' : ''}`} />
                      {isTesting ? 'Probando...' : 'Probar Conexión'}
                    </button>

                    <button
                      onClick={cancelServerForm}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>

                    <button
                      onClick={saveServer}
                      disabled={isSaving || !serverForm.broker || !serverForm.name}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de servidores */}
              {servers.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                  <Database className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No hay servidores configurados</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Añade un servidor EMQX para comenzar</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {servers.map(server => (
                    <div
                      key={server.id}
                      className={`bg-white dark:bg-gray-800 rounded-lg p-4 border-2 transition-all ${server.isActive
                          ? 'border-green-500 dark:border-green-600 shadow-lg shadow-green-500/10'
                          : 'border-gray-200 dark:border-gray-700'
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{server.name}</h4>
                            {server.isActive && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">
                                <Activity className="w-3 h-3" />
                                Activo
                              </span>
                            )}
                            {server.isDefault && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs">
                                Por defecto
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Broker:</span>
                              <p className="font-mono text-gray-900 dark:text-white text-xs">{server.broker}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Usuario:</span>
                              <p className="text-gray-900 dark:text-white">{server.username || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Client ID:</span>
                              <p className="font-mono text-gray-900 dark:text-white text-xs">{server.clientId || 'N/A'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {!server.isActive && (
                            <button
                              onClick={() => activateServer(server.id)}
                              disabled={activatingId === server.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 transition-colors"
                            >
                              {activatingId === server.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                              {activatingId === server.id ? 'Activando...' : 'Activar'}
                            </button>
                          )}

                          <button
                            onClick={() => openEditServer(server)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {!server.isActive && (
                            <button
                              onClick={() => deleteServer(server.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Información */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">Información sobre servidores EMQX</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-600 dark:text-blue-400">
                      <li>Solo un servidor puede estar activo a la vez</li>
                      <li>Al activar un servidor, el sistema se reconectará automáticamente</li>
                      <li>Los datos de sensores se capturarán del servidor activo</li>
                      <li>No se puede eliminar el servidor activo</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente StatCard
function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  )
}

// Componente MiniStat
function MiniStat({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
      <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}
