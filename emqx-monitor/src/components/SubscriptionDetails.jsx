import { useState, useEffect } from 'react'
import axios from 'axios'

export function SubscriptionDetails() {
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [messages, setMessages] = useState({})

  useEffect(() => {
    // Obtener lista de subscripciones
    const fetchSubscriptions = async () => {
      try {
        const response = await axios.get('/api/v5/subscriptions?page=1&limit=500')
        const subs = response.data.data || []
        
        // Agrupar por tópico
        const groupedByTopic = {}
        subs.forEach(sub => {
          if (!groupedByTopic[sub.topic]) {
            groupedByTopic[sub.topic] = []
          }
          groupedByTopic[sub.topic].push(sub)
        })

        setSubscriptions(Object.entries(groupedByTopic))
        setError(null)
      } catch (err) {
        setError('Error al obtener subscripciones')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    // Iniciar fetching periódico
    const interval = setInterval(fetchSubscriptions, 5000)
    fetchSubscriptions() // Primera llamada inmediata

    return () => clearInterval(interval)
  }, [])

  // Simular recepción de mensajes (en producción, usar WebSocket o Server-Sent Events)
  useEffect(() => {
    if (selectedTopic) {
      const simulateMessage = () => {
        const newMessage = {
          timestamp: new Date().toLocaleTimeString(),
          topic: selectedTopic,
          data: `Mensaje de ejemplo en ${selectedTopic}`,
          qos: Math.floor(Math.random() * 3)
        }

        setMessages(prev => ({
          ...prev,
          [selectedTopic]: [
            newMessage,
            ...(prev[selectedTopic] || []).slice(0, 9) // Guardar últimos 10
          ]
        }))
      }

      // Simular mensajes cada 2 segundos
      const interval = setInterval(simulateMessage, 2000)
      return () => clearInterval(interval)
    }
  }, [selectedTopic])

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📡 Detalles de Subscripciones</h3>
        <div className="text-slate-400">Cargando...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📡 Detalles de Subscripciones</h3>
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-6">📡 Detalles de Subscripciones ({subscriptions.length})</h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topics List */}
        <div className="lg:col-span-1 border-b lg:border-b-0 lg:border-r border-slate-600 pb-6 lg:pb-0 lg:pr-6">
          <h4 className="text-sm font-semibold text-white mb-4">Tópicos Disponibles:</h4>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {subscriptions.length === 0 ? (
              <p className="text-slate-400">No hay subscripciones</p>
            ) : (
              subscriptions.map(([topic, subs]) => (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                    selectedTopic === topic
                      ? 'bg-blue-600 text-white border border-blue-500'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-xs truncate">{topic}</strong>
                    <span className="text-xs bg-slate-600/50 px-2 py-1 rounded">
                      {subs.length}
                    </span>
                  </div>
                  <small className="text-xs opacity-70">{subs.length} suscriptor(es)</small>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Topic Details */}
        {selectedTopic && (
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Tópico: <span className="text-blue-300 font-mono">{selectedTopic}</span></h4>
            </div>

            {/* Subscribers */}
            <div>
              <h5 className="text-sm font-semibold text-white mb-3">Suscriptores:</h5>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {subscriptions.find(([topic]) => topic === selectedTopic)?.[1].map((sub, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600/30">
                    <span className="text-slate-300 text-sm font-mono truncate">{sub.clientid}</span>
                    <span className="text-xs bg-green-600/20 text-green-300 px-2 py-1 rounded border border-green-600/30">
                      QoS {sub.nl}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div>
              <h5 className="text-sm font-semibold text-white mb-3">Últimos Mensajes:</h5>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {(messages[selectedTopic] || []).length === 0 ? (
                  <p className="text-slate-400 text-sm p-3 bg-slate-700/30 rounded">Esperando mensajes...</p>
                ) : (
                  (messages[selectedTopic] || []).map((msg, idx) => (
                    <div key={idx} className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/30">
                      <small className="text-slate-500 text-xs">{msg.timestamp}</small>
                      <p className="text-slate-200 text-sm mt-1">{msg.data}</p>
                      <span className="inline-block text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded border border-blue-600/30 mt-2">
                        QoS {msg.qos}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
