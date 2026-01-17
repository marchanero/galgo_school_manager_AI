import { useState } from 'react'
import {
    BarChart3, Users, MessageSquare, Network, Send, Server,
    Wifi, WifiOff, Zap, Trash2, Activity, Clock, HardDrive, Gauge
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const API_BASE = '/api/emqx'

/**
 * MonitoringTabs - EMQX monitoring interface with 6 tabs
 * 
 * Tabs:
 * - Overview: Stats cards and listeners
 * - Clients: Connected clients table
 * - Subscriptions: Active subscriptions
 * - Topics: Active topics list
 * - Publish: Message publish form
 * - Nodes: Cluster nodes info
 */
export default function MonitoringTabs({
    stats,
    clients,
    subscriptions,
    topics,
    nodes,
    listeners,
    onDisconnectClient,
    onLoadData
}) {
    const [activeTab, setActiveTab] = useState('overview')
    const [publishForm, setPublishForm] = useState({
        topic: '',
        payload: '',
        qos: 0,
        retain: false
    })
    const [isPublishing, setIsPublishing] = useState(false)

    const tabs = [
        { id: 'overview', label: 'Resumen', icon: BarChart3 },
        { id: 'clients', label: 'Clientes', icon: Users },
        { id: 'subscriptions', label: 'Suscripciones', icon: MessageSquare },
        { id: 'topics', label: 'Topics', icon: Network },
        { id: 'publish', label: 'Publicar', icon: Send },
        { id: 'nodes', label: 'Nodos', icon: Server }
    ]

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatNumber = (num) => {
        if (!num) return '0'
        return new Intl.NumberFormat().format(num)
    }

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

    const disconnectClient = async (clientId) => {
        try {
            const res = await fetch(`${API_BASE}/clients/${encodeURIComponent(clientId)}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                toast.success('Cliente desconectado')
                onLoadData?.()
            } else {
                throw new Error('Error desconectando')
            }
        } catch (error) {
            toast.error('Error al desconectar cliente')
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Tabs Navigation */}
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

            {/* Tab Content */}
            <div className="p-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
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

                {/* Clients Tab */}
                {activeTab === 'clients' && (
                    <div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                            Clientes Conectados ({clients.length})
                        </h3>

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

                {/* Subscriptions Tab */}
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

                {/* Topics Tab */}
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

                {/* Publish Tab */}
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

                {/* Nodes Tab */}
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
            </div>
        </div>
    )
}

// Helper component for stat cards
function StatCard({ icon: Icon, label, value, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
        green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
        purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
        orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
    }

    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                </div>
            </div>
        </div>
    )
}

// Helper component for mini stats
function MiniStat({ label, value }) {
    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
    )
}
