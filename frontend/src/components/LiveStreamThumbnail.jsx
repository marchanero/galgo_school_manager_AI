import React, { useState, useEffect, useRef, memo } from 'react'
import { Video, VideoOff, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'

/**
 * LiveStreamThumbnail - Componente de thumbnail con streaming en vivo
 * 
 * Usa WebSocket MJPEG para mostrar video en tiempo real en lugar de
 * polling de snapshots. Más fluido y con menor latencia.
 */
const LiveStreamThumbnail = memo(({ 
  camera, 
  isActive = true, 
  isRecording, 
  onClick, 
  selected,
  quality = 'low' // low, medium, high - usar low para thumbnails
}) => {
  const [status, setStatus] = useState('idle') // idle, connecting, streaming, error
  const [fps, setFps] = useState(0)
  
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const frameCountRef = useRef(0)
  const lastFpsUpdateRef = useRef(Date.now())
  const mountedRef = useRef(true)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  // Iniciar streaming
  const startStreaming = async () => {
    if (!camera?.id || !mountedRef.current) return
    
    try {
      setStatus('connecting')
      reconnectAttemptsRef.current++
      
      // Llamar API para iniciar stream
      const response = await fetch(`/api/webrtc/start/${camera.id}`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Error iniciando stream')
      }
      
      if (!mountedRef.current) return
      
      // Conectar WebSocket con calidad baja para thumbnails
      const wsUrl = data.wsUrl.replace('localhost', window.location.hostname) + `?quality=${quality}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      ws.binaryType = 'arraybuffer'
      
      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close()
          return
        }
        setStatus('streaming')
        reconnectAttemptsRef.current = 0 // Reset en conexión exitosa
      }
      
      ws.onmessage = async (event) => {
        if (!mountedRef.current) return
        
        if (typeof event.data === 'string') {
          // Mensaje de control
          const msg = JSON.parse(event.data)
          if (msg.type === 'stream_ended' || msg.type === 'stream_stopped') {
            setStatus('error')
          }
          return
        }
        
        // Frame JPEG
        const blob = new Blob([event.data], { type: 'image/jpeg' })
        
        try {
          const imageBitmap = await createImageBitmap(blob)
          
          const canvas = canvasRef.current
          if (canvas && mountedRef.current) {
            const ctx = canvas.getContext('2d')
            
            // Ajustar canvas si es necesario
            if (canvas.width !== imageBitmap.width || canvas.height !== imageBitmap.height) {
              canvas.width = imageBitmap.width
              canvas.height = imageBitmap.height
            }
            
            ctx.drawImage(imageBitmap, 0, 0)
            imageBitmap.close()
          }
          
          // Calcular FPS
          frameCountRef.current++
          const now = Date.now()
          const elapsed = now - lastFpsUpdateRef.current
          
          if (elapsed >= 1000) {
            setFps(Math.round((frameCountRef.current / elapsed) * 1000))
            frameCountRef.current = 0
            lastFpsUpdateRef.current = now
          }
        } catch (err) {
          console.warn('Error renderizando frame:', err)
        }
      }
      
      ws.onerror = () => {
        if (mountedRef.current) {
          setStatus('error')
        }
      }
      
      ws.onclose = () => {
        if (mountedRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          // Reconectar después de un delay
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              startStreaming()
            }
          }, 2000 * reconnectAttemptsRef.current) // Backoff exponencial
        }
      }
      
    } catch (err) {
      console.warn(`⚠️ Stream ${camera?.name}: ${err.message}`)
      if (mountedRef.current) {
        setStatus('error')
        
        // Reintentar si no hemos alcanzado el máximo
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              startStreaming()
            }
          }, 3000)
        }
      }
    }
  }

  // Detener streaming
  const stopStreaming = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }

  useEffect(() => {
    mountedRef.current = true
    
    if (camera?.id && isActive) {
      startStreaming()
    }
    
    return () => {
      mountedRef.current = false
      stopStreaming()
    }
  }, [camera?.id, isActive])

  return (
    <div
      onClick={onClick}
      className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer group transition-all hover:ring-2 hover:ring-blue-500 hover:shadow-lg ${
        selected ? 'ring-2 ring-blue-500 shadow-lg' : 'ring-1 ring-gray-200 dark:ring-gray-700'
      }`}
    >
      {/* Canvas para streaming */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover ${
          status === 'streaming' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ objectFit: 'cover' }}
      />
      
      {/* Placeholder cuando no hay streaming */}
      {status !== 'streaming' && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
          {status === 'connecting' ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="text-[10px] text-gray-400">Conectando stream...</span>
            </div>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center gap-1">
              <WifiOff className="w-6 h-6 text-gray-500" />
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
        {status === 'streaming' && (
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
      
      {/* FPS indicator */}
      {status === 'streaming' && fps > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <span className="px-1.5 py-0.5 bg-black/50 text-white text-[9px] font-mono rounded backdrop-blur-sm">
            {fps} FPS
          </span>
        </div>
      )}
      
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

LiveStreamThumbnail.displayName = 'LiveStreamThumbnail'

export default LiveStreamThumbnail
