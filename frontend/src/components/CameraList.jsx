import React from 'react'
import { Video, Trash2, Circle } from 'lucide-react'
import { EmptyStateCompact } from './ui/EmptyState'
import './CameraList.css'

function CameraList({ cameras, selectedCamera, onSelectCamera, onDeleteCamera }) {
  if (cameras.length === 0) {
    return <EmptyStateCompact message="No hay cámaras disponibles" icon={Video} />
  }

  return (
    <div className="camera-list">
      {cameras.map((camera, index) => (
        <div
          key={camera.id}
          className={`camera-item animate-fade-in ${selectedCamera?.id === camera.id ? 'active' : ''}`}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div 
            className="camera-content"
            onClick={() => onSelectCamera(camera)}
          >
            <div className="camera-name">{camera.name}</div>
            <div className="camera-url">{camera.rtspUrl}</div>
            <div className="camera-status">
              <Circle className={`w-2 h-2 ${camera.isActive ? 'text-emerald-500 fill-emerald-500' : 'text-red-500 fill-red-500'}`} />
              {camera.isActive ? 'En línea' : 'Offline'}
            </div>
          </div>
          <button
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteCamera(camera.id)
            }}
            title="Eliminar cámara"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export default CameraList
