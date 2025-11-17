import React from 'react'
import { useEmqxContext } from '../contexts/EmqxContext'

export const ClusterStats = () => {
  const { stats: globalStats, loading } = useEmqxContext()
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-slate-800 border border-slate-700 rounded-xl p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-slate-700 rounded-xl"></div>
              <div className="w-6 h-6 bg-slate-700 rounded-full"></div>
            </div>
            <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-slate-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!globalStats) {
    return null
  }

  const stats = [
    {
      label: 'Clientes Conectados',
      value: globalStats.clientsConnected,
      icon: '👥',
      gradient: ['#3B82F6', '#06B6D4'],
      trend: 12
    },
    {
      label: 'Mensajes Recibidos',
      value: globalStats.messagesReceived.toLocaleString(),
      icon: '📥',
      gradient: ['#10B981', '#059669'],
      trend: 8
    },
    {
      label: 'Mensajes Enviados',
      value: globalStats.messagesSent.toLocaleString(),
      icon: '📤',
      gradient: ['#A855F7', '#EC4899'],
      trend: 15
    },
    {
      label: 'Suscripciones',
      value: globalStats.subscriptions,
      icon: '🔔',
      gradient: ['#F97316', '#EF4444'],
      trend: 5
    }
  ]

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Estadísticas del Cluster</h2>
          <p className="text-slate-400">Métricas en tiempo real del sistema EMQX</p>
        </div>
        <div className="flex items-center space-x-2 text-slate-400">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm">Actualización automática</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="relative overflow-hidden rounded-xl bg-slate-800 border border-slate-700 p-6 hover:border-slate-600 transition-all duration-300 hover:shadow-xl group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-xl group-hover:scale-110 transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${stat.gradient[0]}30 0%, ${stat.gradient[1]}30 100%)`
                }}
              >
                {stat.icon}
              </div>
              <div className="flex items-center space-x-1 text-sm font-semibold">
                <span className="text-green-400">
                  ↑ {stat.trend}%
                </span>
              </div>
            </div>

            <h3 className="text-slate-400 text-sm font-medium mb-1">{stat.label}</h3>
            <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
            <p className="text-xs text-slate-500">Desde la última actualización</p>
          </div>
        ))}
      </div>
    </div>
  )
}
