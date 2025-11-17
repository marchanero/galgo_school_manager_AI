import React from 'react'
import { useEmqxContext } from '../contexts/EmqxContext'

export const NodesList = ({ fullView = false }) => {
  const { nodes, loading } = useEmqxContext()
  
  // Manejar null o no disponible
  if (!nodes) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            🖥️ Nodos del Cluster
          </h3>
        </div>
        <div className="text-center py-12">
          <div className="text-4xl mb-3\">🖥️</div>
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
            🖥️ Nodos del Cluster
          </h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                <div className="h-3 bg-slate-700 rounded w-1/2"></div>
              </div>
              <div className="h-6 bg-slate-700 rounded w-16"></div>
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
          🖥️ Nodos del Cluster
        </h3>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-600/20 text-purple-300 border border-purple-600/30">
          {nodes.length} nodos
        </span>
      </div>

      {nodes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🖥️</div>
          <p className="text-slate-400">No hay nodos disponibles</p>
        </div>
      ) : (
        <div className="space-y-3">
          {nodes.map((node, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all duration-200 border border-slate-600/30">
              <div className="flex-1">
                <div className="font-medium text-white">{node.node}</div>
                <div className="text-sm text-slate-400 mt-2 space-y-1">
                  <div>Versión: <span className="text-slate-300">{node.version}</span></div>
                  <div>Memoria: <span className="text-slate-300">{(node.memory_used / 1024 / 1024).toFixed(2)} MB</span></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  node.status === 'running'
                    ? 'bg-green-600/20 text-green-300 border border-green-600/30'
                    : 'bg-red-600/20 text-red-300 border border-red-600/30'
                }`}>
                  {node.status === 'running' ? '🟢 Activo' : '🔴 Inactivo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
