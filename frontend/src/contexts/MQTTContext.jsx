import React, { useEffect } from 'react'
import { MQTTConnectionProvider, useMQTTConnection } from './mqtt/MQTTConnectionContext'
import { MQTTMessagesProvider, useMQTTMessages } from './mqtt/MQTTMessagesContext'
import { MQTTSensorDataProvider, useMQTTSensorData } from './mqtt/MQTTSensorDataContext'

/**
 * MQTTProvider - Compositor that combines all MQTT contexts
 * 
 * Provides a unified interface while internally using specialized contexts.
 * This maintains backward compatibility with existing code using useMQTT().
 * 
 * Architecture:
 * MQTTProvider
 *   └─ MQTTConnectionProvider (connection, config, reconnect)
 *       └─ MQTTMessagesProvider (messages, rate, handlers)
 *           └─ MQTTSensorDataProvider (sensor data, camera status)
 *               └─ children
 */
export function MQTTProvider({ children }) {
  return (
    <MQTTConnectionProvider>
      <MQTTCompositor>
        {children}
      </MQTTCompositor>
    </MQTTConnectionProvider>
  )
}

/**
 * Internal compositor component
 */
function MQTTCompositor({ children }) {
  const connection = useMQTTConnection()
  const client = connection.getClient()

  // Auto-connect on mount
  useEffect(() => {
    if (!connection.isConnected && !connection.isLoadingConfig) {
      connection.connect()
    }
  }, [connection.isConnected, connection.isLoadingConfig])

  // Auto-subscribe to base topics when connected
  useEffect(() => {
    if (!client || !connection.isConnected) return

    const baseTopics = [
      'camera_rtsp/sensors/#',
      'camera_rtsp/cameras/+/recording/status',
      'camera_rtsp/rules/#',
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

    // Cleanup: unsubscribe on unmount
    return () => {
      baseTopics.forEach(topic => {
        client.unsubscribe(topic)
      })
    }
  }, [client, connection.isConnected])

  return (
    <MQTTMessagesProvider mqttClient={client}>
      <MQTTSensorDataCompositor>
        {children}
      </MQTTSensorDataCompositor>
    </MQTTMessagesProvider>
  )
}

/**
 * Sensor data compositor
 */
function MQTTSensorDataCompositor({ children }) {
  const messages = useMQTTMessages()

  return (
    <MQTTSensorDataProvider mqttMessages={messages}>
      {children}
    </MQTTSensorDataProvider>
  )
}

/**
 * Unified hook for backward compatibility
 * 
 * This hook combines all three specialized contexts into a single interface.
 * Existing components can continue using useMQTT() without changes.
 */
export function useMQTT() {
  const connection = useMQTTConnection()
  const messages = useMQTTMessages()
  const sensorData = useMQTTSensorData()

  return {
    // Connection
    isConnected: connection.isConnected,
    error: connection.error,
    config: connection.config,
    isLoadingConfig: connection.isLoadingConfig,
    reconnectState: connection.reconnectState,
    connect: connection.connect,
    disconnect: connection.disconnect,

    // Messages  
    messages: messages.messages,
    lastMessage: messages.lastMessage,
    messageRate: messages.messageRate,
    totalMessages: messages.totalMessages,
    subscribe: messages.subscribe,
    unsubscribe: messages.unsubscribe,
    publish: messages.publish,
    registerHandler: messages.registerHandler,
    unregisterHandler: messages.unregisterHandler,
    clearMessages: messages.clearMessages,

    // Sensor Data
    sensorData: sensorData.sensorData,
    cameraStatus: sensorData.cameraStatus,
    getSensor: sensorData.getSensor,
    getActiveSensors: sensorData.getActiveSensors,
    clearSensorData: sensorData.clearSensorData,
    matchTopic: sensorData.matchTopic
  }
}

// Re-export individual hooks for optimized usage
export { useMQTTConnection } from './mqtt/MQTTConnectionContext'
export { useMQTTMessages } from './mqtt/MQTTMessagesContext'
export { useMQTTSensorData } from './mqtt/MQTTSensorDataContext'
