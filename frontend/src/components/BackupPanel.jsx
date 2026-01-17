import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import SyncProgressBar from './SyncProgressBar'

export default function BackupPanel() {
  const [status, setStatus] = useState(null)
  const [config, setConfig] = useState(null)
  const [serverConfig, setServerConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [showServerConfig, setShowServerConfig] = useState(false)
  const [savingServer, setSavingServer] = useState(false)

  // Configuración editable de programación
  const [editConfig, setEditConfig] = useState({
    schedule: '0 3 * * *',
    enabled: false,
    retentionDays: 30,
    deleteAfterExport: false
  })

  // Configuración editable del servidor
  const [editServerConfig, setEditServerConfig] = useState({
    useMock: true,
    engine: 'rclone',
    host: '',
    port: 22,
    user: '',
    password: '',
    sshKeyPath: '',
    remotePath: '/mnt/backups/cameras',
    rcloneRemote: 'truenas',
    transfers: 4,
    retries: 10,
    verifyHash: true,
    remoteMaxUsePercent: 90
  })

  const fetchData = useCallback(async () => {
    try {
      const [statusData, configData, serverConfigData] = await Promise.all([
        api.getReplicationStatus(),
        api.getReplicationConfig(),
        api.getReplicationServerConfig()
      ])
      setStatus(statusData)
      setConfig(configData)
      setServerConfig(serverConfigData)
      setEditConfig({
        schedule: configData.schedule || '0 3 * * *',
        enabled: configData.enabled || false,
        retentionDays: configData.retentionDays || 30,
        deleteAfterExport: configData.deleteAfterExport || false
      })
      setEditServerConfig({
        useMock: serverConfigData.useMock !== undefined ? serverConfigData.useMock : true,
        engine: serverConfigData.engine || 'rclone',
        host: serverConfigData.host || '',
        port: serverConfigData.port || 22,
        user: serverConfigData.user || '',
        password: '', // No cargamos password por seguridad
        sshKeyPath: serverConfigData.sshKeyPath || '',
        remotePath: serverConfigData.remotePath || '/mnt/backups/cameras',
        rcloneRemote: serverConfigData.rcloneRemote || 'truenas',
        transfers: serverConfigData.transfers || 4,
        retries: serverConfigData.retries || 10,
        verifyHash: serverConfigData.verifyHash !== undefined ? serverConfigData.verifyHash : true,
        remoteMaxUsePercent: serverConfigData.remoteMaxUsePercent || 90
      })
    } catch (error) {
      console.error('Error fetching backup status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000) // Actualizar cada 15s
    return () => clearInterval(interval)
  }, [fetchData])

  const handleStartSync = async () => {
    setSyncing(true)
    try {
      await api.startReplication()
      // Refrescar estado después de un momento
      setTimeout(fetchData, 2000)
    } catch (error) {
      console.error('Error starting sync:', error)
    } finally {
      setSyncing(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.testReplicationConnection()
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, error: error.message })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveConfig = async () => {
    try {
      await api.saveReplicationConfig(editConfig)
      setShowConfig(false)
      fetchData()
    } catch (error) {
      console.error('Error saving config:', error)
    }
  }

  const handleSaveServerConfig = async () => {
    setSavingServer(true)
    try {
      await api.saveReplicationServerConfig(editServerConfig)
      setShowServerConfig(false)
      setTestResult(null)
      fetchData()
    } catch (error) {
      console.error('Error saving server config:', error)
    } finally {
      setSavingServer(false)
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Nunca'
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (percent) => {
    if (percent > 90) return 'red'
    if (percent > 75) return 'yellow'
    return 'green'
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${status?.remoteStatus === 'online'
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-red-100 dark:bg-red-900/30'
            }`}>
            <svg className={`w-6 h-6 ${status?.remoteStatus === 'online'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Sistema de Backup
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {status?.useMock ? 'Modo Simulación' : `Motor: ${status?.engine?.toUpperCase() || 'No configurado'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {testing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Probando...
              </span>
            ) : 'Probar Conexión'}
          </button>
          <button
            onClick={handleStartSync}
            disabled={syncing || status?.isReplicating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {syncing || status?.isReplicating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sincronizando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sincronizar Ahora
              </>
            )}
          </button>
        </div>
      </div>

      {/* Test Connection Result */}
      {testResult && (
        <div className={`p-4 rounded-lg ${testResult.success
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className={testResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
              {testResult.message}
            </span>
            {testResult.latencyMs && (
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                ({testResult.latencyMs}ms)
              </span>
            )}
            {testResult.isMock && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">Mock</span>
            )}
          </div>
        </div>
      )}

      {/* Configuration Panel */}
      {showConfig && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Configuración de Backup</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Programación (Cron)
              </label>
              <input
                type="text"
                value={editConfig.schedule}
                onChange={(e) => setEditConfig({ ...editConfig, schedule: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="0 3 * * *"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Por defecto: 0 3 * * * (cada día a las 3:00 AM)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Retención (días)
              </label>
              <input
                type="number"
                value={editConfig.retentionDays}
                onChange={(e) => setEditConfig({ ...editConfig, retentionDays: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                min="0"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                0 = sin límite de retención
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editConfig.enabled}
                onChange={(e) => setEditConfig({ ...editConfig, enabled: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Backup automático activado</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editConfig.deleteAfterExport}
                onChange={(e) => setEditConfig({ ...editConfig, deleteAfterExport: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Eliminar local después de exportar</span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Guardar Configuración
            </button>
          </div>

          {/* Botón para mostrar configuración del servidor */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
            <button
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <svg className={`w-4 h-4 transition-transform ${showServerConfig ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {showServerConfig ? 'Ocultar' : 'Mostrar'} configuración del servidor
            </button>
          </div>
        </div>
      )}

      {/* Server Configuration Panel */}
      {showServerConfig && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 space-y-4 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              Configuración del Servidor de Backup
            </h4>
            {serverConfig?.useMock && (
              <span className="px-2 py-1 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded">
                Modo Simulación Activo
              </span>
            )}
          </div>

          {/* Modo Mock Switch */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div>
              <label className="font-medium text-gray-900 dark:text-white">Modo Simulación</label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Activar para usar datos de prueba sin servidor real
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={editServerConfig.useMock}
                onChange={(e) => setEditServerConfig({ ...editServerConfig, useMock: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Configuración del servidor (solo visible si no es mock) */}
          {!editServerConfig.useMock && (
            <div className="space-y-4">
              {/* Motor de transferencia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motor de Transferencia
                </label>
                <select
                  value={editServerConfig.engine}
                  onChange={(e) => setEditServerConfig({ ...editServerConfig, engine: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="rclone">rclone (SFTP) - Recomendado</option>
                  <option value="rsync">rsync (SSH)</option>
                </select>
              </div>

              {/* Conexión al servidor */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Host del Servidor
                  </label>
                  <input
                    type="text"
                    value={editServerConfig.host}
                    onChange={(e) => setEditServerConfig({ ...editServerConfig, host: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="192.168.1.100 o truenas.local"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Puerto SSH
                  </label>
                  <input
                    type="number"
                    value={editServerConfig.port}
                    onChange={(e) => setEditServerConfig({ ...editServerConfig, port: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    min="1"
                    max="65535"
                  />
                </div>
              </div>

              {/* Credenciales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Usuario SSH
                  </label>
                  <input
                    type="text"
                    value={editServerConfig.user}
                    onChange={(e) => setEditServerConfig({ ...editServerConfig, user: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="root o admin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contraseña SSH
                    {serverConfig?.hasPassword && (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-400">(configurada)</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={editServerConfig.password}
                    onChange={(e) => setEditServerConfig({ ...editServerConfig, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder={serverConfig?.hasPassword ? '••••••••' : 'Contraseña'}
                  />
                </div>
              </div>

              {/* Ruta remota */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ruta Remota de Backups
                </label>
                <input
                  type="text"
                  value={editServerConfig.remotePath}
                  onChange={(e) => setEditServerConfig({ ...editServerConfig, remotePath: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="/mnt/pool/backups/cameras"
                />
              </div>

              {/* Opciones avanzadas */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Opciones Avanzadas</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Transfers Paralelos</label>
                    <input
                      type="number"
                      value={editServerConfig.transfers}
                      onChange={(e) => setEditServerConfig({ ...editServerConfig, transfers: parseInt(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      min="1"
                      max="16"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Reintentos</label>
                    <input
                      type="number"
                      value={editServerConfig.retries}
                      onChange={(e) => setEditServerConfig({ ...editServerConfig, retries: parseInt(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      min="1"
                      max="50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">% Máx. Disco</label>
                    <input
                      type="number"
                      value={editServerConfig.remoteMaxUsePercent}
                      onChange={(e) => setEditServerConfig({ ...editServerConfig, remoteMaxUsePercent: parseInt(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      min="50"
                      max="99"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editServerConfig.verifyHash}
                        onChange={(e) => setEditServerConfig({ ...editServerConfig, verifyHash: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300">Verificar Hash</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-2 pt-4 border-t border-indigo-200 dark:border-indigo-700">
            <button
              onClick={() => setShowServerConfig(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveServerConfig}
              disabled={savingServer}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {savingServer ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Guardando...
                </>
              ) : (
                'Guardar Servidor'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <SyncProgressBar status={status} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Local Storage */}
        <div className={`p-4 rounded-lg bg-${getStatusColor(status?.localDiskInfo?.usePercent || 0)}-50 dark:bg-${getStatusColor(status?.localDiskInfo?.usePercent || 0)}-900/20`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Almacenamiento Local</span>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {status?.localFiles || 0} videos
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {status?.localSizeFormatted || '0 B'}
          </div>
          {status?.localDiskInfo?.available && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all bg-${getStatusColor(status.localDiskInfo.usePercent)}-500`}
                  style={{ width: `${status.localDiskInfo.usePercent}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {status.localDiskInfo.availableGB}GB libres de {status.localDiskInfo.totalGB}GB
              </div>
            </div>
          )}
        </div>

        {/* Remote Storage */}
        <div className={`p-4 rounded-lg ${status?.remoteDiskInfo?.available
          ? `bg-${getStatusColor(status.remoteDiskInfo.usePercent)}-50 dark:bg-${getStatusColor(status.remoteDiskInfo.usePercent)}-900/20`
          : 'bg-gray-50 dark:bg-gray-700/50'
          }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Servidor Remoto</span>
            <div className={`w-2 h-2 rounded-full ${status?.remoteStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
          </div>
          {status?.remoteDiskInfo?.available ? (
            <>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {status.remoteDiskInfo.availableGB}GB
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                disponibles
                {status.remoteDiskInfo.isMock && (
                  <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded">Demo</span>
                )}
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${status.remoteDiskInfo.usePercent > 90 ? 'bg-red-500' :
                      status.remoteDiskInfo.usePercent > 75 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                    style={{ width: `${status.remoteDiskInfo.usePercent}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {status.remoteDiskInfo.usePercent}% usado ({status.remoteDiskInfo.totalGB}GB total)
                </div>
              </div>
            </>
          ) : (
            <div className="text-gray-500 dark:text-gray-400">
              <div className="text-lg font-medium">No disponible</div>
              <div className="text-sm">{status?.remoteDiskInfo?.error || 'Sin configurar'}</div>
            </div>
          )}
        </div>

        {/* Pending Files */}
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Pendientes</span>
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {status?.pendingFiles >= 0 ? status.pendingFiles : '—'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            archivos por sincronizar
          </div>
        </div>

        {/* Last Sync */}
        <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Última Sync</span>
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {formatDate(status?.lastSyncTime)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {status?.enabled ? `Programado: ${status.schedule}` : 'Automático desactivado'}
          </div>
        </div>
      </div>

      {/* Transfer Configuration Info */}
      {status?.transferConfig && (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
            Configuración de Transferencia
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Motor:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {status.transferConfig.engine?.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Paralelos:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {status.transferConfig.transfers}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Reintentos:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {status.transferConfig.retries}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Verificar Hash:</span>
              <span className={`ml-2 font-medium ${status.transferConfig.verifyHash
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500'
                }`}>
                {status.transferConfig.verifyHash ? 'Sí' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Servidor:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {status.remoteHost || 'No configurado'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Ruta:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white truncate">
                {status.remotePath || '/'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Replication History (Mock only) */}
      {status?.remoteDiskInfo?.replicationHistory?.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
            Historial de Replicaciones Recientes
          </h4>
          <div className="space-y-2">
            {status.remoteDiskInfo.replicationHistory.map((entry, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${entry.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {formatDate(entry.date)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>{entry.sizeGB} GB transferidos</span>
                  <span>{Math.floor(entry.duration / 60)}m {entry.duration % 60}s</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
