import React, { useState, useEffect, useRef, memo } from 'react'
import { Video, VideoOff, AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Componente de thumbnail para mostrar snapshot de cámara
 * Usa polling de snapshots para mostrar imagen actualizada
 */
const CameraThumbnail = memo(({ camera, isActive = true, isRecording, onClick, selected }) => {
  const [status, setStatus] = useState('idle') // idle, loading, loaded, error
  const [imageSrc, setImageSrc] = useState(null)
  const intervalRef = useRef(null)
  const mountedRef = useRef(true)
  const prevImageRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    
    if (!camera?.id) {
      setStatus('idle')
      return
    }

    const loadSnapshot = async () => {
      try {
        // Añadir timestamp para evitar cache
        const url = `/api/stream/${camera.id}/snapshot?t=${Date.now()}`
        
        // Verificar que la imagen carga correctamente
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const blob = await response.blob()
        
        if (!mountedRef.current) return
        
        if (blob.size > 100) {
          const objectUrl = URL.createObjectURL(blob)
          
          // Limpiar URL anterior
          if (prevImageRef.current && prevImageRef.current.startsWith('blob:')) {
            URL.revokeObjectURL(prevImageRef.current)
          }
          
          prevImageRef.current = objectUrl
          setImageSrc(objectUrl)
          setStatus('loaded')
        } else {
          throw new Error('Imagen vacía')
        }
      } catch (err) {
        if (mountedRef.current) {
          console.warn(`⚠️ Snapshot ${camera.name}: ${err.message}`)
          setStatus(prev => prev === 'loaded' ? 'loaded' : 'error') // Mantener loaded si ya teníamos imagen
        }
      }
    }

    // Cargar primera imagen inmediatamente
    setStatus('loading')
    loadSnapshot()

    // Actualizar cada 2 segundos
    intervalRef.current = setInterval(loadSnapshot, 2000)

    return () => {
      mountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      // Limpiar blob URL
      if (prevImageRef.current && prevImageRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(prevImageRef.current)
      }
    }
  }, [camera?.id, camera?.name])

  return (
    <div
      onClick={onClick}
      className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer group transition-all hover:ring-2 hover:ring-blue-500 hover:shadow-lg ${
        selected ? 'ring-2 ring-blue-500 shadow-lg' : 'ring-1 ring-gray-200 dark:ring-gray-700'
      }`}
    >
      {/* Imagen del snapshot */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={camera?.name || 'Camera'}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      
      {/* Placeholder cuando no hay imagen */}
      {!imageSrc && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
          {status === 'loading' ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="text-[10px] text-gray-400">Conectando...</span>
            </div>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center gap-1">
              <AlertCircle className="w-6 h-6 text-gray-500" />
              <span className="text-[10px] text-gray-500">Sin señal</span>
            </div>
          ) : (
            <Video className="w-8 h-8 text-gray-600" />
          )}
        </div>
      )}
      
      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
      
      {/* Status badges */}
      <div className="absolute top-2 left-2 flex gap-1 z-10">
        {imageSrc && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/90 text-white text-[10px] font-medium rounded backdrop-blur-sm">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
            LIVE
          </span>
        )}
        {isRecording && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/90 text-white text-[10px] font-medium rounded backdrop-blur-sm">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
            REC
          </span>
        )}
      </div>
      
      {/* Camera name */}
      <div className="absolute bottom-0 left-0 right-0 p-2 z-10">
        <p className="text-white text-xs font-medium truncate drop-shadow-lg">
          {camera?.name || 'Cámara'}
        </p>
      </div>
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
        <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
          <Video className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
})

CameraThumbnail.displayName = 'CameraThumbnail'

export default CameraThumbnail
