import React, { useState, useEffect } from 'react'
import { useMQTTContext, useEmqxContext } from '../contexts/EmqxContext'
import { useMessageMonitorState } from '../hooks/useLocalStorage'
import { MQTTDebugPanel } from './MQTTDebugPanel'

const MessageMonitor = () => {
  // Estado persistente del monitor
  const { monitorState, updateMonitorState } = useMessageMonitorState()

  // Extraer valores del estado persistente
  const {
    selectedTopic,
    customTopic,
    isMonitoring,
    filterText,
    deviceIdFilter,
    showDebugPanel,
    topicToMonitor,
    autoScroll,
    messageFilter,
    autoMonitorAllTopics
  } = monitorState

  // Usar contexto para estadísticas globales
  const { stats, config } = useEmqxContext()

  // Tópicos disponibles de la aplicación VR
  const availableTopics = [
    'vr/status/+',
    'vr/commands/+',
    'vr/datos_reloj/+',
    'vr/acciones_json/+',
    'vr/wandering_data/+',
    'vr/head_movement/+',
    '#'
  ]

  const {
    isConnected,
    messages,
    lastMessage,
    error,
    statistics,
    subscribedTopics,
    connect,
    subscribe,
    unsubscribe,
    clearMessages
  } = useMQTTContext()

  // Conectar automáticamente al montar
  useEffect(() => {
    console.log('[MessageMonitor] Componente montado, conectando...')
    connect()
    
    return () => {
      console.log('[MessageMonitor] Componente desmontado')
    }
  }, [connect])

  // Auto-monitor: suscribirse automáticamente a todos los topics cuando esté activado
  useEffect(() => {
    if (isConnected && autoMonitorAllTopics) {
      console.log('[MessageMonitor] Auto-monitor activado, verificando estado actual...')

      // Si ya estamos monitoreando el topic correcto, no hacer nada
      if (isMonitoring && topicToMonitor === 'vr/#') {
        console.log('[MessageMonitor] ℹ️ Ya monitoreando todos los topics VR (vr/#)')
        return
      }

      // Si estamos monitoreando otro topic, detenerlo primero
      if (isMonitoring && topicToMonitor !== 'vr/#') {
        console.log('[MessageMonitor] 🔄 Deteniendo monitoreo anterior antes de iniciar auto-monitor...')
        handleStopMonitoring()
        // Pequeño delay para asegurar que se desuscriba antes de suscribirse al nuevo
        setTimeout(() => {
          handleStartAutoMonitoring()
        }, 100)
      } else {
        // No hay monitoreo activo, iniciar auto-monitor directamente
        handleStartAutoMonitoring()
      }
    }
  }, [isConnected, autoMonitorAllTopics]) // Solo dependencias necesarias

  // Detener auto-monitor cuando se desactiva
  useEffect(() => {
    if (!autoMonitorAllTopics && isMonitoring && topicToMonitor === 'vr/#') {
      console.log('[MessageMonitor] Auto-monitor desactivado, deteniendo monitoreo automático...')
      handleStopMonitoring()
    }
  }, [autoMonitorAllTopics]) // Solo cuando cambia el toggle

  // Filtrar mensajes por tópico seleccionado
  const getFilteredMessages = () => {
    if (!topicToMonitor) {
      console.log('[MessageMonitor] No hay topicToMonitor, retornando array vacío')
      return []
    }

    console.log('[MessageMonitor] Filtrando mensajes para topic:', topicToMonitor, 'Total mensajes:', messages.length)
    
    // Filtrar mensajes del tópico actual
    const filtered = messages.filter(msg => {
      if (!msg.topic) return false

      // Coincidir tópicos exactos
      if (msg.topic === topicToMonitor) {
        console.log('[MessageMonitor] ✓ Match exacto:', msg.topic)
        return true
      }
      
      // Coincidir wildcards
      if (topicToMonitor === '#') {
        console.log('[MessageMonitor] ✓ Match wildcard #:', msg.topic)
        return true
      }

      // Coincidir vr/# (todos los topics VR)
      if (topicToMonitor === 'vr/#' && msg.topic.startsWith('vr/')) {
        console.log('[MessageMonitor] ✓ Match VR wildcard:', msg.topic)
        return true
      }
      
      // Coincidir con patrón MQTT
      try {
        const pattern = '^' + 
          topicToMonitor
            .replace(/\//g, '\\/') 
            .replace(/\+/g, '[^/]+') 
            .replace(/\#/g, '.*') + 
          '$'
        const regex = new RegExp(pattern)
        const matches = regex.test(msg.topic)
        if (matches) {
          console.log('[MessageMonitor] ✓ Match regex:', msg.topic, 'con patrón:', pattern)
        }
        return matches
      } catch (error) {
        console.error('[MessageMonitor] Error en regex para topic:', topicToMonitor, error)
        return false
      }
    })
    
    console.log('[MessageMonitor] Mensajes filtrados:', filtered.length)
    return filtered
  }

  const handleStartAutoMonitoring = async () => {
    try {
      console.log('[MessageMonitor] Iniciando monitoreo automático de topics VR...')

      // NO limpiar mensajes en auto-monitor - queremos ver todos los mensajes, incluyendo los existentes
      // clearMessages()

      updateMonitorState({
        topicToMonitor: 'vr/#',
        isMonitoring: true
      })
      await subscribe('vr/#')

      console.log('[MessageMonitor] ✅ Monitoreo automático iniciado correctamente')
    } catch (err) {
      console.error('[MessageMonitor] Error al iniciar monitoreo automático:', err)
      alert(`Error al iniciar monitoreo automático: ${err.message}`)
    }
  }

  const handleStartMonitoring = async () => {
    const topic = customTopic || selectedTopic
    if (!topic) {
      alert('Por favor selecciona o ingresa un tópico')
      return
    }

    try {
      console.log('[MessageMonitor] Iniciando monitoreo manual de:', topic)

      // Limpiar mensajes ANTES de suscribirse para evitar perder mensajes nuevos
      clearMessages()

      updateMonitorState({
        topicToMonitor: topic,
        isMonitoring: true
      })
      await subscribe(topic)

      console.log('[MessageMonitor] ✅ Monitoreo manual iniciado correctamente')
    } catch (err) {
      console.error('[MessageMonitor] Error al suscribirse:', err)
      alert(`Error al suscribirse: ${err.message}`)
    }
  }

  const handleStopMonitoring = () => {
    const topic = topicToMonitor
    if (!topic) return

    try {
      console.log('[MessageMonitor] Deteniendo monitoreo de:', topic)
      unsubscribe(topic)
      updateMonitorState({
        isMonitoring: false,
        topicToMonitor: null
      })
    } catch (err) {
      console.error('[MessageMonitor] Error al desuscribirse:', err)
    }
  }

  // Funciones auxiliares para actualizar estado persistente
  const handleTopicChange = (topic) => {
    updateMonitorState({ selectedTopic: topic, customTopic: '' })
  }

  const handleCustomTopicChange = (topic) => {
    updateMonitorState({ customTopic: topic })
  }

  const handleFilterChange = (filter) => {
    updateMonitorState({ filterText: filter })
  }

  const handleDeviceIdFilterChange = (deviceId) => {
    updateMonitorState({ deviceIdFilter: deviceId })
  }

  const toggleDebugPanel = () => {
    updateMonitorState({ showDebugPanel: !showDebugPanel })
  }

  const toggleAutoScroll = () => {
    updateMonitorState({ autoScroll: !autoScroll })
  }

  const handleMessageFilterChange = (filter) => {
    updateMonitorState({ messageFilter: filter })
  }

  // Función para limpiar configuración persistente del monitor
  const clearMonitorSettings = () => {
    updateMonitorState({
      selectedTopic: '',
      customTopic: '',
      filterText: '',
      deviceIdFilter: '',
      showDebugPanel: false,
      topicToMonitor: null,
      messageFilter: 'all'
    })
    console.log('[MessageMonitor] 🧹 Configuración del monitor limpiada')
  }

  const topicMessages = getFilteredMessages()

  const filteredMessages = topicMessages.filter(msg => {
    // Filtro por texto (búsqueda en contenido)
    if (filterText) {
      const jsonStr = JSON.stringify(msg).toLowerCase()
      if (!jsonStr.includes(filterText.toLowerCase())) {
        return false
      }
    }

    // Filtro por ID de dispositivo
    if (deviceIdFilter) {
      // Extraer ID del topic (última parte después del último '/')
      const topicParts = msg.topic.split('/')
      const messageDeviceId = topicParts[topicParts.length - 1]

      // Si el filtro no coincide con el ID del mensaje, excluirlo
      if (messageDeviceId !== deviceIdFilter) {
        return false
      }
    }

    return true
  })

  // Debug info
  console.log('[MessageMonitor] Estado actual:', {
    isConnected,
    isMonitoring,
    topicToMonitor,
    totalMessages: messages.length,
    filteredMessages: topicMessages.length,
    finalFiltered: filteredMessages.length,
    lastMessage: lastMessage ? lastMessage.topic : 'none'
  })

  const formatPayload = (obj) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Monitor de Mensajes MQTT</h2>
          <p className="text-slate-400">Visualización en tiempo real de mensajes por tópico</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
            isConnected
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
          </div>
          
          {/* Toggle Auto-Monitor */}
          <div className="flex items-center space-x-2">
            <label className="text-white text-sm font-medium">Auto-monitor todos los topics</label>
            <button
              onClick={() => updateMonitorState({ autoMonitorAllTopics: !autoMonitorAllTopics })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                autoMonitorAllTopics ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoMonitorAllTopics ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <button
            onClick={() => updateMonitorState({ showDebugPanel: !showDebugPanel })}
            className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200 text-sm"
            title="Mostrar panel de debug"
          >
            🔧 Debug
          </button>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebugPanel && <MQTTDebugPanel />}

      {/* Statistics Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="text-slate-400 text-xs mb-1">Total de Mensajes</div>
            <div className="text-2xl font-bold text-white">{stats.mqttMessagesCount}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="text-slate-400 text-xs mb-1">Tópicos Activos</div>
            <div className="text-2xl font-bold text-white">{subscribedTopics.length}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="text-slate-400 text-xs mb-1">Clientes Conectados</div>
            <div className="text-2xl font-bold text-white">{stats.clientsConnected}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="text-slate-400 text-xs mb-1">Suscripciones</div>
            <div className="text-2xl font-bold text-white">{stats.subscriptions}</div>
          </div>
        </div>
      )}

      {/* Control Panel */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Topic Selection */}
          <div>
            <label className="block text-white font-medium mb-2">
              Seleccionar Tópico Predefinido
              {autoMonitorAllTopics && <span className="text-purple-400 text-xs ml-2">(Deshabilitado en modo auto-monitor)</span>}
            </label>
            <select
              value={selectedTopic}
              onChange={(e) => handleTopicChange(e.target.value)}
              disabled={autoMonitorAllTopics}
              className={`w-full rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                autoMonitorAllTopics
                  ? 'bg-slate-600 border-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-700 border-slate-600'
              }`}
            >
              <option value="">Seleccionar tópico...</option>
              {availableTopics.map((topic) => (
                <option key={topic} value={topic} className="bg-slate-700">
                  {topic}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Topic */}
          <div>
            <label className="block text-white font-medium mb-2">
              O Tópico Personalizado
              {autoMonitorAllTopics && <span className="text-purple-400 text-xs ml-2">(Deshabilitado en modo auto-monitor)</span>}
            </label>
            <input
              type="text"
              value={customTopic}
              onChange={(e) => handleCustomTopicChange(e.target.value)}
              placeholder="Ej: sensors/temp/#"
              disabled={autoMonitorAllTopics}
              className={`w-full rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                autoMonitorAllTopics
                  ? 'bg-slate-600 border-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-700 border-slate-600'
              }`}
            />
          </div>

          {/* Controls */}
          <div className="flex items-end space-x-2">
            {autoMonitorAllTopics ? (
              <div className="flex-1 bg-purple-600/20 border border-purple-600/40 text-purple-300 font-medium py-2 px-3 rounded-lg flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                <span>Auto-monitor activo</span>
              </div>
            ) : !isMonitoring ? (
              <button
                onClick={handleStartMonitoring}
                disabled={!isConnected || (!selectedTopic && !customTopic)}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Iniciar</span>
              </button>
            ) : (
              <button
                onClick={handleStopMonitoring}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10h1m4 0h1m-6 4h.01" />
                </svg>
                <span>Detener</span>
              </button>
            )}

            <button
              onClick={clearMessages}
              className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200"
              title="Limpiar mensajes"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <button
              onClick={clearMonitorSettings}
              className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200"
              title="Limpiar configuración guardada"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Current Subscription */}
        {/* Current Subscription */}
        {isMonitoring && (
          <div className={`rounded-lg p-3 ${
            autoMonitorAllTopics
              ? 'bg-purple-600/20 border border-purple-600/40'
              : 'bg-blue-600/20 border border-blue-600/40'
          }`}>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                autoMonitorAllTopics ? 'bg-purple-400' : 'bg-blue-400'
              }`}></div>
              <span className={`font-medium ${
                autoMonitorAllTopics ? 'text-purple-300' : 'text-blue-300'
              }`}>
                {autoMonitorAllTopics ? 'Auto-monitoreando todos los topics' : 'Monitoreando:'}
              </span>
              {!autoMonitorAllTopics && (
                <span className="text-white font-mono text-sm">{customTopic || selectedTopic}</span>
              )}
            </div>
          </div>
        )}        {/* Filter */}
        {isMonitoring && (
          <div className="space-y-2">
            <input
              type="text"
              value={filterText}
              onChange={(e) => handleFilterChange(e.target.value)}
              placeholder="Filtrar mensajes..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <input
              type="text"
              value={deviceIdFilter}
              onChange={(e) => handleDeviceIdFilterChange(e.target.value)}
              placeholder="Filtrar por ID de dispositivo..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-600/20 border border-red-600/40 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-600/20 rounded-full flex items-center justify-center">
              <span className="text-red-400">⚠️</span>
            </div>
            <div>
              <h3 className="text-red-300 font-medium">Error MQTT</h3>
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages Display */}
      {isMonitoring && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Last Message */}
                    {/* Last Message */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9 8s9 3.582 9 8z" />
                </svg>
                <span>Último Mensaje</span>
                {lastMessage && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-400">LIVE</span>
                  </div>
                )}
              </h3>
              <div className="text-xs text-slate-400">
                Total: {messages.length} | Filtrados: {filteredMessages.length}
              </div>
            </div>

            {filteredMessages.length > 0 ? (
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-blue-300 font-medium text-sm">{filteredMessages[0].topic}</span>
                  <span className="text-slate-400 text-xs">
                    {new Date(filteredMessages[0].timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-green-400 text-xs font-mono bg-slate-900 p-3 rounded overflow-x-auto max-h-48">
                  {formatPayload(filteredMessages[0])}
                </pre>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">{isMonitoring ? '📡' : '📭'}</div>
                <p className="text-slate-400">
                  {isMonitoring ? 'Esperando mensajes...' : 'Inicia el monitoreo para ver mensajes'}
                </p>
                {isMonitoring && (
                  <p className="text-xs text-slate-500 mt-2">
                    Monitoreando: <code className="bg-slate-700 px-2 py-1 rounded">{topicToMonitor}</code>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Message History */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Historial</span>
              </h3>
              <span className="text-slate-400 text-sm bg-slate-700 px-2 py-1 rounded-lg">
                {filteredMessages.length} mensajes
              </span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredMessages.length > 0 ? (
                filteredMessages.slice(0, 10).map((message, index) => (
                  <div key={index} className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-purple-300 font-medium text-xs">{message.topic}</span>
                      <span className="text-slate-500 text-xs">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="text-green-400 text-xs font-mono bg-slate-900 p-2 rounded overflow-x-auto max-h-24">
                      {formatPayload(message)}
                    </pre>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">
                  {filterText ? 'No hay mensajes que coincidan' : 'Esperando mensajes...'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MessageMonitor
