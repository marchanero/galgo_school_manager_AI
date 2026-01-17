import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

export default function SyncProgressBar({ status }) {
    const [progress, setProgress] = useState(null)
    const [isReplicating, setIsReplicating] = useState(false)
    const [isComplete, setIsComplete] = useState(false)
    const [lastSync, setLastSync] = useState(null)

    useEffect(() => {
        // Conectar Socket.IO
        const socket = io({
            path: '/socket.io',
            transports: ['websocket', 'polling']
        })

        socket.on('connect', () => {
            console.log('🔌 Socket.IO conectado para replicación')
        })

        socket.on('replication:progress', (data) => {
            setIsReplicating(true)
            setProgress(data)
            setIsComplete(false)
        })

        socket.on('replication:complete', (data) => {
            setIsReplicating(false)
            setProgress(null)
            setIsComplete(data.success)
            if (data.success) {
                setLastSync(new Date())
                setTimeout(() => setIsComplete(false), 5000)
            }
        })

        // Fetch inicial para estado actual (por si ya estaba corriendo)
        const fetchInitialState = async () => {
            try {
                const response = await fetch('/api/replication/progress')
                if (response.ok) {
                    const data = await response.json()
                    // Si la API dice que está replicando, forzamos el estado activo
                    if (data.isReplicating) {
                        setIsReplicating(true)
                        if (data.progress) {
                            setProgress(data.progress)
                        } else {
                            // Si no hay progreso detallado aún, mostrar estado de carga
                            setProgress({ percent: 0, speed: 'Calculando...', eta: '...', transferred: '0 B', total: '...' })
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching initial state:', error)
            }
        }
        fetchInitialState()

        return () => {
            socket.disconnect()
        }
    }, [])

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Nunca'
        return new Date(dateStr).toLocaleString('es-ES', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        })
    }

    // Estado: Sincronizando activamente
    if (isReplicating && progress) {
        return (
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                        <div>
                            <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
                                Sincronizando a TrueNAS
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {progress.speed} • ETA: {progress.eta}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{progress.percent}%</div>
                    </div>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out relative"
                        style={{ width: `${progress.percent}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
                    <span>{progress.transferred}</span>
                    <span>Total: {progress.total}</span>
                </div>
            </div>
        )
    }

    // Estado: Completado recientemente
    if (isComplete) {
        return (
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-4 border border-green-200 dark:border-green-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <span className="block text-sm font-medium text-green-700 dark:text-green-300">
                            ¡Sincronización completada!
                        </span>
                        <span className="text-xs text-green-600 dark:text-green-400">
                            Todos los archivos actualizados
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    // Estado: Inactivo con estadísticas (Usando props status)
    const lastSyncEntry = status?.remoteDiskInfo?.replicationHistory?.[0]
    const lastSyncDate = lastSync || (status?.lastSyncTime ? new Date(status.lastSyncTime) : null)

    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            Estado de Sincronización
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {lastSyncDate ? `Última: ${formatDate(lastSyncDate)}` : 'Sin sincronizaciones recientes'}
                        </p>
                    </div>
                </div>

                {/* Mini Stats del último sync si existe */}
                {lastSyncEntry && (
                    <div className="flex items-center gap-4 text-xs">
                        <div className="text-right">
                            <span className="block text-gray-900 dark:text-gray-200 font-medium">{lastSyncEntry.sizeGB} GB</span>
                            <span className="text-gray-500 dark:text-gray-400">Transferidos</span>
                        </div>
                        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                        <div className="text-right">
                            <span className="block text-gray-900 dark:text-gray-200 font-medium">
                                {Math.floor(lastSyncEntry.duration / 60)}m {lastSyncEntry.duration % 60}s
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">Duración</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Barra de progreso inactiva (visual) */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-4">
                <div className="h-full rounded-full bg-gray-300 dark:bg-gray-600 w-0"></div>
            </div>
        </div>
    )
}

