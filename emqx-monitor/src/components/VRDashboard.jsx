import React, { useState, useEffect, useMemo } from 'react'
import { useMQTTContext, useEmqxContext } from '../contexts/EmqxContext'

const VRDashboard = () => {
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { isConnected, messages } = useMQTTContext()
  const { config } = useEmqxContext()

  // Log de estado para debugging
  useEffect(() => {
    console.log('[VRDashboard] Estado actualizado:', {
      isConnected,
      totalMessages: messages.length,
      messagesVR: messages.filter(m => m.topic && m.topic.startsWith('vr/')).length
    })
  }, [isConnected, messages])

  // Filtrar mensajes VR
  const vrMessages = useMemo(() => {
    console.log('[VRDashboard] Total mensajes:', messages.length)
    const filtered = messages.filter(msg => msg.topic && msg.topic.startsWith('vr/'))
    console.log('[VRDashboard] Mensajes VR filtrados:', filtered.length)
    console.log('[VRDashboard] Primeros 3 mensajes VR:', filtered.slice(0, 3).map(m => ({ topic: m.topic, timestamp: m.timestamp })))
    return filtered
  }, [messages])

  // Organizar datos por tipo y dispositivo
  const vrData = useMemo(() => {
    const data = {
      status: {},
      commands: {},
      datos_reloj: {},
      acciones_json: {},
      wandering_data: {},
      head_movement: {}
    }

    console.log('[VRDashboard] Organizando', vrMessages.length, 'mensajes VR...')

    vrMessages.forEach(msg => {
      const parts = msg.topic.split('/')
      console.log('[VRDashboard] Procesando mensaje:', msg.topic, 'partes:', parts)
      
      if (parts.length >= 3) {
        const type = parts[1] // status, commands, etc.
        const deviceId = parts[2] // VR001, VR002, etc.

        if (!data[type]) {
          console.log('[VRDashboard] ⚠️ Tipo desconocido:', type)
          data[type] = {}
        }
        data[type][deviceId] = msg
        console.log('[VRDashboard] ✓ Agregado:', type, '/', deviceId)
      } else {
        console.log('[VRDashboard] ⚠️ Topic con formato incorrecto:', msg.topic, 'partes:', parts.length)
      }
    })

    console.log('[VRDashboard] Datos organizados:', {
      status: Object.keys(data.status).length,
      commands: Object.keys(data.commands).length,
      datos_reloj: Object.keys(data.datos_reloj).length,
      acciones_json: Object.keys(data.acciones_json).length,
      wandering_data: Object.keys(data.wandering_data).length,
      head_movement: Object.keys(data.head_movement).length
    })

    return data
  }, [vrMessages])

  // Obtener lista única de dispositivos
  const deviceIds = useMemo(() => {
    const ids = new Set()
    vrMessages.forEach(msg => {
      const parts = msg.topic.split('/')
      if (parts.length >= 3) {
        ids.add(parts[2])
      }
    })
    const idsArray = Array.from(ids).sort()
    console.log('[VRDashboard] IDs de dispositivos encontrados:', idsArray)
    return idsArray
  }, [vrMessages])

  // Filtrar por dispositivo seleccionado
  const filteredData = useMemo(() => {
    if (!selectedDeviceId) return vrData

    const filtered = {}
    Object.keys(vrData).forEach(type => {
      filtered[type] = {}
      if (vrData[type][selectedDeviceId]) {
        filtered[type][selectedDeviceId] = vrData[type][selectedDeviceId]
      }
    })
    return filtered
  }, [vrData, selectedDeviceId])

  const formatPayload = (obj) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'offline': return 'bg-red-500'
      case 'connecting': return 'bg-yellow-500'
      case 'error': return 'bg-red-600'
      case 'maintenance': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Dashboard VR</h2>
          <p className="text-slate-400">Visualización en tiempo real de datos de dispositivos VR</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
            isConnected
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
          </div>

          <label className="flex items-center space-x-2 text-white">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">Auto-refresh</span>
          </label>
        </div>
      </div>

      {/* Filtro de dispositivo */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <div className="flex items-center space-x-4">
          <label className="text-white font-medium">Filtrar por dispositivo:</label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los dispositivos</option>
            {deviceIds.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <span className="text-slate-400 text-sm">
            {deviceIds.length} dispositivo{deviceIds.length !== 1 ? 's' : ''} activo{deviceIds.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Estado de Dispositivos */}
      <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Estado de Dispositivos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(filteredData.status).map(([deviceId, message]) => (
            <div key={deviceId} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-semibold">{deviceId}</h4>
                <div className={`w-3 h-3 rounded-full ${getStatusColor(message?.status)}`}></div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Estado:</span>
                  <span className="text-white capitalize">{message?.status || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Batería:</span>
                  <span className="text-white">{message?.batteryLevel || 'N/A'}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Conexión:</span>
                  <span className="text-white">{message?.connectionStrength || 'N/A'}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Temperatura:</span>
                  <span className="text-white">{message?.temperature || 'N/A'}°C</span>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {Object.keys(filteredData.status).length === 0 && (
            <div className="col-span-full text-center text-slate-400 py-8">
              No hay datos de estado disponibles
            </div>
          )}
        </div>
      </div>

      {/* Movimiento de Cabeza */}
      <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Movimiento de Cabeza</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(filteredData.head_movement).map(([deviceId, message]) => (
            <div key={deviceId} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600/50">
              <h4 className="text-white font-semibold mb-3">{deviceId}</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="text-slate-400 mb-2">Posición</h5>
                  <div className="space-y-1 text-sm">
                    {message?.headPose?.position ? (
                      <>
                        <div className="text-white">X: {message.headPose.position.x?.toFixed(3) || 'N/A'}</div>
                        <div className="text-white">Y: {message.headPose.position.y?.toFixed(3) || 'N/A'}</div>
                        <div className="text-white">Z: {message.headPose.position.z?.toFixed(3) || 'N/A'}</div>
                      </>
                    ) : <div className="text-slate-500">N/A</div>}
                  </div>
                </div>
                <div>
                  <h5 className="text-slate-400 mb-2">Rotación</h5>
                  <div className="space-y-1 text-sm">
                    {message?.headPose?.rotation ? (
                      <>
                        <div className="text-white">Yaw: {message.headPose.rotation.yaw?.toFixed(1) || 'N/A'}°</div>
                        <div className="text-white">Pitch: {message.headPose.rotation.pitch?.toFixed(1) || 'N/A'}°</div>
                        <div className="text-white">Roll: {message.headPose.rotation.roll?.toFixed(1) || 'N/A'}°</div>
                      </>
                    ) : <div className="text-slate-500">N/A</div>}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-600">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Confianza:</span>
                  <span className="text-white">{message?.confidence ? (message.confidence * 100).toFixed(1) : 'N/A'}%</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {Object.keys(filteredData.head_movement).length === 0 && (
            <div className="col-span-full text-center text-slate-400 py-8">
              No hay datos de movimiento de cabeza disponibles
            </div>
          )}
        </div>
      </div>

      {/* Acciones del Usuario */}
      <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Acciones del Usuario</h3>
        <div className="space-y-3">
          {Object.entries(filteredData.acciones_json).slice(0, 10).map(([deviceId, message]) => (
            <div key={`${deviceId}-${message.timestamp}`} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-semibold">{deviceId}</span>
                <span className="text-blue-400 font-medium capitalize">{message?.action?.replace('_', ' ') || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                <div>
                  <span className="text-slate-400">Posición:</span>
                  <div className="text-white">
                    ({message?.coordinates?.x?.toFixed(1) || 'N/A'}, {message?.coordinates?.y?.toFixed(1) || 'N/A'}, {message?.coordinates?.z?.toFixed(1) || 'N/A'})
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Velocidad:</span>
                  <div className="text-white">
                    ({message?.velocity?.x?.toFixed(1) || 'N/A'}, {message?.velocity?.y?.toFixed(1) || 'N/A'}, {message?.velocity?.z?.toFixed(1) || 'N/A'})
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Duración:</span>
                  <div className="text-white">{message?.duration || 'N/A'}ms</div>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className={`px-2 py-1 rounded ${message?.success ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                  {message?.success ? 'Éxito' : 'Error'}
                </span>
                <span className="text-slate-500">{new Date(message.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
          {Object.keys(filteredData.acciones_json).length === 0 && (
            <div className="text-center text-slate-400 py-8">
              No hay acciones de usuario disponibles
            </div>
          )}
        </div>
      </div>

      {/* Datos de Wandering */}
      <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Datos de Wandering</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(filteredData.wandering_data).map(([deviceId, message]) => (
            <div key={deviceId} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600/50">
              <h4 className="text-white font-semibold mb-3">{deviceId}</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="text-slate-400 mb-2">Posición</h5>
                  <div className="space-y-1">
                    <div className="text-white">X: {message?.position?.x?.toFixed(1) || 'N/A'}</div>
                    <div className="text-white">Y: {message?.position?.y?.toFixed(1) || 'N/A'}</div>
                    <div className="text-white">Z: {message?.position?.z?.toFixed(1) || 'N/A'}</div>
                  </div>
                </div>
                <div>
                  <h5 className="text-slate-400 mb-2">Movimiento</h5>
                  <div className="space-y-1">
                    <div className="text-white">Vel: {message?.movement?.speed?.toFixed(1) || 'N/A'} m/s</div>
                    <div className="text-white">Dir: {message?.movement?.direction?.toFixed(0) || 'N/A'}°</div>
                    <div className="text-white">Acc: {message?.movement?.acceleration?.toFixed(2) || 'N/A'}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-600">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Obstáculos:</span>
                    <div className="text-white">{message?.environment?.obstacles || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Luz:</span>
                    <div className="text-white">{(message?.environment?.lightLevel ?? 0) * 100 | 0}%</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Sonido:</span>
                    <div className="text-white">{message?.environment?.soundLevel?.toFixed(0) || 'N/A'} dB</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {Object.keys(filteredData.wandering_data).length === 0 && (
            <div className="col-span-full text-center text-slate-400 py-8">
              No hay datos de wandering disponibles
            </div>
          )}
        </div>
      </div>

      {/* Comandos y Datos de Reloj */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comandos */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h3 className="text-xl font-bold text-white mb-4">Últimos Comandos</h3>
          <div className="space-y-3">
            {Object.entries(filteredData.commands).slice(0, 5).map(([deviceId, message]) => (
              <div key={`${deviceId}-${message.timestamp}`} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold">{deviceId}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    message?.priority === 'high' ? 'bg-red-600/20 text-red-400' : 'bg-blue-600/20 text-blue-400'
                  }`}>
                    {message?.priority || 'N/A'}
                  </span>
                </div>
                <div className="text-blue-400 font-medium capitalize mb-1">
                  {message?.command?.replace('_', ' ') || 'N/A'}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {Object.keys(filteredData.commands).length === 0 && (
              <div className="text-center text-slate-400 py-4">
                No hay comandos disponibles
              </div>
            )}
          </div>
        </div>

        {/* Datos de Reloj */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h3 className="text-xl font-bold text-white mb-4">Sincronización de Reloj</h3>
          <div className="space-y-3">
            {Object.entries(filteredData.datos_reloj).slice(0, 5).map(([deviceId, message]) => (
              <div key={`${deviceId}-${message.timestamp}`} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold">{deviceId}</span>
                  <div className={`w-2 h-2 rounded-full ${message?.ntpSync ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Drift:</span>
                    <span className="text-white">{message?.timeDrift?.toFixed(2) || 'N/A'}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Precisión:</span>
                    <span className="text-white">{message?.precision?.toFixed(1) || 'N/A'}ms</span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {Object.keys(filteredData.datos_reloj).length === 0 && (
              <div className="text-center text-slate-400 py-4">
                No hay datos de reloj disponibles
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {config.debugMode && (
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h3 className="text-xl font-bold text-white mb-4">Debug - Todos los mensajes VR</h3>
          <div className="bg-slate-900/50 rounded p-4 max-h-96 overflow-y-auto">
            <pre className="text-green-400 text-xs whitespace-pre-wrap">
              {vrMessages.slice(-20).map((msg, index) => {
                const { topic, timestamp, payload, _id, ...rest } = msg
                const msgData = payload || rest
                return `[${index + 1}] ${msg.topic} (${new Date(msg.timestamp).toLocaleTimeString()})\n${formatPayload(msgData)}\n\n`
              }).join('')}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default VRDashboard