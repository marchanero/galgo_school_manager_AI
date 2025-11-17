import { useState, useEffect, useCallback, useRef } from 'react'
import { mqttClient } from '../services/mqttClient'

export const useMQTT = (topics = []) => {
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [lastMessage, setLastMessage] = useState(null)
  const [error, setError] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [subscribedTopics, setSubscribedTopics] = useState([])
  
  // Refs para evitar issues de closure
  const messageCallbacks = useRef(new Map())
  const connectionListenerRef = useRef(null)
  const isConnectedRef = useRef(false)

  // Conectar al broker MQTT
  const connect = useCallback(async () => {
    try {
      console.log('[useMQTT] Conectando al broker MQTT...')
      setError(null)
      
      // Verificar si ya está conectado
      if (mqttClient.isConnected) {
        console.log('[useMQTT] ℹ️  Ya conectado al broker')
        setIsConnected(true)
        isConnectedRef.current = true
        setStatistics(mqttClient.getStatistics())
        return
      }

      await mqttClient.connect()
      setIsConnected(true)
      isConnectedRef.current = true
      setStatistics(mqttClient.getStatistics())
      console.log('[useMQTT] ✅ Conectado exitosamente')
    } catch (err) {
      const errorMsg = err.message || 'Error al conectar'
      console.error('[useMQTT] ❌ Error de conexión:', errorMsg)
      setError(errorMsg)
      setIsConnected(false)
      isConnectedRef.current = false
    }
  }, [])

  // Suscribirse a tópicos - MEJORADO CON MEJOR MANEJO DE CALLBACKS
  const subscribe = useCallback((topic) => {
    console.log('[useMQTT] Intentando suscribirse a:', topic)
    
    if (!mqttClient.isConnected) {
      console.warn('[useMQTT] ⚠️  No conectado al broker MQTT')
      const msg = 'No conectado al broker MQTT'
      setError(msg)
      return Promise.reject(new Error(msg))
    }

    try {
      // Crear callback que actualice el estado React
      const handleMessage = (message) => {
        console.log('[useMQTT] 📨 Mensaje recibido en callback:', {
          topic: message.topic,
          timestamp: message.timestamp,
          id: message._id,
          payload: JSON.stringify(message).substring(0, 100) + '...'
        })
        
        // Actualizar último mensaje
        setLastMessage(prevLast => {
          console.log('[useMQTT] 🔄 Actualizando lastMessage:', message.topic)
          return message
        })
        
        // Agregar a la lista de mensajes (máximo 500 para evitar memory leak)
        setMessages(prev => {
          // Evitar duplicados por ID
          if (prev.some(m => m._id === message._id)) {
            console.log('[useMQTT] ℹ️  Mensaje duplicado ignorado:', message._id)
            return prev
          }
          
          const newMessages = [message, ...prev]
          const limited = newMessages.slice(0, 500)
          console.log('[useMQTT] ✓ Mensaje agregado, total:', limited.length, 'para topic:', message.topic)
          return limited
        })
        
        // Actualizar estadísticas
        setStatistics(prev => {
          const updated = mqttClient.getStatistics()
          console.log('[useMQTT] 📊 Estadísticas actualizadas:', updated.totalMessages, 'mensajes totales')
          return updated
        })
      }

      // Guardar callback para limpiar después
      messageCallbacks.current.set(topic, handleMessage)
      console.log('[useMQTT] ✓ Callback registrado para:', topic)
      
      // Suscribirse al cliente MQTT
      return mqttClient.subscribe(topic, handleMessage)
        .then((granted) => {
          console.log('[useMQTT] ✅ Suscripción a', topic, 'exitosa')
          console.log('[useMQTT] 📡 Tópicos suscritos:', mqttClient.getSubscribedTopics())
          setSubscribedTopics(mqttClient.getSubscribedTopics())
          setError(null)
          return true
        })
        .catch(err => {
          console.error('[useMQTT] ❌ Error suscribiendo a', topic, ':', err.message)
          setError(`Error al suscribirse a ${topic}: ${err.message}`)
          messageCallbacks.current.delete(topic)
          throw err
        })
    } catch (err) {
      console.error('[useMQTT] ❌ Excepción al suscribirse:', err)
      setError(`Error al suscribirse a ${topic}: ${err.message}`)
      return Promise.reject(err)
    }
  }, [])

  // Desuscribirse de tópicos
  const unsubscribe = useCallback((topic) => {
    console.log('[useMQTT] Desuscribiéndose de:', topic)
    try {
      mqttClient.unsubscribe(topic)
      messageCallbacks.current.delete(topic)
      setSubscribedTopics(mqttClient.getSubscribedTopics())
      console.log('[useMQTT] ✅ Desuscripción exitosa')
      setError(null)
    } catch (err) {
      console.error('[useMQTT] ❌ Error al desuscribirse:', err)
      setError(`Error al desuscribirse de ${topic}: ${err.message}`)
    }
  }, [])

  // Limpiar mensajes
  const clearMessages = useCallback(() => {
    console.log('[useMQTT] Limpiando mensajes...')
    setMessages([])
    setLastMessage(null)
  }, [])

  // Obtener todos los tópicos suscritos
  const getSubscribedTopicsList = useCallback(() => {
    return mqttClient.getSubscribedTopics()
  }, [])

  // EFECTO 1: Inicializar listener de conexión
  useEffect(() => {
    console.log('[useMQTT] 🔧 Inicializando listener de conexión')
    
    connectionListenerRef.current = (connected) => {
      console.log('[useMQTT] 🔌 Estado de conexión cambió:', connected)
      setIsConnected(connected)
      isConnectedRef.current = connected
      
      if (connected) {
        console.log('[useMQTT] ✅ Conectado - actualizando estadísticas')
        setStatistics(mqttClient.getStatistics())
      } else {
        console.log('[useMQTT] ⚠️  Desconectado')
        setMessages([])
        setLastMessage(null)
      }
    }

    mqttClient.onConnectionChange(connectionListenerRef.current)

    // Actualizar estadísticas cada 1 segundo
    const statsInterval = setInterval(() => {
      if (mqttClient.isConnected) {
        setStatistics(mqttClient.getStatistics())
      }
    }, 1000)

    return () => {
      console.log('[useMQTT] 🧹 Limpiando estadísticas interval')
      clearInterval(statsInterval)
    }
  }, [])

  // EFECTO 2: Suscribirse automáticamente a tópicos cuando se conecta (si se proporcionan)
  useEffect(() => {
    console.log('[useMQTT] 📡 Connected:', isConnected, ', Topics provided:', topics.length)
    
    if (isConnected && topics.length > 0) {
      topics.forEach(topic => {
        console.log('[useMQTT] 🔄 Auto-suscribiendo a:', topic)
        subscribe(topic).catch(err => {
          console.error('[useMQTT] Error en auto-suscripción:', err.message)
        })
      })
    }
  }, [isConnected, topics, subscribe])

  // EFECTO 3: Cleanup al desmontar
  useEffect(() => {
    return () => {
      console.log('[useMQTT] 🧹 Desmontando componente - limpiando callbacks')
      messageCallbacks.current.clear()
    }
  }, [])

  return {
    isConnected,
    messages,
    lastMessage,
    error,
    statistics,
    subscribedTopics,
    connect,
    subscribe,
    unsubscribe,
    clearMessages,
    getSubscribedTopicsList,
    getMessageHistory: () => mqttClient.getMessageHistory()
  }
}