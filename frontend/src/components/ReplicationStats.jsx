import { useState, useEffect } from 'react'
import api from '../services/api'

export default function ReplicationStats() {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    lastSyncTime: null,
    isReplicating: false
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const data = await api.getReplicationStats()
      setStats(data)
    } catch (error) {
      console.error('Error fetching replication stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000) // Actualizar cada 10s
    return () => clearInterval(interval)
  }, [])

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) return <div className="animate-pulse h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Estado de Replicación
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Videos Locales</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {stats.totalFiles}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatBytes(stats.totalSize)}
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="text-sm text-green-600 dark:text-green-400 font-medium">Estado</div>
          <div className="flex items-center mt-1">
            {stats.isReplicating ? (
              <>
                <span className="relative flex h-3 w-3 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">Sincronizando...</span>
              </>
            ) : (
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Inactivo</span>
            )}
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Última Sincronización</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
            {stats.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleString() : 'Nunca'}
          </div>
        </div>
      </div>
    </div>
  )
}
