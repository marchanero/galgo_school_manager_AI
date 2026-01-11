import React from 'react'
import { Video, Trash2, Circle } from 'lucide-react'
import './CameraList.css'

function CameraList({ cameras, selectedCamera, onSelectCamera, onDeleteCamera }) {
  return (
    <div className="camera-list">
      {cameras.length === 0 ? (
        <div className="empty flex flex-col items-center gap-2 py-8">
          <Video className="w-8 h-8 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400">No hay cámaras disponibles</p>
        </div>
      ) : (
        cameras.map(camera => (
          <div
            key={camera.id}
            className={`camera-item ${selectedCamera?.id === camera.id ? 'active' : ''}`}
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
        ))
      )}
    </div>
  )
}

export default CameraList
