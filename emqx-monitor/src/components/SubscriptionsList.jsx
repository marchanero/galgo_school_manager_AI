import React from 'react'
import { useEmqxContext } from '../contexts/EmqxContext'

export const SubscriptionsList = ({ fullView = false }) => {
  const { subscriptions, loading } = useEmqxContext()
  
  // Manejar null o no disponible
  if (!subscriptions) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            🔔 Topics Suscritos
          </h3>
        </div>
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📡</div>
          <p className="text-slate-400">Datos no disponibles</p>
        </div>
      </div>
    )
  }
  
  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            🔔 Topics Suscritos
          </h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-3 bg-slate-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Agrupar suscripciones por tópico
  const topicMap = {}
  subscriptions.forEach(sub => {
    if (!topicMap[sub.topic]) {
      topicMap[sub.topic] = {
        topic: sub.topic,
        subscribers: [],
        qos: sub.qos
      }
    }
    topicMap[sub.topic].subscribers.push(sub.clientid)
  })

  const topicList = Object.values(topicMap)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          🔔 Topics Suscritos
        </h3>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-600/20 text-orange-300 border border-orange-600/30">
          {topicList.length} tópicos
        </span>
      </div>

      {topicList.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-400">No hay tópicos suscritos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topicList.map((topic, index) => (
            <div key={index} className="p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all duration-200 border border-slate-600/30">
              <div className="font-medium text-white mb-2 flex items-center justify-between">
                <span className="font-mono text-sm text-blue-300">{topic.topic}</span>
                <span className="text-xs bg-slate-600/50 px-2 py-1 rounded text-slate-300">QoS: {topic.qos}</span>
              </div>
              <div className="text-sm text-slate-400 mb-2">
                {topic.subscribers.length} suscriptor{topic.subscribers.length !== 1 ? 'es' : ''}
              </div>
              <div className="text-xs text-slate-500 bg-slate-900/30 p-2 rounded border border-slate-600/20">
                <strong>Suscriptores:</strong> {topic.subscribers.join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
