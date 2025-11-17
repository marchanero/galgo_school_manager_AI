import mqtt from 'mqtt'

// Configuración MQTT
const MQTT_BROKER = 'ws://localhost:8083/mqtt' // WebSocket endpoint de EMQX
const MQTT_USERNAME = 'emqx_user' // Usuario MQTT
const MQTT_PASSWORD = 'emqx_password' // Contraseña MQTT

class MQTTClient {
  constructor() {
    this.client = null
    this.subscriptions = new Map() // topic -> Set of callbacks
    this.isConnected = false
    this.messageHistory = new Map() // topic -> array of messages
    this.maxHistorySize = 100 // Máximo mensajes por tópico
    this.statistics = {
      totalMessages: 0,
      messagesByTopic: {},
      lastMessageTime: null,
      connectionTime: null
    }
    this.connectionListeners = []
    this.debugMode = true // Activar logs detallados
  }

  log(message, data = null) {
    if (this.debugMode) {
      console.log(`[MQTT Client] ${message}`, data || '')
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.log('Iniciando conexión a', MQTT_BROKER)

        this.client = mqtt.connect(MQTT_BROKER, {
          username: MQTT_USERNAME,
          password: MQTT_PASSWORD,
          clientId: `monitor-app-${Date.now()}`,
          clean: true,
          reconnectPeriod: 5000,
          connectTimeout: 30000,
          keepalive: 60,
          protocolVersion: 4
        })

        this.client.on('connect', () => {
          this.log('✅ Conectado al broker MQTT exitosamente')
          this.isConnected = true
          this.statistics.connectionTime = new Date()
          this.notifyConnectionListeners(true)
          resolve()
        })

        this.client.on('message', (topic, message, packet) => {
          this.log(`📨 Mensaje recibido en ${topic}:`, message.toString())
          try {
            let payload
            try {
              payload = JSON.parse(message.toString())
            } catch (e) {
              payload = { raw: message.toString() }
            }
            this.handleMessage(topic, payload)
          } catch (error) {
            this.log(`❌ Error procesando mensaje de ${topic}:`, error.message)
            this.handleMessage(topic, { raw: message.toString() })
          }
        })

        this.client.on('error', (error) => {
          this.log('❌ Error MQTT:', error.message)
          this.isConnected = false
          reject(error)
        })

        this.client.on('disconnect', () => {
          this.log('🔌 Desconectado del broker MQTT')
          this.isConnected = false
          this.notifyConnectionListeners(false)
        })

        this.client.on('reconnect', () => {
          this.log('🔄 Intentando reconectar...')
        })

        this.client.on('offline', () => {
          this.log('⚠️ Cliente offline')
          this.isConnected = false
        })

        this.client.on('close', () => {
          this.log('🔌 Conexión cerrada')
          this.isConnected = false
        })
      } catch (error) {
        this.log('❌ Error al conectar:', error.message)
        reject(error)
      }
    })
  }

  handleMessage(topic, payload) {
    this.log(`🔔 Procesando mensaje de ${topic}`)

    // Agregar timestamp
    const messageWithTimestamp = {
      ...payload,
      timestamp: new Date().toISOString(),
      topic,
      _id: `${topic}-${Date.now()}-${Math.random()}`
    }

    // Actualizar estadísticas
    this.statistics.totalMessages++
    this.statistics.lastMessageTime = new Date()
    if (!this.statistics.messagesByTopic[topic]) {
      this.statistics.messagesByTopic[topic] = 0
    }
    this.statistics.messagesByTopic[topic]++

    // Mantener historial por tópico
    if (!this.messageHistory.has(topic)) {
      this.messageHistory.set(topic, [])
    }

    const history = this.messageHistory.get(topic)
    history.push(messageWithTimestamp)

    // Limitar tamaño del historial
    if (history.length > this.maxHistorySize) {
      history.shift()
    }

    // Notificar a callbacks suscritos al tópico específico
    if (this.subscriptions.has(topic)) {
      this.log(`Notificando ${this.subscriptions.get(topic).size} callbacks para ${topic}`)
      this.subscriptions.get(topic).forEach(callback => {
        try {
          callback(messageWithTimestamp)
        } catch (error) {
          this.log(`❌ Error en callback de mensaje:`, error.message)
        }
      })
    }

    // Notificar a callbacks de wildcard
    this.subscriptions.forEach((callbacks, subscriptionTopic) => {
      // El tópico de suscripción ya se procesó arriba si es exacto
      if (subscriptionTopic === topic) {
        return // Ya fue procesado como match exacto
      }

      // Verificar si el patrón coincide con el tópico recibido
      const matches = subscriptionTopic === '#' || this.matchesTopic(topic, subscriptionTopic)
      
      if (matches) {
        this.log(`✓ Topic ${topic} coincide con patrón ${subscriptionTopic}`)
        callbacks.forEach(callback => {
          try {
            callback(messageWithTimestamp)
          } catch (error) {
            this.log(`❌ Error en callback wildcard:`, error.message)
          }
        })
      }
    })
  }

  matchesTopic(topic, pattern) {
    // Convertir patrón MQTT a regex
    // + coincide con exactamente un nivel
    // # coincide con cero o más niveles
    const regexPattern = '^' + 
      pattern
        .replace(/\//g, '\\/') // Escapar barras
        .replace(/\#/g, '.*') // # = múltiples niveles (ANTES de +)
        .replace(/\+/g, '[^/]+') // + = un nivel (DESPUÉS de #)
        + '$'
    
    const regex = new RegExp(regexPattern)
    const result = regex.test(topic)
    return result
  }

  subscribe(topic, callback) {
    if (!this.client) {
      throw new Error('Cliente MQTT no inicializado')
    }

    if (!this.isConnected) {
      this.log(`⚠️ No conectado, pero intentando suscribirse a ${topic}`)
    }

    return new Promise((resolve, reject) => {
      this.log(`🔄 Suscribiéndose a ${topic}...`)

      this.client.subscribe(topic, { qos: 1 }, (error, granted) => {
        if (error) {
          this.log(`❌ Error suscribiéndose a ${topic}:`, error.message)
          reject(error)
          return
        }

        this.log(`✅ Suscrito a ${topic}`, granted)

        // Registrar callback
        if (!this.subscriptions.has(topic)) {
          this.subscriptions.set(topic, new Set())
        }
        this.subscriptions.get(topic).add(callback)
        this.log(`Callbacks para ${topic}:`, this.subscriptions.get(topic).size)

        resolve(granted)
      })
    })
  }

  unsubscribe(topic) {
    if (!this.client) {
      return
    }

    this.log(`🔄 Desuscribiéndose de ${topic}...`)

    this.client.unsubscribe(topic, (error) => {
      if (error) {
        this.log(`❌ Error desuscribiéndose de ${topic}:`, error.message)
        return
      }

      this.log(`✅ Desuscrito de ${topic}`)
      this.subscriptions.delete(topic)
      this.messageHistory.delete(topic)
      if (this.statistics.messagesByTopic[topic]) {
        delete this.statistics.messagesByTopic[topic]
      }
    })
  }

  getMessageHistory(topic = null) {
    if (topic) {
      return (this.messageHistory.get(topic) || []).slice().reverse()
    }

    // Retornar todos los mensajes de todos los tópicos ordenados
    const allMessages = []
    this.messageHistory.forEach((messages) => {
      allMessages.push(...messages)
    })

    return allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }

  getSubscribedTopics() {
    return Array.from(this.subscriptions.keys())
  }

  getStatistics() {
    return { ...this.statistics }
  }

  onConnectionChange(listener) {
    this.connectionListeners.push(listener)
  }

  notifyConnectionListeners(connected) {
    this.log(`📢 Notificando listeners de conexión: ${connected}`)
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected)
      } catch (error) {
        this.log(`❌ Error en connection listener:`, error.message)
      }
    })
  }

  disconnect() {
    if (this.client) {
      this.log('🔌 Desconectando cliente MQTT...')
      this.client.end()
      this.client = null
      this.isConnected = false
      this.subscriptions.clear()
      this.log('✅ Cliente MQTT desconectado')
    }
  }

  getConnectionStatus() {
    return this.client && this.client.connected
  }
}

// Instancia singleton
export const mqttClient = new MQTTClient()