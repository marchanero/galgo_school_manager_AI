import { useState, useEffect, useCallback } from 'react'

// Hook personalizado para persistencia con localStorage
export const useLocalStorage = (key, initialValue) => {
  // Estado para almacenar el valor actual
  const [storedValue, setStoredValue] = useState(() => {
    try {
      // Intentar obtener el valor del localStorage
      const item = window.localStorage.getItem(key)
      // Parsear el valor almacenado o retornar el valor inicial
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`[useLocalStorage] Error leyendo ${key} del localStorage:`, error)
      return initialValue
    }
  })

  // Función para actualizar el valor tanto en estado como en localStorage
  const setValue = useCallback((value) => {
    try {
      // Permitir que value sea una función para actualizar el estado anterior
      const valueToStore = value instanceof Function ? value(storedValue) : value

      // Guardar en estado local
      setStoredValue(valueToStore)

      // Guardar en localStorage
      window.localStorage.setItem(key, JSON.stringify(valueToStore))

      console.log(`[useLocalStorage] ✅ Guardado ${key}:`, valueToStore)
    } catch (error) {
      console.error(`[useLocalStorage] ❌ Error guardando ${key}:`, error)
    }
  }, [key, storedValue])

  // Función para eliminar el valor del localStorage
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
      setStoredValue(initialValue)
      console.log(`[useLocalStorage] 🗑️ Eliminado ${key}`)
    } catch (error) {
      console.error(`[useLocalStorage] ❌ Error eliminando ${key}:`, error)
    }
  }, [key, initialValue])

  // Efecto para sincronizar cambios desde otras pestañas/ventanas
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue))
          console.log(`[useLocalStorage] 🔄 Sincronizado ${key} desde otra pestaña`)
        } catch (error) {
          console.warn(`[useLocalStorage] Error sincronizando ${key}:`, error)
        }
      }
    }

    // Escuchar cambios en localStorage desde otras pestañas
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [key])

  return [storedValue, setValue, removeValue]
}

// Hook específico para configuración de la aplicación
export const useAppConfig = () => {
  const [config, setConfig] = useLocalStorage('emqx-monitor-config', {
    theme: 'dark',
    autoConnect: true,
    debugMode: false,
    maxMessagesHistory: 1000,
    messageRetentionHours: 24
  })

  const updateConfig = useCallback((updates) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [setConfig])

  return { config, updateConfig, setConfig }
}

// Hook específico para estado de MQTT
export const useMQTTState = () => {
  const [mqttState, setMqttState] = useLocalStorage('emqx-mqtt-state', {
    subscribedTopics: [],
    lastConnected: null,
    connectionAttempts: 0,
    autoReconnect: true
  })

  const updateMQTTState = useCallback((updates) => {
    setMqttState(prev => ({ ...prev, ...updates }))
  }, [setMqttState])

  const addSubscribedTopic = useCallback((topic) => {
    setMqttState(prev => ({
      ...prev,
      subscribedTopics: [...new Set([...prev.subscribedTopics, topic])]
    }))
  }, [setMqttState])

  const removeSubscribedTopic = useCallback((topic) => {
    setMqttState(prev => ({
      ...prev,
      subscribedTopics: prev.subscribedTopics.filter(t => t !== topic)
    }))
  }, [setMqttState])

  return {
    mqttState,
    updateMQTTState,
    addSubscribedTopic,
    removeSubscribedTopic,
    setMqttState
  }
}

// Hook específico para mensajes MQTT persistentes
export const usePersistentMessages = (maxMessages = 100) => {
  const [messages, setMessages] = useLocalStorage('emqx-messages', [])

  const addMessage = useCallback((message) => {
    setMessages(prev => {
      const newMessages = [message, ...prev]
      // Mantener solo los mensajes más recientes
      return newMessages.slice(0, maxMessages)
    })
  }, [setMessages, maxMessages])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [setMessages])

  const getMessagesByTopic = useCallback((topic) => {
    return messages.filter(msg => msg.topic === topic)
  }, [messages])

  return {
    messages,
    addMessage,
    clearMessages,
    getMessagesByTopic,
    setMessages
  }
}

// Hook específico para estado del MessageMonitor
export const useMessageMonitorState = () => {
  const [monitorState, setMonitorState] = useLocalStorage('emqx-message-monitor', {
    selectedTopic: '',
    customTopic: '',
    isMonitoring: false,
    filterText: '',
    deviceIdFilter: '', // Nuevo: filtro por ID de dispositivo
    showDebugPanel: false,
    topicToMonitor: null,
    autoScroll: true,
    messageFilter: 'all', // 'all', 'received', 'sent'
    autoMonitorAllTopics: false // Nuevo: monitorear automáticamente todos los topics
  })

  const updateMonitorState = useCallback((updates) => {
    setMonitorState(prev => ({ ...prev, ...updates }))
  }, [setMonitorState])

  return {
    monitorState,
    updateMonitorState,
    setMonitorState
  }
}