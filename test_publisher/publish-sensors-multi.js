#!/usr/bin/env node

/**
 * PUBLICADOR MULTI-SENSOR CONTINUO PARA CAMERA_RTSP
 * 
 * Publica datos de múltiples sensores de forma continua:
 * - Temperatura (°C)
 * - Humedad (%)
 * - CO2 (ppm)
 * - EmotiBit (heart_rate, temperature, eda)
 * 
 * Topics: camera_rtsp/sensors/{type}/{sensor_id}
 */

const mqtt = require('mqtt')

// Configuración MQTT (actualiza según tu broker)
const BROKER_URL = 'mqtt://100.82.84.24:1883'
const USERNAME = 'admin'
const PASSWORD = 'galgo2526'

// Configuración de sensores con sus intervalos específicos
const SENSORS = [
  { 
    id: 'TEMP001', 
    type: 'temperature', 
    name: 'Sensor Temperatura Lab', 
    location: 'Laboratorio', 
    min: 18, 
    max: 28,
    interval: 2000 // Cada 2 segundos
  },
  { 
    id: 'HUM001', 
    type: 'humidity', 
    name: 'Sensor Humedad Lab', 
    location: 'Laboratorio', 
    min: 40, 
    max: 70,
    interval: 2000 // Cada 2 segundos
  },
  { 
    id: 'CO2001', 
    type: 'co2', 
    name: 'Sensor CO2 Lab', 
    location: 'Laboratorio', 
    min: 400, 
    max: 1200,
    interval: 2000 // Cada 2 segundos
  },
  { 
    id: 'EMO001', 
    type: 'emotibit', 
    name: 'EmotiBit Usuario 1', 
    location: 'Usuario 1', 
    min: 60, 
    max: 100,
    interval: 40, // EmotiBit real: ~25Hz (40ms) para PPG/EDA
    // Frecuencias reales del EmotiBit:
    // - PPG (Photoplethysmography): 25Hz
    // - EDA (Electrodermal Activity): 15Hz
    // - Temperature: 7Hz
    // - Accelerometer: 25Hz
    // - Gyroscope: 25Hz
    // Usaremos 25Hz (40ms) como frecuencia base
  }
]

let messageCount = 0
let client = null

// Generar valores realistas con variación gradual
const sensorState = {}
const emotibitBuffer = {
  ppg: [], // Buffer para simulación de onda PPG
  eda: 5.0, // Nivel base de conductancia
  temp: 36.5, // Temperatura corporal base
  heartRate: 75, // BPM base
  hrv: 50, // Variabilidad (ms)
  lastBeat: Date.now(),
  beatInterval: 800 // ms entre latidos
}

SENSORS.forEach(sensor => {
  if (sensor.type === 'emotibit') {
    // EmotiBit tiene su propia estructura de estado
    sensorState[sensor.id] = {
      // Estado para simulación de señales fisiológicas
      phase: 0, // Fase de la onda cardíaca
      respirationPhase: 0 // Fase de respiración
    }
  } else {
    sensorState[sensor.id] = {
      value: (sensor.min + sensor.max) / 2,
      trend: (Math.random() - 0.5) * 2 // Tendencia inicial
    }
  }
})

function generateSensorValue(sensor) {
  const state = sensorState[sensor.id]
  const range = sensor.max - sensor.min
  
  // Cambiar tendencia ocasionalmente (20% de probabilidad)
  if (Math.random() < 0.2) {
    state.trend = (Math.random() - 0.5) * (range * 0.1)
  }
  
  // Aplicar tendencia con ruido
  state.value += state.trend + (Math.random() - 0.5) * (range * 0.05)
  
  // Mantener en rango
  state.value = Math.max(sensor.min, Math.min(sensor.max, state.value))
  
  return Math.round(state.value * 10) / 10
}

function generateEmotiBitValue(sensor) {
  const state = sensorState[sensor.id]
  const now = Date.now()
  
  // Actualizar fase cardíaca (simular onda PPG a ~25Hz)
  state.phase += 0.1 // Incremento por muestra
  if (state.phase >= 2 * Math.PI) {
    state.phase = 0
  }
  
  // Actualizar fase de respiración (más lenta, ~0.25Hz = 15 respiraciones/min)
  state.respirationPhase += 0.015
  if (state.respirationPhase >= 2 * Math.PI) {
    state.respirationPhase = 0
  }
  
  // Detectar latido (pico de onda)
  const timeSinceLastBeat = now - emotibitBuffer.lastBeat
  if (timeSinceLastBeat >= emotibitBuffer.beatInterval) {
    emotibitBuffer.lastBeat = now
    // Añadir variabilidad HRV (±50ms)
    emotibitBuffer.beatInterval = 60000 / emotibitBuffer.heartRate + (Math.random() - 0.5) * emotibitBuffer.hrv
  }
  
  // Simular señal PPG (Photoplethysmogram) - onda cardíaca
  const ppgWave = Math.sin(state.phase) * 0.3 + 0.7 // Normalizada 0.4-1.0
  const ppgValue = Math.round(ppgWave * 1000) / 1000 // 3 decimales
  
  // Heart Rate: Variar ligeramente alrededor del valor base
  emotibitBuffer.heartRate += (Math.random() - 0.5) * 0.5
  emotibitBuffer.heartRate = Math.max(60, Math.min(100, emotibitBuffer.heartRate))
  
  // EDA (Electrodermal Activity): Varía lentamente con respiración y estrés
  const edaBase = Math.sin(state.respirationPhase) * 0.5 + 5.0 // 4.5-5.5 μS
  emotibitBuffer.eda += (edaBase - emotibitBuffer.eda) * 0.05 + (Math.random() - 0.5) * 0.1
  emotibitBuffer.eda = Math.max(0, Math.min(10, emotibitBuffer.eda))
  
  // Temperatura corporal: Muy estable, pequeñas variaciones
  emotibitBuffer.temp += (Math.random() - 0.5) * 0.01
  emotibitBuffer.temp = Math.max(36.0, Math.min(37.5, emotibitBuffer.temp))
  
  // Calcular HRV (Heart Rate Variability) en RMSSD (ms)
  const hrv = Math.round(emotibitBuffer.hrv + (Math.random() - 0.5) * 5)
  
  return {
    // Señales de alta frecuencia (25Hz)
    ppg: ppgValue, // Señal cruda PPG
    heart_rate: Math.round(emotibitBuffer.heartRate), // BPM
    
    // EDA (15Hz típico, pero enviamos con PPG)
    eda: Math.round(emotibitBuffer.eda * 100) / 100, // μS (microsiemens)
    
    // Temperatura (7Hz típico)
    temperature: Math.round(emotibitBuffer.temp * 10) / 10, // °C
    
    // Métricas derivadas
    hrv: Math.max(20, Math.min(100, hrv)), // RMSSD en ms
    
    // Timestamp del último latido detectado
    ibi: Math.round(emotibitBuffer.beatInterval) // Inter-Beat Interval en ms
  }
}

function publishSensorData(sensor) {
  const topic = `camera_rtsp/sensors/${sensor.type}/${sensor.id}`
  
  let payload
  if (sensor.type === 'emotibit') {
    payload = {
      sensorId: sensor.id,
      timestamp: new Date().toISOString(),
      value: generateEmotiBitValue(sensor),
      location: sensor.location,
      sequence: ++messageCount
    }
  } else {
    payload = {
      sensorId: sensor.id,
      timestamp: new Date().toISOString(),
      value: generateSensorValue(sensor),
      location: sensor.location,
      sequence: ++messageCount
    }
  }
  
  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Error publicando ${sensor.type}:`, err.message)
    } else {
      if (sensor.type === 'emotibit') {
        // Log más detallado para EmotiBit
        const v = payload.value
        console.log(`✓ [${new Date().toLocaleTimeString()}] #${messageCount} → ${sensor.name}: HR:${v.heart_rate}bpm PPG:${v.ppg} EDA:${v.eda}μS T:${v.temperature}°C HRV:${v.hrv}ms`)
      } else {
        const valueStr = `${payload.value}${sensor.type === 'temperature' ? '°C' : sensor.type === 'humidity' ? '%' : 'ppm'}`
        console.log(`✓ [${new Date().toLocaleTimeString()}] #${messageCount} → ${sensor.name}: ${valueStr}`)
      }
    }
  })
}

// Conectar al broker
console.log('\n' + '='.repeat(70))
console.log('  📡 PUBLICADOR MULTI-SENSOR CONTINUO - CAMERA_RTSP')
console.log('='.repeat(70))
console.log(`\n🔗 Conectando a ${BROKER_URL}...`)

client = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  clean: true,
  clientId: `sensor-publisher-${Date.now()}`,
  reconnectPeriod: 5000
})

client.on('connect', () => {
  console.log('✅ Conectado al broker EMQX')
  console.log('\n📊 Sensores configurados:')
  SENSORS.forEach(sensor => {
    const freq = sensor.interval >= 1000 
      ? `${sensor.interval/1000}s` 
      : `${sensor.interval}ms (${Math.round(1000/sensor.interval)}Hz)`
    console.log(`  • ${sensor.name} (${sensor.type}) - ${sensor.location} [${freq}]`)
  })
  console.log(`\n📤 Publicando en topics: camera_rtsp/sensors/{type}/{id}`)
  console.log('🔍 Monitorea en tu dashboard: http://localhost:5173')
  console.log('🛑 Presiona Ctrl+C para detener\n')
  
  // Crear intervalos independientes para cada sensor
  const intervals = []
  
  SENSORS.forEach(sensor => {
    // Publicar inmediatamente
    publishSensorData(sensor)
    
    // Crear intervalo específico para este sensor
    const interval = setInterval(() => {
      publishSensorData(sensor)
    }, sensor.interval)
    
    intervals.push(interval)
  })
  
  // Limpiar al salir
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Deteniendo publicador...')
    console.log(`📊 Total de mensajes enviados: ${messageCount}`)
    
    // Limpiar todos los intervalos
    intervals.forEach(clearInterval)
    
    client.end(false, () => {
      console.log('✅ Desconectado del broker')
      console.log('='.repeat(70) + '\n')
      process.exit(0)
    })
  })
})

client.on('error', (error) => {
  console.error('\n❌ Error de conexión:', error.message)
  console.log('\n💡 Verifica:')
  console.log(`  • Broker: ${BROKER_URL}`)
  console.log(`  • Credenciales: ${USERNAME}/${PASSWORD}`)
  console.log('  • Firewall/conectividad de red')
  process.exit(1)
})

client.on('reconnect', () => {
  console.log('🔄 Reintentando conexión...')
})

client.on('offline', () => {
  console.log('⚠️  Cliente desconectado')
})
