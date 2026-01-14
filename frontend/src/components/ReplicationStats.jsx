import { useState, useEffect } from 'react'
import api from '../services/api'

export default function ReplicationStats() {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    lastSyncTime: null,
    isReplicating: false,
    localDiskInfo: null,
    remoteDiskInfo: null
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

  const fetchRemoteDiskInfo = async () => {
    try {
      // Usar la nueva función que devuelve dummy data
      const response = await fetch('/api/replication/remote-disk-info')
      if (response.ok) {
        const data = await response.json()
        setStats(prev => ({ ...prev, remoteDiskInfo: data }))
      }
    } catch (error) {
      console.error('Error fetching remote disk info:', error)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchRemoteDiskInfo()
    const interval = setInterval(() => {
      fetchStats()
      fetchRemoteDiskInfo()
    }, 10000) // Actualizar cada 10s
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

        {/* Información del Disco Local */}
        <div className={`p-4 rounded-lg transition-all duration-300 ${
          stats.localDiskInfo?.usePercent > 90 
            ? 'bg-red-50 dark:bg-red-900/20' 
            : stats.localDiskInfo?.usePercent > 75 
            ? 'bg-yellow-50 dark:bg-yellow-900/20'
            : 'bg-orange-50 dark:bg-orange-900/20'
        }`}>
          <div className={`text-sm font-medium ${
            stats.localDiskInfo?.usePercent > 90 
              ? 'text-red-600 dark:text-red-400' 
              : stats.localDiskInfo?.usePercent > 75 
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-orange-600 dark:text-orange-400'
          }`}>Disco Local</div>
          {stats.localDiskInfo?.available ? (
            <div className="mt-1">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats.localDiskInfo.availableGB}GB / {stats.localDiskInfo.totalGB}GB
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stats.localDiskInfo.usePercent > 90 ? 'bg-red-500' :
                    stats.localDiskInfo.usePercent > 75 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${stats.localDiskInfo.usePercent}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stats.localDiskInfo.usePercent}% usado • {stats.localDiskInfo.recordingsCount} archivos
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {stats.localDiskInfo?.error || 'No disponible'}
            </div>
          )}
        </div>

        {/* Información del Disco Remoto */}
        <div className={`p-4 rounded-lg transition-all duration-300 ${
          stats.remoteDiskInfo?.usePercent > 90 
            ? 'bg-red-50 dark:bg-red-900/20' 
            : stats.remoteDiskInfo?.usePercent > 75 
            ? 'bg-amber-50 dark:bg-amber-900/20'
            : 'bg-indigo-50 dark:bg-indigo-900/20'
        }`}>
          <div className={`text-sm font-medium ${
            stats.remoteDiskInfo?.usePercent > 90 
              ? 'text-red-600 dark:text-red-400' 
              : stats.remoteDiskInfo?.usePercent > 75 
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-indigo-600 dark:text-indigo-400'
          }`}>Disco Remoto</div>
          {stats.remoteDiskInfo?.available ? (
            <div className="mt-1">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats.remoteDiskInfo.availableGB}GB / {stats.remoteDiskInfo.totalGB}GB
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stats.remoteDiskInfo.usePercent > 90 ? 'bg-red-500' :
                    stats.remoteDiskInfo.usePercent > 75 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${stats.remoteDiskInfo.usePercent}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                {stats.remoteDiskInfo.usePercent}% usado
                {stats.remoteDiskInfo.isDummy && (
                  <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-xs rounded">Demo</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {stats.remoteDiskInfo?.error || 'No configurado'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
