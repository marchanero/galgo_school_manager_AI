import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import mqtt from 'mqtt'
import axios from 'axios'

const MQTTContext = createContext()

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function MQTTProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [sensorData, setSensorData] = useState(new Map())
  const [cameraStatus, setCameraStatus] = useState({})
  const [lastMessage, setLastMessage] = useState(null)
  const [error, setError] = useState(null)
  const [messageRate, setMessageRate] = useState(0)
  const [totalMessages, setTotalMessages] = useState(0)
  const [config, setConfig] = useState(null)
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)

  // Estado de reconexión
  const [reconnectState, setReconnectState] = useState({
    attempts: 0,
    isReconnecting: false,
    nextRetryIn: null
  })

  const clientRef = useRef(null)
  const messageHandlersRef = useRef(new Map())
  const messageCountRef = useRef(0)
  const lastRateUpdateRef = useRef(Date.now())
  const reconnectTimerRef = useRef(null)

  // Configuración de backoff (sincronizada con backend)
  const backoffConfig = {
    baseDelay: 1000,
    maxDelay: 60000,
    maxRetries: 10,
    multiplier: 2
  }
  const backoffStateRef = useRef({
    attempts: 0,
    currentDelay: backoffConfig.baseDelay
  })

  /**
   * Obtener configuración MQTT desde el backend
   */
  const fetchConfig = useCallback(async () => {
    try {
      setIsLoadingConfig(true)
      const response = await axios.get(`${API_BASE}/api/mqtt/config`)

      if (response.data.success) {
        setConfig(response.data.data)
        console.log('✅ Configuración MQTT cargada desde backend:', response.data.data.wsUrl)
        return response.data.data
      }
    } catch (err) {
      console.warn('⚠️ No se pudo cargar configuración MQTT, usando defaults:', err.message)
      // Fallback a configuración por defecto si el backend no está disponible
      const defaultConfig = {
        wsUrl: import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:8083/mqtt',
        username: '',
        hasPassword: false
      }
      setConfig(defaultConfig)
      return defaultConfig
    } finally {
      setIsLoadingConfig(false)
    }
  }, [])

  /**
   * Calcular próximo delay con exponential backoff
   */
  const calculateNextDelay = useCallback(() => {
    const { currentDelay } = backoffStateRef.current
    const jitter = Math.random() * 0.3 + 0.85
    const nextDelay = Math.min(currentDelay * backoffConfig.multiplier * jitter, backoffConfig.maxDelay)
    return Math.round(nextDelay)
  }, [])

  /**
   * Reiniciar estado de backoff
   */
  const resetBackoff = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    backoffStateRef.current = {
      attempts: 0,
      currentDelay: backoffConfig.baseDelay
    }
    setReconnectState({
      attempts: 0,
      isReconnecting: false,
      nextRetryIn: null
    })
  }, [])

  /**
   * Programar reconexión con backoff
   */
  const scheduleReconnect = useCallback(() => {
    const { attempts } = backoffStateRef.current

    if (attempts >= backoffConfig.maxRetries) {
      console.error(`❌ MQTT: Máximo de reintentos alcanzado (${backoffConfig.maxRetries})`)
      setReconnectState(prev => ({ ...prev, isReconnecting: false }))
      return
    }

    const delay = calculateNextDelay()
    backoffStateRef.current.currentDelay = delay
    backoffStateRef.current.attempts++

    console.log(`🔄 MQTT: Reconexión en ${delay}ms (intento ${backoffStateRef.current.attempts}/${backoffConfig.maxRetries})`)

    setReconnectState({
      attempts: backoffStateRef.current.attempts,
      isReconnecting: true,
      nextRetryIn: delay
    })

    reconnectTimerRef.current = setTimeout(async () => {
      try {
        await connect()
        resetBackoff()
        console.log('✅ MQTT: Reconexión exitosa')
      } catch (err) {
        console.error('❌ MQTT: Reconexión fallida:', err.message)
        scheduleReconnect()
      }
    }, delay)
  }, [calculateNextDelay, resetBackoff])

  /**
   * Conectar al broker MQTT
   */
  const connect = useCallback(async () => {
    if (clientRef.current?.connected) {
      console.log('✅ Ya conectado a MQTT')
      return
    }

    // Obtener configuración si no existe
    let mqttConfig = config
    if (!mqttConfig) {
      mqttConfig = await fetchConfig()
    }

    if (!mqttConfig?.wsUrl) {
      console.error('❌ No hay URL de WebSocket MQTT configurada')
      setError('Configuración MQTT no disponible')
      return
    }

    try {
      console.log('🔌 Conectando a MQTT:', mqttConfig.wsUrl)
      setError(null)

      const client = mqtt.connect(mqttConfig.wsUrl, {
        username: mqttConfig.username || '',
        password: '', // La contraseña no se expone al frontend
        clientId: `camera_rtsp_frontend_${Date.now()}`,
        clean: true,
        reconnectPeriod: 0, // Desactivar reconexión automática (usamos nuestro backoff)
        connectTimeout: 30000
      })

      client.on('connect', () => {
        console.log('✅ Conectado a MQTT broker')
        setIsConnected(true)
        setError(null)
        resetBackoff()

        // Auto-suscribirse a tópicos base
        const baseTopics = [
          'camera_rtsp/sensors/#',
          'camera_rtsp/cameras/+/recording/status',
          'camera_rtsp/rules/#',
          // Tópicos de sensores registrados
          'aula1/emotibit/#',
          'aula2/emotibit/#',
          'biblioteca/co2/#',
          'invernadero/humidity/#',
          'lab/sensors/#',
          'aulaMagna/temperature/#'
        ]

        baseTopics.forEach(topic => {
          client.subscribe(topic, { qos: 1 }, (error) => {
            if (error) {
              console.error(`❌ Error suscribiendo a ${topic}:`, error)
            } else {
              console.log(`✅ Suscrito a: ${topic}`)
            }
          })
        })
      })

      client.on('message', (topic, message) => {
        handleMessage(topic, message)
      })

      client.on('error', (err) => {
        console.error('❌ Error MQTT:', err.message)
        setError(err.message)
        setIsConnected(false)
      })

      client.on('close', () => {
        console.log('🔌 Conexión MQTT cerrada')
        const wasConnected = isConnected
        setIsConnected(false)

        // Iniciar reconexión si estábamos conectados
        if (wasConnected && !backoffStateRef.current.isReconnecting) {
          scheduleReconnect()
        }
      })

      client.on('offline', () => {
        console.log('📴 MQTT offline')
      })

      client.on('reconnect', () => {
        console.log('🔄 Reconectando a MQTT...')
      })

      clientRef.current = client

    } catch (err) {
      console.error('❌ Error conectando a MQTT:', err)
      setError(err.message)
      setIsConnected(false)
    }
  }, [config, fetchConfig, resetBackoff, scheduleReconnect, isConnected])

  /**
   * Suscribirse a un tópico
   */
  const subscribe = useCallback((topic, handler = null) => {
    if (!clientRef.current || !clientRef.current.connected) {
      console.warn('⚠️ Cliente MQTT no conectado')
      return Promise.reject(new Error('Cliente MQTT no conectado'))
    }

    return new Promise((resolve, reject) => {
      clientRef.current.subscribe(topic, { qos: 1 }, (error, granted) => {
        if (error) {
          console.error(`❌ Error suscribiendo a ${topic}:`, error)
          reject(error)
        } else {
          console.log(`✅ Suscrito a: ${topic}`)

          if (handler) {
            messageHandlersRef.current.set(topic, handler)
          }

          resolve(granted)
        }
      })
    })
  }, [])

  /**
   * Desuscribirse de un tópico
   */
  const unsubscribe = useCallback((topic) => {
    if (!clientRef.current) return

    clientRef.current.unsubscribe(topic, (error) => {
      if (error) {
        console.error(`❌ Error desuscribiendo de ${topic}:`, error)
      } else {
        console.log(`✅ Desuscrito de: ${topic}`)
        messageHandlersRef.current.delete(topic)
      }
    })
  }, [])

  /**
   * Publicar mensaje
   */
  const publish = useCallback((topic, message) => {
    if (!clientRef.current || !clientRef.current.connected) {
      console.warn('⚠️ Cliente MQTT no conectado')
      return Promise.reject(new Error('Cliente MQTT no conectado'))
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message)

    return new Promise((resolve, reject) => {
      clientRef.current.publish(topic, payload, { qos: 1 }, (error) => {
        if (error) {
          console.error(`❌ Error publicando en ${topic}:`, error)
          reject(error)
        } else {
          console.log(`📤 Publicado en ${topic}`)
          resolve()
        }
      })
    })
  }, [])

  /**
   * Manejar mensajes recibidos
   */
  const handleMessage = useCallback((topic, message) => {
    try {
      const payload = message.toString()
      let data

      try {
        data = JSON.parse(payload)
      } catch (e) {
        data = { raw: payload }
      }

      const messageObj = {
        topic,
        data,
        timestamp: new Date().toISOString(),
        _id: `${topic}_${Date.now()}_${Math.random()}`
      }

      console.log('📨 Mensaje MQTT recibido:', topic, data)

      // Incrementar contador de mensajes
      messageCountRef.current += 1
      setTotalMessages(prev => prev + 1)

      // Calcular tasa de mensajes cada segundo
      const now = Date.now()
      if (now - lastRateUpdateRef.current >= 1000) {
        setMessageRate(messageCountRef.current)
        messageCountRef.current = 0
        lastRateUpdateRef.current = now
      }

      // Actualizar último mensaje
      setLastMessage(messageObj)

      // Agregar a historial (máximo 100 mensajes)
      setMessages(prev => {
        const newMessages = [messageObj, ...prev]
        return newMessages.slice(0, 100)
      })

      // Procesar según tipo de tópico
      if (topic.startsWith('camera_rtsp/sensors/') ||
        topic.startsWith('aula') ||
        topic.startsWith('biblioteca/') ||
        topic.startsWith('invernadero/') ||
        topic.startsWith('lab/sensors/') ||
        topic.startsWith('aulaMagna/')) {
        console.log('🔍 Procesando mensaje de sensor:', topic)
        processSensorMessage(topic, data)
      } else if (topic.includes('/recording/status')) {
        processCameraStatus(topic, data)
      }

      // Llamar handlers personalizados
      const handler = messageHandlersRef.current.get(topic)
      if (handler) {
        handler(messageObj)
      }

      // Handlers por patrón wildcard
      messageHandlersRef.current.forEach((handler, pattern) => {
        if (matchTopic(topic, pattern)) {
          handler(messageObj)
        }
      })

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error)
    }
  }, [])

  /**
   * Procesar mensajes de sensores
   */
  const processSensorMessage = useCallback((topic, data) => {
    console.log('🔧 processSensorMessage called:', topic, data)
    const parts = topic.split('/')

    // Determinar el tipo de sensor y el ID según el formato del tópico
    let sensorId, sensorType

    if (topic.startsWith('camera_rtsp/sensors/')) {
      // Formato original: camera_rtsp/sensors/TYPE/ID
      sensorId = parts[parts.length - 1]
      sensorType = parts.slice(2, -1).join('/')
    } else {
      // Formato personalizado: location/category/deviceId/variable
      // Ej: aula1/emotibit/EM_AABBCCDD01/hr
      // Construir topicBase (sin el último segmento de variable)
      const topicBase = parts.slice(0, -1).join('/')
      sensorId = topicBase  // Usar topicBase como identificador único
      sensorType = data.type || parts[parts.length - 1]  // Usar type del payload o variable
    }

    console.log('🔍 Parsed sensor:', { sensorType, sensorId, parts })

    if (!sensorId) {
      console.warn('⚠️ Sensor inválido - falta id:', { sensorType, sensorId })
      return
    }

    setSensorData(prev => {
      const newMap = new Map(prev)
      newMap.set(sensorId, {
        type: sensorType,
        value: typeof data.value !== 'undefined' ? data.value : data,
        timestamp: data.timestamp || new Date().toISOString(),
        topic,
        location: data.location || parts[0]
      })
      console.log('✅ Sensor agregado al Map:', sensorId, newMap.size, 'sensores totales')
      return newMap
    })
  }, [])

  /**
   * Procesar estado de cámaras
   */
  const processCameraStatus = useCallback((topic, data) => {
    const parts = topic.split('/')
    const cameraId = parts[2]

    if (!cameraId) return

    setCameraStatus(prev => ({
      ...prev,
      [cameraId]: {
        status: data.status,
        camera: data.camera,
        timestamp: data.startedAt || data.stoppedAt || new Date().toISOString(),
        rule: data.rule,
        autoStart: data.autoStart
      }
    }))
  }, [])

  /**
   * Verificar si tópico coincide con patrón
   */
  const matchTopic = (topic, pattern) => {
    const regexPattern = '^' +
      pattern
        .replace(/\//g, '\\/')
        .replace(/\#/g, '.*')
        .replace(/\+/g, '[^/]+')
      + '$'

    const regex = new RegExp(regexPattern)
    return regex.test(topic)
  }

  /**
   * Limpiar mensajes
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    setLastMessage(null)
  }, [])

  /**
   * Desconectar
   */
  const disconnect = useCallback(() => {
    // Cancelar reconexión pendiente
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    if (clientRef.current) {
      console.log('🔌 Desconectando de MQTT...')
      clientRef.current.end()
      clientRef.current = null
      setIsConnected(false)
      resetBackoff()
    }
  }, [resetBackoff])

  /**
   * Conectar automáticamente al montar
   */
  useEffect(() => {
    fetchConfig().then(() => {
      connect()
    })

    return () => {
      disconnect()
    }
  }, []) // Solo al montar

  const value = {
    isConnected,
    messages,
    sensorData,
    cameraStatus,
    lastMessage,
    error,
    messageRate,
    totalMessages,
    config,
    isLoadingConfig,
    reconnectState,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    publish,
    clearMessages,
    fetchConfig
  }

  return (
    <MQTTContext.Provider value={value}>
      {children}
    </MQTTContext.Provider>
  )
}

export const useMQTT = () => {
  const context = useContext(MQTTContext)
  if (!context) {
    throw new Error('useMQTT must be used within a MQTTProvider')
  }
  return context
}
