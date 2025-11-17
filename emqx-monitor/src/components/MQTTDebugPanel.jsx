import React, { useState, useEffect } from 'react'
import { mqttClient } from '../services/mqttClient'

export const MQTTDebugPanel = () => {
  const [debugInfo, setDebugInfo] = useState({
    isConnected: false,
    statistics: null,
    subscriptions: [],
    messagesByTopic: {}
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setDebugInfo({
        isConnected: mqttClient.isConnected,
        statistics: mqttClient.getStatistics(),
        subscriptions: mqttClient.getSubscribedTopics(),
        messagesByTopic: Object.fromEntries(mqttClient.messageHistory)
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold text-white mb-3">🔧 Debug Panel MQTT</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-700/50 p-3 rounded">
          <p className="text-sm text-slate-400">Estado:</p>
          <p className={`text-lg font-bold ${debugInfo.isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {debugInfo.isConnected ? '✅ Conectado' : '❌ Desconectado'}
          </p>
        </div>
        
        <div className="bg-slate-700/50 p-3 rounded">
          <p className="text-sm text-slate-400">Total Mensajes:</p>
          <p className="text-lg font-bold text-blue-400">{debugInfo.statistics?.totalMessages || 0}</p>
        </div>
      </div>

      <div className="bg-slate-700/30 p-3 rounded mb-4">
        <p className="text-sm text-slate-400 mb-2">Suscripciones Activas:</p>
        <div className="flex flex-wrap gap-2">
          {debugInfo.subscriptions.length === 0 ? (
            <span className="text-slate-500 text-sm">Sin suscripciones</span>
          ) : (
            debugInfo.subscriptions.map(topic => (
              <span key={topic} className="bg-blue-600/30 text-blue-300 px-3 py-1 rounded text-sm font-mono">
                {topic} ({debugInfo.statistics?.messagesByTopic?.[topic] || 0})
              </span>
            ))
          )}
        </div>
      </div>

      <div className="bg-slate-700/30 p-3 rounded">
        <p className="text-sm text-slate-400 mb-2">Mensajes por Tópico:</p>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {Object.entries(debugInfo.messagesByTopic).length === 0 ? (
            <p className="text-slate-500 text-sm">No hay mensajes</p>
          ) : (
            Object.entries(debugInfo.messagesByTopic).map(([topic, messages]) => (
              <div key={topic} className="text-xs text-slate-300 bg-slate-900/50 p-2 rounded font-mono">
                <strong>{topic}:</strong> {messages.length} mensajes
                {messages.length > 0 && (
                  <pre className="mt-1 text-slate-400 overflow-x-auto max-h-20">
                    {JSON.stringify(messages[messages.length - 1], null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
