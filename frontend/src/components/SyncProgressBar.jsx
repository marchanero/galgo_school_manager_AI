import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

export default function SyncProgressBar() {
    const [progress, setProgress] = useState(null)
    const [isReplicating, setIsReplicating] = useState(false)
    const [isComplete, setIsComplete] = useState(false)
    const [lastSync, setLastSync] = useState(null)

    useEffect(() => {
        // Conectar Socket.IO
        const socket = io() // Usa el proxy de Vite

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
                    // Solo actualizar si hay datos y no hemos recibido nada por socket aún
                    if (data.isReplicating && data.progress) {
                        setIsReplicating(true)
                        setProgress(data.progress)
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

    // Estado: Sincronizando activamente
    if (isReplicating && progress) {
        return (
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            Sincronizando a TrueNAS...
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-blue-600 dark:text-blue-400 font-mono">{progress.speed}</span>
                        <span className="text-gray-500 dark:text-gray-400">ETA: {progress.eta}</span>
                    </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out relative"
                        style={{ width: `${progress.percent}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{progress.transferred} / {progress.total}</span>
                    <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{progress.percent}%</span>
                </div>
            </div>
        )
    }

    // Estado: Completado recientemente
    if (isComplete) {
        return (
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        ¡Sincronización completada!
                    </span>
                </div>
            </div>
        )
    }

    // Estado: Inactivo (siempre visible)
    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-500"></div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Sincronización con TrueNAS
                    </span>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    {lastSync ? `Última: ${lastSync.toLocaleTimeString()}` : 'Esperando...'}
                </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-3">
                <div className="h-full rounded-full bg-gray-300 dark:bg-gray-500 w-0"></div>
            </div>
        </div>
    )
}

