import { useState } from 'react'
import { Database, Activity, Plus, X, TestTube, Save, Edit3, Trash2, Power } from 'lucide-react'
import { toast } from 'react-hot-toast'

const API_BASE = '/api/emqx'

/**
 * ServerConfigPanel - EMQX server configuration management
 * 
 * Handles:
 * - Server list display
 * - Add/Edit server forms
 * - Test connection
 * - Activate/Delete servers
 */
export default function ServerConfigPanel({ servers, onReload }) {
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

    const cancelServerForm = () => {
        setIsAddingServer(false)
        setEditingServerId(null)
        setServerForm({ name: '', broker: '', username: 'admin', password: '', clientId: '' })
    }

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
                onReload()
            } else {
                toast.error(data.error || 'Error al guardar')
            }
        } catch (error) {
            toast.error('Error al guardar servidor')
        } finally {
            setIsSaving(false)
        }
    }

    const activateServer = async (serverId) => {
        setActivatingId(serverId)
        try {
            const res = await fetch(`${API_BASE}/servers/${serverId}/activate`, {
                method: 'POST'
            })

            const data = await res.json()

            if (data.success) {
                toast.success(data.message || 'Servidor activado')
                onReload()
            } else {
                toast.error(data.error || 'Error al activar')
            }
        } catch (error) {
            toast.error('Error al activar servidor')
        } finally {
            setActivatingId(null)
        }
    }

    const deleteServer = async (serverId) => {
        if (!confirm('¿Eliminar este servidor?')) return

        try {
            const res = await fetch(`${API_BASE}/servers/${serverId}`, {
                method: 'DELETE'
            })

            const data = await res.json()

            if (data.success) {
                toast.success('Servidor eliminado')
                onReload()
            } else {
                toast.error(data.error || 'Error al eliminar')
            }
        } catch (error) {
            toast.error('Error al eliminar servidor')
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
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

            {/* Add/Edit Form */}
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

            {/* Server List */}
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
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">Broker:</span>
                                            <p className="font-mono text-gray-900 dark:text-white text-xs">{server.broker}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">Usuario:</span>
                                            <p className="font-mono text-gray-900 dark:text-white text-xs">{server.username}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">Client  ID:</span>
                                            <p className="font-mono text-gray-900 dark:text-white text-xs">{server.clientId}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                    {!server.isActive && (
                                        <button
                                            onClick={() => activateServer(server.id)}
                                            disabled={activatingId === server.id}
                                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
                                            title="Activar"
                                        >
                                            <Power className={`w-4 h-4 ${activatingId === server.id ? 'animate-pulse' : ''}`} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openEditServer(server)}
                                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                        title="Editar"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteServer(server.id)}
                                        disabled={server.isActive}
                                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
