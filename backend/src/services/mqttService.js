import mqtt from 'mqtt'
import { EventEmitter } from 'events'
import { PrismaClient } from '@prisma/client'
import { validateSensorPayload, validateRecordingCommand } from '../utils/mqttSchemas.js'

const prisma = new PrismaClient()

/**
 * Servicio MQTT para integración con sensores
 * Gestiona conexión, suscripciones y procesamiento de eventos
 * 
 * Características:
 * - Exponential backoff para reconexión
 * - Validación de payloads con Zod
 * - Credenciales seguras desde variables de entorno
 */
class MQTTService extends EventEmitter {
  constructor() {
    super()
    this.client = null
    this.isConnected = false
    
    // Configuración desde variables de entorno (sin hardcodear credenciales)
    this.config = {
      broker: process.env.MQTT_BROKER || process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
      username: process.env.MQTT_USERNAME || '',
      password: process.env.MQTT_PASSWORD || '',
      clientId: process.env.MQTT_CLIENT_ID || `camera_rtsp_${Date.now()}`,
      wsUrl: process.env.MQTT_WS_URL || 'ws://localhost:8083/mqtt'
    }
    
    // Configuración de reconexión con exponential backoff
    this.reconnectConfig = {
      baseDelay: parseInt(process.env.MQTT_RECONNECT_BASE_DELAY) || 1000,
      maxDelay: parseInt(process.env.MQTT_RECONNECT_MAX_DELAY) || 60000,
      maxRetries: parseInt(process.env.MQTT_RECONNECT_MAX_RETRIES) || 10,
      multiplier: parseInt(process.env.MQTT_RECONNECT_MULTIPLIER) || 2
    }
    
    // Estado de reconexión
    this.reconnectState = {
      attempts: 0,
      currentDelay: this.reconnectConfig.baseDelay,
      isReconnecting: false,
      lastAttempt: null,
      timer: null
    }
    
    this.subscriptions = new Map()
    this.messageHandlers = new Map()
    this.statistics = {
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesValidated: 0,
      validationErrors: 0,
      errors: 0,
      lastMessageTime: null,
      reconnectAttempts: 0
    }
    
    // Cargar configuración de la base de datos
    this.loadConfigFromDB()
  }

  /**
   * Carga la configuración MQTT desde la base de datos
   */
  async loadConfigFromDB() {
    try {
      const dbConfig = await prisma.mqttConfig.findFirst({ where: { isActive: true } })
      if (dbConfig) {
        this.config = {
          broker: dbConfig.broker,
          username: dbConfig.username,
          password: dbConfig.password,
          clientId: dbConfig.clientId || `camera_rtsp_${Date.now()}`,
          wsUrl: this.config.wsUrl // Mantener WebSocket URL
        }
        console.log('✅ Configuración MQTT cargada de la base de datos:', dbConfig.broker)
      } else {
        console.log('ℹ️ Usando configuración MQTT desde variables de entorno:', this.config.broker)
      }
    } catch (error) {
      console.log('⚠️ Usando configuración MQTT por defecto:', error.message)
    }
  }

  /**
   * Actualiza la configuración MQTT en caliente
   */
  async updateConfig(newConfig) {
    const wasConnected = this.isConnected
    
    if (wasConnected) {
      await this.disconnect()
    }
    
    this.config = {
      broker: newConfig.broker || this.config.broker,
      username: newConfig.username || this.config.username,
      password: newConfig.password || this.config.password,
      clientId: newConfig.clientId || this.config.clientId,
      wsUrl: newConfig.wsUrl || this.config.wsUrl
    }
    
    // Reiniciar estado de reconexión
    this.resetReconnectState()
    
    if (wasConnected) {
      await this.connect()
    }
    
    return this.config
  }

  /**
   * Reinicia el estado de reconexión
   */
  resetReconnectState() {
    if (this.reconnectState.timer) {
      clearTimeout(this.reconnectState.timer)
    }
    this.reconnectState = {
      attempts: 0,
      currentDelay: this.reconnectConfig.baseDelay,
      isReconnecting: false,
      lastAttempt: null,
      timer: null
    }
  }

  /**
   * Calcula el próximo delay con exponential backoff
   */
  calculateNextDelay() {
    const { currentDelay, attempts } = this.reconnectState
    const { maxDelay, multiplier } = this.reconnectConfig
    
    // Exponential backoff con jitter
    const jitter = Math.random() * 0.3 + 0.85 // 85% - 115% del delay
    const nextDelay = Math.min(currentDelay * multiplier * jitter, maxDelay)
    
    return Math.round(nextDelay)
  }

  /**
   * Intenta reconexión con exponential backoff
   */
  scheduleReconnect() {
    const { maxRetries } = this.reconnectConfig
    const { attempts } = this.reconnectState

    if (attempts >= maxRetries) {
      console.error(`❌ MQTT: Máximo de reintentos alcanzado (${maxRetries}). Pausando reconexión.`)
      this.emit('reconnect_failed', { attempts, maxRetries })
      this.reconnectState.isReconnecting = false
      return
    }

    if (this.reconnectState.isReconnecting) {
      return // Ya hay una reconexión programada
    }

    this.reconnectState.isReconnecting = true
    const delay = this.calculateNextDelay()
    this.reconnectState.currentDelay = delay

    console.log(`🔄 MQTT: Reconexión programada en ${delay}ms (intento ${attempts + 1}/${maxRetries})`)
    this.emit('reconnect_scheduled', { delay, attempt: attempts + 1, maxRetries })

    this.reconnectState.timer = setTimeout(async () => {
      this.reconnectState.attempts++
      this.reconnectState.lastAttempt = new Date()
      this.statistics.reconnectAttempts++

      try {
        await this.connect()
        // Conexión exitosa - reiniciar estado
        this.resetReconnectState()
        console.log('✅ MQTT: Reconexión exitosa')
        this.emit('reconnect_success', { attempts: this.reconnectState.attempts })
      } catch (error) {
        console.error(`❌ MQTT: Reconexión fallida:`, error.message)
        this.reconnectState.isReconnecting = false
        // Programar siguiente intento
        this.scheduleReconnect()
      }
    }, delay)
  }

  /**
   * Conectar al broker MQTT
   */
  async connect() {
    if (this.isConnected) {
      console.log('✅ Ya conectado a MQTT')
      return { success: true, broker: this.config.broker }
    }

    // Validar que hay credenciales configuradas
    if (!this.config.broker) {
      throw new Error('MQTT_BROKER no configurado. Revisa las variables de entorno.')
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`🔌 Conectando a MQTT: ${this.config.broker}`)

        this.client = mqtt.connect(this.config.broker, {
          clientId: this.config.clientId,
          username: this.config.username,
          password: this.config.password,
          clean: true,
          reconnectPeriod: 0, // Desactivar reconexión automática (usamos nuestro backoff)
          connectTimeout: 30000,
          keepalive: 60
        })

        this.client.on('connect', () => {
          console.log('✅ Conectado a MQTT broker')
          this.isConnected = true
          this.resetReconnectState() // Éxito - reiniciar backoff
          this.emit('connected')
          
          // Auto-suscribirse a tópicos base
          this.autoSubscribe()
          
          resolve({ success: true, broker: this.config.broker })
        })

        this.client.on('message', (topic, message) => {
          this.handleMessage(topic, message)
        })

        this.client.on('error', (error) => {
          console.error('❌ Error MQTT:', error.message)
          this.statistics.errors++
          this.emit('error', error)
          
          // No rechazar si ya estamos conectados (error transitorio)
          if (!this.isConnected) {
            reject(error)
          }
        })

        this.client.on('close', () => {
          console.log('🔌 Conexión MQTT cerrada')
          const wasConnected = this.isConnected
          this.isConnected = false
          this.emit('disconnected')
          
          // Iniciar reconexión si estábamos conectados
          if (wasConnected && !this.reconnectState.isReconnecting) {
            this.scheduleReconnect()
          }
        })

        this.client.on('offline', () => {
          console.log('📴 MQTT offline')
          this.emit('offline')
        })

      } catch (error) {
        console.error('❌ Error conectando a MQTT:', error)
        reject(error)
      }
    })
  }

  /**
   * Auto-suscribirse a tópicos principales
   */
  async autoSubscribe() {
    const topics = [
      'camera_rtsp/sensors/#',      // Todos los sensores
      'camera_rtsp/cameras/+/command', // Comandos a cámaras
      'camera_rtsp/rules/#'         // Eventos de reglas
    ]

    for (const topic of topics) {
      await this.subscribe(topic)
    }
  }

  /**
   * Suscribirse a un tópico
   */
  subscribe(topic, handler = null) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new Error('Cliente MQTT no conectado'))
        return
      }

      this.client.subscribe(topic, { qos: 1 }, (error, granted) => {
        if (error) {
          console.error(`❌ Error suscribiendo a ${topic}:`, error)
          reject(error)
        } else {
          console.log(`✅ Suscrito a: ${topic}`)
          this.subscriptions.set(topic, granted)
          
          if (handler) {
            this.messageHandlers.set(topic, handler)
          }
          
          resolve(granted)
        }
      })
    })
  }

  /**
   * Desuscribirse de un tópico
   */
  unsubscribe(topic) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Cliente MQTT no conectado'))
        return
      }

      this.client.unsubscribe(topic, (error) => {
        if (error) {
          console.error(`❌ Error desuscribiendo de ${topic}:`, error)
          reject(error)
        } else {
          console.log(`✅ Desuscrito de: ${topic}`)
          this.subscriptions.delete(topic)
          this.messageHandlers.delete(topic)
          resolve()
        }
      })
    })
  }

  /**
   * Publicar mensaje a un tópico
   */
  publish(topic, message, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new Error('Cliente MQTT no conectado'))
        return
      }

      const payload = typeof message === 'string' ? message : JSON.stringify(message)

      this.client.publish(topic, payload, { qos: 1, retain: false, ...options }, (error) => {
        if (error) {
          console.error(`❌ Error publicando en ${topic}:`, error)
          reject(error)
        } else {
          console.log(`📤 Publicado en ${topic}:`, payload.substring(0, 100))
          resolve()
        }
      })
    })
  }

  /**
   * Manejar mensajes recibidos con validación
   */
  async handleMessage(topic, message) {
    try {
      this.statistics.messagesReceived++
      this.statistics.lastMessageTime = new Date()

      const payload = message.toString()
      console.log(`📨 Mensaje recibido en ${topic}`)

      let data
      try {
        data = JSON.parse(payload)
      } catch (e) {
        data = { raw: payload }
      }

      // Procesar según el tipo de tópico
      if (topic.startsWith('camera_rtsp/sensors/')) {
        await this.processSensorData(topic, data)
      } else if (topic.includes('/command')) {
        await this.processCommand(topic, data)
      }

      // Llamar handlers personalizados
      const handler = this.messageHandlers.get(topic)
      if (handler) {
        await handler(topic, data)
      }

      // Emitir evento general
      this.emit('message', { topic, data, timestamp: new Date() })

      this.statistics.messagesProcessed++

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error)
      this.statistics.errors++
      this.emit('error', error)
    }
  }

  /**
   * Procesar datos de sensores con validación Zod
   */
  async processSensorData(topic, data) {
    try {
      // Extraer tipo de sensor y ID del tópico
      const parts = topic.split('/')
      const sensorId = parts[parts.length - 1]
      const sensorType = parts.slice(2, -1).join('/')

      if (!sensorType || !sensorId) {
        console.warn('⚠️ Tópico de sensor inválido:', topic)
        return
      }

      console.log(`🌡️ Procesando ${sensorType} de sensor ${sensorId}`)

      // ═══════════════════════════════════════════════════════════════
      // VALIDACIÓN CON ZOD
      // ═══════════════════════════════════════════════════════════════
      const validation = validateSensorPayload(sensorType, data)
      
      if (!validation.success) {
        console.warn(`⚠️ Payload inválido para sensor ${sensorId}:`, validation.error)
        this.statistics.validationErrors++
        this.emit('validation_error', { 
          sensorId, 
          sensorType, 
          error: validation.error, 
          data 
        })
        // Continuar procesando pero con advertencia
        // Opcional: return aquí para rechazar payloads inválidos
      } else {
        this.statistics.messagesValidated++
        data = validation.data // Usar datos normalizados por Zod
      }

      // Buscar o crear sensor en BD
      let sensor = await prisma.sensor.findUnique({
        where: { sensorId }
      })

      if (!sensor) {
        console.log(`➕ Creando nuevo sensor: ${sensorId}`)
        sensor = await prisma.sensor.create({
          data: {
            sensorId,
            name: `${sensorType}_${sensorId}`,
            type: sensorType,
            unit: this.getUnitForType(sensorType),
            isActive: true
          }
        })
      }

      // Guardar evento del sensor
      await prisma.sensorEvent.create({
        data: {
          sensorId: sensor.id,
          value: JSON.stringify(data),
          timestamp: new Date(data.timestamp || Date.now())
        }
      })

      // Evaluar reglas de grabación
      await this.evaluateRules(sensor, data)

      console.log(`✅ Datos de sensor guardados: ${sensorId}`)

    } catch (error) {
      console.error('❌ Error procesando datos de sensor:', error)
      throw error
    }
  }

  /**
   * Evaluar reglas de grabación
   */
  async evaluateRules(sensor, data) {
    try {
      // Obtener reglas activas para este sensor
      const rules = await prisma.recordingRule.findMany({
        where: {
          sensorId: sensor.id,
          isActive: true
        },
        orderBy: {
          priority: 'desc'
        }
      })

      if (rules.length === 0) {
        return
      }

      console.log(`📋 Evaluando ${rules.length} regla(s) para sensor ${sensor.sensorId}`)

      for (const rule of rules) {
        try {
          const condition = JSON.parse(rule.condition)
          const action = JSON.parse(rule.action)

          // Evaluar condición
          if (this.checkCondition(data, condition)) {
            console.log(`✅ Regla cumplida: ${rule.name}`)
            
            // Ejecutar acción
            await this.executeAction(rule, action, data)
            
            // Registrar ejecución
            await prisma.ruleExecution.create({
              data: {
                ruleId: rule.id,
                sensorValue: JSON.stringify(data),
                cameras: JSON.stringify(action.cameras || []),
                success: true
              }
            })
          }
        } catch (error) {
          console.error(`❌ Error evaluando regla ${rule.id}:`, error)
          
          await prisma.ruleExecution.create({
            data: {
              ruleId: rule.id,
              sensorValue: JSON.stringify(data),
              cameras: JSON.stringify([]),
              success: false,
              error: error.message
            }
          })
        }
      }

    } catch (error) {
      console.error('❌ Error evaluando reglas:', error)
    }
  }

  /**
   * Verificar si se cumple una condición
   */
  checkCondition(data, condition) {
    const { field, operator, value } = condition
    const dataValue = field ? data[field] : (data.value !== undefined ? data.value : null)

    if (dataValue === null || dataValue === undefined) {
      return false
    }

    switch (operator) {
      case '>':
        return parseFloat(dataValue) > parseFloat(value)
      case '<':
        return parseFloat(dataValue) < parseFloat(value)
      case '>=':
        return parseFloat(dataValue) >= parseFloat(value)
      case '<=':
        return parseFloat(dataValue) <= parseFloat(value)
      case '==':
        return dataValue == value
      case '!=':
        return dataValue != value
      default:
        return false
    }
  }

  /**
   * Ejecutar acción de regla con validación
   */
  async executeAction(rule, action, sensorData) {
    try {
      console.log(`🎬 Ejecutando acción: ${action.type}`)

      // Validar comando antes de ejecutar
      const commandData = {
        command: action.type === 'start_recording' ? 'start' : 'stop',
        rule: rule.name,
        ruleId: rule.id,
        sensorData,
        duration: action.duration || null,
        timestamp: new Date().toISOString()
      }

      const validation = validateRecordingCommand(commandData)
      if (!validation.success) {
        console.error(`❌ Comando inválido:`, validation.error)
        throw new Error(`Comando inválido: ${validation.error}`)
      }

      if (action.type === 'start_recording' && action.cameras) {
        for (const cameraId of action.cameras) {
          await this.publish(`camera_rtsp/cameras/${cameraId}/recording/command`, commandData)
          console.log(`📹 Comando de grabación enviado a cámara ${cameraId}`)
        }
      } else if (action.type === 'stop_recording' && action.cameras) {
        for (const cameraId of action.cameras) {
          await this.publish(`camera_rtsp/cameras/${cameraId}/recording/command`, {
            command: 'stop',
            rule: rule.name,
            ruleId: rule.id,
            timestamp: new Date().toISOString()
          })
        }
      }

    } catch (error) {
      console.error('❌ Error ejecutando acción:', error)
      throw error
    }
  }

  /**
   * Procesar comandos con validación
   */
  async processCommand(topic, data) {
    console.log(`⚡ Comando recibido en ${topic}:`, data)
    
    // Validar comando
    const validation = validateRecordingCommand(data)
    if (!validation.success) {
      console.warn(`⚠️ Comando inválido recibido:`, validation.error)
      this.statistics.validationErrors++
      this.emit('validation_error', { topic, error: validation.error, data })
    }
    
    this.emit('command', { topic, data })
  }

  /**
   * Obtener unidad según tipo de sensor
   */
  getUnitForType(type) {
    const units = {
      temperature: '°C',
      humidity: '%',
      co2: 'ppm',
      emotibit: 'mixed',
      presion: 'hPa',
      ruido: 'dB',
      luz: 'lux',
      voc: 'ppb',
      'gases/no2': 'ppm',
      'gases/so2': 'ppm',
      'gases/o3': 'ppm',
      'gases/co': 'ppm'
    }
    return units[type] || ''
  }

  /**
   * Obtener estadísticas incluyendo reconexión y validación
   */
  getStatistics() {
    return {
      ...this.statistics,
      isConnected: this.isConnected,
      subscriptions: Array.from(this.subscriptions.keys()),
      reconnect: {
        attempts: this.reconnectState.attempts,
        currentDelay: this.reconnectState.currentDelay,
        isReconnecting: this.reconnectState.isReconnecting,
        lastAttempt: this.reconnectState.lastAttempt,
        config: this.reconnectConfig
      }
    }
  }

  /**
   * Obtener configuración (sin exponer contraseña)
   */
  getConfig() {
    return {
      broker: this.config.broker,
      username: this.config.username,
      clientId: this.config.clientId,
      wsUrl: this.config.wsUrl,
      hasPassword: !!this.config.password
    }
  }

  /**
   * Desconectar del broker
   */
  async disconnect() {
    // Cancelar cualquier reconexión pendiente
    if (this.reconnectState.timer) {
      clearTimeout(this.reconnectState.timer)
      this.reconnectState.timer = null
    }
    this.reconnectState.isReconnecting = false

    if (this.client) {
      console.log('🔌 Desconectando de MQTT...')
      return new Promise((resolve) => {
        this.client.end(false, () => {
          this.isConnected = false
          this.client = null
          console.log('✅ Desconectado de MQTT')
          resolve()
        })
      })
    }
  }
}

// Singleton
const mqttService = new MQTTService()

export default mqttService
