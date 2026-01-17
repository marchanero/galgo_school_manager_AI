import React, { useState } from 'react'
import { Play, Square } from 'lucide-react'
import { formatTime } from '../../utils/formatters'
import ConfirmModal from '../ConfirmModal'
import { toast } from 'react-hot-toast'

/**
 * RecordingControl - Main recording control component
 * 
 * Features:
 * - Large start/stop button
 * - Recording status display
 * - Stop confirmation modal
 * - Elapsed time display
 */
const RecordingControl = ({
    cameras = [],
    recordingState = 'idle',
    activeRecordingsCount = 0,
    onStart,
    onStop,
    elapsedTime = 0
}) => {
    const [showStopConfirm, setShowStopConfirm] = useState(false)

    const handleStopClick = () => {
        setShowStopConfirm(true)
    }

    const handleConfirmStop = async () => {
        await onStop()
        setShowStopConfirm(false)
        toast.success('Grabación detenida correctamente')
    }

    const isRecording = recordingState === 'recording'

    return (
        <>
            <div className={`rounded-xl shadow-sm border overflow-hidden transition-all ${isRecording
                    ? 'bg-gradient-to-r from-red-500 to-red-600 border-red-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                <div className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={isRecording ? handleStopClick : onStart}
                                disabled={cameras.length === 0}
                                className={`flex items-center justify-center w-14 h-14 rounded-full transition-all transform hover:scale-105 active:scale-95 ${isRecording
                                        ? 'bg-white/20 hover:bg-white/30 text-white'
                                        : 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isRecording ? (
                                    <Square className="w-6 h-6 fill-current" />
                                ) : (
                                    <Play className="w-6 h-6 fill-current ml-1" />
                                )}
                            </button>

                            <div>
                                <h3 className={`text-lg font-bold ${isRecording ? 'text-white' : 'text-gray-900 dark:text-white'
                                    }`}>
                                    {isRecording ? 'Grabando...' : 'Iniciar Grabación'}
                                </h3>
                                <p className={`text-sm ${isRecording ? 'text-red-100' : 'text-gray-500 dark:text-gray-400'
                                    }`}>
                                    {isRecording
                                        ? `${activeRecordingsCount} cámara${activeRecordingsCount !== 1 ? 's' : ''} + sensores`
                                        : `${cameras.length} cámara${cameras.length !== 1 ? 's' : ''} disponible${cameras.length !== 1 ? 's' : ''}`
                                    }
                                </p>
                            </div>
                        </div>

                        {isRecording && (
                            <div className="text-right">
                                <div className="text-3xl font-mono font-bold text-white">
                                    {formatTime(elapsedTime)}
                                </div>
                                <div className="text-xs text-red-100">
                                    Duración
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={showStopConfirm}
                onClose={() => setShowStopConfirm(false)}
                onConfirm={handleConfirmStop}
                title="Detener Grabación"
                message="¿Estás seguro de que quieres detener todas las grabaciones en curso?"
                confirmText="Detener"
                confirmButtonClass="bg-red-500 hover:bg-red-600"
            />
        </>
    )
}

export default RecordingControl
