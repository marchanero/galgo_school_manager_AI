import React from 'react'
import { useEmqxContext } from '../contexts/EmqxContext'

export const ClientsList = ({ fullView = false }) => {
  const { clients, loading } = useEmqxContext()
  
  // Manejar null o no disponible
  if (!clients) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            👥 Clientes Conectados
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
            👥 Clientes Conectados
          </h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-4 bg-slate-700 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          👥 Clientes Conectados
        </h3>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-600/30">
          {clients.length} activos
        </span>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📡</div>
          <p className="text-slate-400">No hay clientes conectados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all duration-200 border border-slate-600/30">
              <div className="flex-1">
                <div className="font-medium text-white">{client.clientid}</div>
                <div className="text-sm text-slate-400 mt-1">
                  {client.ip_address}:{client.port}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  client.connected
                    ? 'bg-green-600/20 text-green-300 border border-green-600/30'
                    : 'bg-red-600/20 text-red-300 border border-red-600/30'
                }`}>
                  {client.connected ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
