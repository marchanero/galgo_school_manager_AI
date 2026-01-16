import React, { useState, useEffect, useMemo } from 'react'
import { useMQTT } from '../contexts/MQTTContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useEmqxData } from '../hooks/useEmqxData'
import {
  Activity,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
  Users,
  MessageSquare,
  ArrowDown,
  ArrowUp,
  Clock,
  MapPin,
  Hash,
  Loader2,
  AlertCircle,
  CheckCircle,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  Volume2,
  Sun,
  Gauge,
  Zap
} from 'lucide-react'

function SensorsDashboard() {
  const { isConnected, sensorData, lastMessage } = useMQTT()
  const {
    clusterStats,
    sensorClients,
    messageMetrics,
    loading: emqxLoading,
    refetch: refetchEmqx
  } = useEmqxData(true, 5000) // Auto-refresh cada 5s

  const [sensors, setSensors] = useState([])
  const [activeSensors, setActiveSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Obtener escenario activo y sus sensores
  const { activeScenario, getActiveSensors } = useScenario()

  // Sensores del escenario activo con sus datos en tiempo real
  const scenarioSensors = useMemo(() => {
    if (!activeScenario) return []
    const scenarioSensorIds = getActiveSensors()

    // Helper: buscar datos MQTT para un sensor
    const findMqttData = (sensor) => {
      // 1. Buscar por sensorId exacto
      if (sensorData.has(sensor.sensorId)) {
        return sensorData.get(sensor.sensorId)
      }

      // 2. Buscar por coincidencia de tipo de sensor
      for (const [key, data] of sensorData.entries()) {
        if (data.type === sensor.type) {
          return data
        }
      }

      // 3. Buscar por coincidencia parcial del tópico
      if (sensor.topicBase) {
        for (const [key, data] of sensorData.entries()) {
          if (data.topic && data.topic.startsWith(sensor.topicBase)) {
            return data
          }
        }
      }

      return null
    }

    return sensors
      .filter(s => scenarioSensorIds.includes(s.sensorId) || scenarioSensorIds.includes(s.id) || scenarioSensorIds.includes(String(s.id)))
      .map(s => {
        const mqttData = findMqttData(s)
        return {
          ...s,
          isOnline: !!mqttData,
          liveData: mqttData || null
        }
      })
  }, [activeScenario, sensors, sensorData, getActiveSensors])

  useEffect(() => {
    fetchSensors()
  }, [])

  // Filtrar sensores activos basado en clientes EMQX y datos MQTT recibidos
  useEffect(() => {
    // Si hay datos MQTT, mostrar todos los sensores que tienen datos
    const sensorsFromMQTT = Array.from(sensorData.entries()).map(([sensorId, data]) => ({
      id: sensorId,
      name: typeof data.type === 'string' ? data.type : sensorId,
      sensorId: sensorId,
      type: typeof data.type === 'string' ? data.type : 'unknown',
      isActive: true,
      data: data
    }))

    // Combinar con sensores de la BD si existen
    if (sensors.length > 0) {
      const combinedSensors = sensors.map(sensor => {
        const mqttData = Array.from(sensorData.values()).find(
          data => data.type === sensor.type || sensorData.has(sensor.sensorId)
        )

        const hasPublisher = sensorClients.some(client =>
          client.clientid.includes(sensor.sensorId) ||
          client.clientid.includes('sensor-publisher') ||
          client.clientid.includes('stress-test')
        )

        return {
          ...sensor,
          hasData: !!mqttData,
          hasPublisher
        }
      }).filter(s => s.hasData || s.hasPublisher)

      setActiveSensors([...combinedSensors, ...sensorsFromMQTT.filter(
        mqtt => !combinedSensors.some(s => s.sensorId === mqtt.sensorId)
      )])
    } else {
      // Si no hay sensores en BD, mostrar solo los de MQTT
      setActiveSensors(sensorsFromMQTT)
    }
    setLoading(false)
  }, [sensors, sensorData, sensorClients])

  // Filtrar sensores que NO están en el escenario activo para el listado general
  const generalSensors = useMemo(() => {
    if (!activeScenario) return activeSensors

    // IDs de los sensores que ya están en el escenario
    const scenarioSensorIds = scenarioSensors.map(s => s.sensorId || s.id)

    return activeSensors.filter(s =>
      !scenarioSensorIds.includes(s.sensorId) &&
      !scenarioSensorIds.includes(s.id) &&
      !scenarioSensorIds.includes(String(s.id))
    )
  }, [activeSensors, scenarioSensors, activeScenario])

  const fetchSensors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/mqtt/sensors')
      const data = await response.json()
      if (data.success) {
        setSensors(data.data)
      }
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getSensorValue = (sensor) => {
    // Primero buscar por sensorId exacto
    if (sensorData.has(sensor.sensorId)) {
      return sensorData.get(sensor.sensorId)
    }

    // Si tiene data directa (del MQTT), usarla
    if (sensor.data) {
      return sensor.data
    }

    // Buscar por tipo de sensor
    const dataByType = Array.from(sensorData.values()).find(
      data => data.type === sensor.type
    )

    return dataByType || null
  }

  const getSensorIcon = (type) => {
    const icons = {
      temperature: Thermometer,
      humidity: Droplets,
      presion: Gauge,
      ruido: Volume2,
      luz: Sun,
      co2: Wind,
      voc: Activity,
      'gases/no2': Activity,
      'gases/so2': Activity,
      'gases/o3': Activity,
      'gases/co': Activity,
      emotibit: Heart
    }
    return icons[type] || Radio
  }

  const formatValue = (sensor, sensorData) => {
    if (!sensorData) return 'Sin datos'

    // Obtener el valor del sensor
    const data = sensorData.value || sensorData.data || {}

    if (sensor.type === 'emotibit') {
      const value = data.data || data.value || data

      // Calcular magnitud del acelerómetro si existen los valores
      const accelMagnitude = (value.accel_x !== undefined && value.accel_y !== undefined && value.accel_z !== undefined)
        ? Math.sqrt(value.accel_x ** 2 + value.accel_y ** 2 + value.accel_z ** 2).toFixed(3)
        : null

      return (
        <div className="space-y-2">
          {/* Heart Rate - Principal */}
          <div className="flex items-center space-x-2">
            <span className="text-3xl font-bold text-red-500 dark:text-red-400">
              {value.heart_rate || '--'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">bpm</span>
          </div>

          {/* Temperaturas */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {value.temperature && (
              <div className="flex items-center space-x-1">
                <span>🫀</span>
                <span className="font-medium">{value.temperature}°C</span>
              </div>
            )}
            {value.sensor_temperature && (
              <div className="flex items-center space-x-1">
                <span>🌡️</span>
                <span>{value.sensor_temperature}°C</span>
              </div>
            )}
          </div>

          {/* EDA y HRV */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {value.eda && (
              <div className="flex items-center space-x-1">
                <span>⚡</span>
                <span>{value.eda.toFixed(2)}μS</span>
              </div>
            )}
            {value.hrv && (
              <div className="flex items-center space-x-1">
                <span>💚</span>
                <span>HRV: {value.hrv}ms</span>
              </div>
            )}
          </div>

          {/* Acelerómetro */}
          {accelMagnitude && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Acelerómetro</span>
                <span className="font-medium">{accelMagnitude}g</span>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-1 text-xs text-gray-600 dark:text-gray-400">
                <div>X: {value.accel_x?.toFixed(3) || '--'}</div>
                <div>Y: {value.accel_y?.toFixed(3) || '--'}</div>
                <div>Z: {value.accel_z?.toFixed(3) || '--'}</div>
              </div>
            </div>
          )}

          {/* PPG (opcional, para debugging) */}
          {value.ppg !== undefined && (
            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
              <span>📈</span>
              <span>PPG: {value.ppg.toFixed(3)}</span>
            </div>
          )}
        </div>
      )
    }

    // Para otros tipos de sensores
    const value = data.value || data
    return `${value || 'N/A'} ${sensor.unit || ''}`
  }

  const getStatusColor = (sensor, sensorData) => {
    if (!sensorData) return 'bg-gray-500'

    const timestamp = sensorData.timestamp
    if (!timestamp) return 'bg-gray-500'

    const age = Date.now() - new Date(timestamp).getTime()
    if (age > 60000) return 'bg-yellow-500' // Más de 1 minuto

    return 'bg-green-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Cargando sensores...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Sensores en Tiempo Real
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monitoreo de sensores conectados via MQTT
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${isConnected
            ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                Desconectado
              </>
            )}
          </div>
          <button
            onClick={() => {
              fetchSensors()
              refetchEmqx()
            }}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors flex items-center gap-2"
            disabled={emqxLoading}
          >
            <RefreshCw className={`w-4 h-4 ${emqxLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Sensores del Escenario Activo - Premium Design */}
      {activeScenario && (
        <div className="relative overflow-hidden rounded-2xl border border-indigo-200/50 dark:border-indigo-700/50 bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/30 dark:from-gray-800 dark:via-indigo-900/20 dark:to-purple-900/20 shadow-xl">
          {/* Decorative gradient orbs */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-full blur-2xl" />

          {/* Header with gradient */}
          <div className="relative px-6 py-5 border-b border-indigo-100 dark:border-indigo-800/50 bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {activeScenario.name}
                  </h3>
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    {scenarioSensors.filter(s => s.isOnline).length} activos de {scenarioSensors.length} sensores
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold">
                  Escenario Activo
                </span>
              </div>
            </div>
          </div>

          {/* Sensors Grid */}
          <div className="relative p-6">
            {scenarioSensors.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {scenarioSensors.map((sensor) => (
                  <div
                    key={sensor.id}
                    className={`group relative rounded-xl p-4 transition-all duration-300 cursor-default ${sensor.isOnline
                      ? 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-emerald-200 dark:border-emerald-800/50 shadow-md hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1'
                      : 'bg-gray-50/80 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 opacity-75 hover:opacity-100'
                      }`}
                  >
                    {/* Status indicator glow */}
                    {sensor.isOnline && (
                      <div className="absolute top-2 right-2 w-2.5 h-2.5">
                        <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                        <span className="relative block w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                      </div>
                    )}
                    {!sensor.isOnline && (
                      <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-gray-400 rounded-full" />
                    )}

                    {/* Icon with gradient background */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${sensor.isOnline
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/25'
                      : 'bg-gray-200 dark:bg-gray-700'
                      }`}>
                      {React.createElement(getSensorIcon(sensor.type), {
                        className: sensor.isOnline ? 'w-5 h-5 text-white' : 'w-5 h-5 text-gray-400'
                      })}
                    </div>

                    {/* Sensor name */}
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 truncate">
                      {sensor.name}
                    </h4>

                    {/* Value display */}
                    <div className={`text-2xl font-bold mb-1 ${sensor.isOnline
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-gray-500'
                      }`}>
                      {sensor.isOnline && sensor.liveData
                        ? <span className="tabular-nums">{sensor.liveData.value?.toFixed(1) || '--'} <span className="text-sm font-normal text-gray-500">{sensor.unit || ''}</span></span>
                        : <span className="text-sm font-normal">Esperando...</span>
                      }
                    </div>

                    {/* Location */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {sensor.location || sensor.topicBase}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Radio className="w-12 h-12 mx-auto mb-3 text-indigo-300 dark:text-indigo-700" />
                <p className="text-gray-500 dark:text-gray-400">No hay sensores asignados a este escenario</p>
              </div>
            )}
          </div>
        </div>
      )}


      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Last Message Info - Simplified */}
      {lastMessage && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-blue-700 dark:text-blue-400">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm font-medium">Último mensaje:</span>
            <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded">{lastMessage.topic}</span>
          </div>
          <span className="text-xs text-blue-500 dark:text-blue-300">
            {new Date(lastMessage.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Empty State when no scenario is active */}
      {!activeScenario && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No hay escenario activo
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Activa un escenario desde el panel principal para ver sus sensores en tiempo real
          </p>
        </div>
      )}
    </div>
  )
}

export default SensorsDashboard
