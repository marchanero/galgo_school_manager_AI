import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { mqttClient } from '../services/mqttClient'
import { useEmqxData } from '../hooks/useEmqxData'

// ============================================================
// Único Context: Maneja MQTT, configuración y estado global
// ============================================================
const AppContext = createContext()

export const useEmqxContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useEmqxContext debe ser usado dentro de un EmqxProvider')
  }
  return context
}

// Alias para mantener compatibilidad
export const useMQTTContext = useEmqxContext

export const EmqxProvider = ({ children }) => {
  // ==================== MQTT STATE ====================
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [lastMessage, setLastMessage] = useState(null)
  const [error, setError] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [subscribedTopics, setSubscribedTopics] = useState([])

  // ==================== CONFIG STATE ====================
  const [config, setConfig] = useState({
    debugMode: true,
    maxMessagesHistory: 1000
  })

  // ==================== REST API DATA ====================
  const {
    clusterInfo,
    clients,
    subscriptions,
    nodes,
    loading,
    error: apiError,
    refetch: refetchApiData
  } = useEmqxData()

  // ==================== STATS STATE ====================
  const [stats, setStats] = useState({
    clientsConnected: 0,
    messagesReceived: 0,
    messagesSent: 0,
    subscriptions: 0,
    nodes: 0,
    uptime: 0,
    mqttMessagesCount: 0,
    lastActivity: null
  })

  // ==================== MQTT METHODS ====================

  // Conectar al broker MQTT
  const connect = useCallback(async () => {
    try {
      console.log('[EmqxProvider] Conectando al broker MQTT...')
      setError(null)

      if (mqttClient.isConnected) {
        console.log('[EmqxProvider] ℹ️ Ya conectado al broker')
        setIsConnected(true)
        setStatistics(mqttClient.getStatistics())
        return
      }

      await mqttClient.connect()
      setIsConnected(true)
      setStatistics(mqttClient.getStatistics())
      console.log('[EmqxProvider] ✅ Conectado exitosamente')
    } catch (err) {
      const errorMsg = err.message || 'Error al conectar'
      console.error('[EmqxProvider] ❌ Error de conexión:', errorMsg)
      setError(errorMsg)
      setIsConnected(false)
    }
  }, [])

  // Suscribirse a tópicos
  const subscribe = useCallback(async (topic) => {
    console.log('[EmqxProvider] Suscribiéndose a:', topic)

    if (!mqttClient.isConnected) {
      console.warn('[EmqxProvider] ⚠️ No conectado al broker MQTT')
      const msg = 'No conectado al broker MQTT'
      setError(msg)
      throw new Error(msg)
    }

    try {
      const handleMessage = (message) => {
        console.log('[EmqxProvider] 📨 Mensaje recibido:', {
          topic: message.topic,
          id: message._id
        })

        setLastMessage(message)

        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) {
            console.log('[EmqxProvider] ℹ️ Duplicado ignorado:', message._id)
            return prev
          }

          const newMessages = [message, ...prev]
          const limited = newMessages.slice(0, config.maxMessagesHistory)
          console.log('[EmqxProvider] ✓ Total en estado:', limited.length)
          return limited
        })

        setStatistics(mqttClient.getStatistics())
      }

      await mqttClient.subscribe(topic, handleMessage)
      setSubscribedTopics(mqttClient.getSubscribedTopics())
      setError(null)
      console.log('[EmqxProvider] ✅ Suscrito a', topic)

    } catch (err) {
      console.error('[EmqxProvider] ❌ Error:', err)
      setError(`Error al suscribirse a ${topic}: ${err.message}`)
      throw err
    }
  }, [config.maxMessagesHistory])

  // Desuscribirse de tópicos
  const unsubscribe = useCallback((topic) => {
    console.log('[EmqxProvider] Desuscribiéndose de:', topic)
    try {
      mqttClient.unsubscribe(topic)
      setSubscribedTopics(mqttClient.getSubscribedTopics())
      console.log('[EmqxProvider] ✅ Desuscrito de', topic)
      setError(null)
    } catch (err) {
      console.error('[EmqxProvider] ❌ Error:', err)
      setError(`Error al desuscribirse: ${err.message}`)
    }
  }, [])

  // Limpiar mensajes
  const clearMessages = useCallback(() => {
    console.log('[EmqxProvider] Limpiando mensajes...')
    setMessages([])
    setLastMessage(null)
  }, [])

  // Conectar automáticamente al montar
  useEffect(() => {
    console.log('[EmqxProvider] useEffect: Iniciando conexión...')
    connect()

    return () => {
      console.log('[EmqxProvider] Desmontando')
    }
  }, [connect])

  // Auto-suscribirse a vr/# cuando está conectado
  useEffect(() => {
    if (isConnected && subscribedTopics.length === 0) {
      console.log('[EmqxProvider] Conectado, auto-suscribiéndose a vr/#...')
      subscribe('vr/#').catch(err => {
        console.error('[EmqxProvider] Error en auto-suscripción:', err)
      })
    }
  }, [isConnected, subscribedTopics.length, subscribe])

  // Actualizar stats cuando cambian los datos MQTT
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      mqttMessagesCount: messages.length,
      lastActivity: lastMessage?.timestamp
    }))
  }, [messages.length, lastMessage])

  // Actualizar stats cuando cambian los datos de la API REST
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      clientsConnected: clients?.length || 0,
      subscriptions: subscriptions?.length || 0,
      nodes: nodes?.length || 0,
      uptime: clusterInfo?.uptime || 0,
      messagesReceived: clusterInfo?.messages?.received || 0,
      messagesSent: clusterInfo?.messages?.sent || 0
    }))
  }, [clients, subscriptions, nodes, clusterInfo])

  // ==================== CONFIG METHODS ====================
  const updateConfig = useCallback((newConfig) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  // ==================== CONTEXT VALUE ====================
  const value = {
    // MQTT
    isConnected,
    messages,
    lastMessage,
    error: error || apiError,
    statistics,
    subscribedTopics,
    connect,
    subscribe,
    unsubscribe,
    clearMessages,

    // CONFIG
    config,
    updateConfig,

    // REST API
    clients,
    subscriptions,
    nodes,
    clusterInfo,
    loading,
    refetchApiData,

    // STATS
    stats
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}