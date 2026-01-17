import { useState, useEffect } from 'react'

export default function SyncProgressBar() {
    const [progress, setProgress] = useState(null)
    const [isReplicating, setIsReplicating] = useState(false)
    const [isComplete, setIsComplete] = useState(false)

    useEffect(() => {
        // Polling para obtener progreso
        const fetchProgress = async () => {
            try {
                const response = await fetch('/api/replication/progress')
                if (response.ok) {
                    const data = await response.json()
                    setIsReplicating(data.isReplicating)

                    if (data.progress) {
                        setProgress(data.progress)
                        setIsComplete(false)
                    } else if (!data.isReplicating && progress) {
                        // Acabó la replicación
                        setIsComplete(true)
                        setTimeout(() => {
                            setProgress(null)
                            setIsComplete(false)
                        }, 3000)
                    }
                }
            } catch (error) {
                console.error('Error fetching progress:', error)
            }
        }

        // Polling cada segundo cuando hay replicación activa
        fetchProgress()
        const interval = setInterval(fetchProgress, 1000)

        return () => clearInterval(interval)
    }, [progress])

    if (!progress && !isComplete && !isReplicating) return null

    return (
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {!isComplete ? (
                        <>
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                            </span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                Sincronizando a TrueNAS...
                            </span>
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                ¡Sincronización completada!
                            </span>
                        </>
                    )}
                </div>

                {progress && !isComplete && (
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-blue-600 dark:text-blue-400 font-mono">
                            {progress.speed}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                            ETA: {progress.eta}
                        </span>
                    </div>
                )}
            </div>

            {progress && !isComplete && (
                <>
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
                </>
            )}
        </div>
    )
}
