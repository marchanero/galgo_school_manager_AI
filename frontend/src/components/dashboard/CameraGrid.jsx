import React, { useState } from 'react'
import { Video, Image, Tv, Maximize2 } from 'lucide-react'
import CameraThumbnail from '../CameraThumbnail'
import LiveStreamThumbnail from '../LiveStreamThumbnail'

/**
 * CameraGrid - Camera thumbnails/live streams grid
 * 
 * Features:
 * - Toggle between thumbnail and live view modes
 * - Grid of camera previews (max 4 shown)
 * - Camera selection
 * - Status and recording indicators
 */
const CameraGrid = ({
    cameras = [],
    cameraStatus = new Map(),
    recordings = new Map(),
    selectedCameraId,
    onCameraSelect,
    stats = { activeCameras: 0, totalCameras: 0 }
}) => {
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem('dashboardViewMode') || 'thumbnail'
    })

    const handleViewModeChange = (mode) => {
        setViewMode(mode)
        localStorage.setItem('dashboardViewMode', mode)
    }

    const ThumbnailComponent = viewMode === 'live' ? LiveStreamThumbnail : CameraThumbnail

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Video className="w-4 h-4 text-blue-500" />
                    Cámaras en Vivo
                </h3>
                <div className="flex items-center gap-2">
                    {/* Toggle Thumbnail/Live */}
                    <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                        <button
                            onClick={() => handleViewModeChange('thumbnail')}
                            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${viewMode === 'thumbnail'
                                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            title="Vista de snapshots (menos recursos)"
                        >
                            <Image className="w-3 h-3" />
                            <span className="hidden sm:inline">Snapshots</span>
                        </button>
                        <button
                            onClick={() => handleViewModeChange('live')}
                            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${viewMode === 'live'
                                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            title="Streaming en vivo (más fluido)"
                        >
                            <Tv className="w-3 h-3" />
                            <span className="hidden sm:inline">Live</span>
                        </button>
                    </div>

                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {stats.activeCameras}/{stats.totalCameras} activas
                    </span>
                    <button
                        onClick={() => window.location.hash = '#camaras'}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Ver todas las cámaras"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="p-4">
                {cameras.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Video className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No hay cámaras configuradas</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {cameras.slice(0, 4).map((camera) => {
                            const status = cameraStatus.get(camera.id) || { active: false }
                            const isRecordingCamera = recordings.has(camera.id)

                            return (
                                <ThumbnailComponent
                                    key={camera.id}
                                    camera={camera}
                                    isActive={status.active}
                                    isRecording={isRecordingCamera}
                                    selected={selectedCameraId === camera.id}
                                    onClick={() => onCameraSelect(camera.id)}
                                    quality="low"
                                />
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default CameraGrid
