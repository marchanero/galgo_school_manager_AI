import React, { useState, useEffect, useRef } from 'react'
import { 
  Play, 
  Pause, 
  Maximize2, 
  Camera, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  Circle,
  Download,
  Settings,
  Volume2,
  VolumeX,
  Info,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2
} from 'lucide-react'
import './CameraViewer.css'

function CameraViewer({ camera }) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('conectando')
  const imgRef = useRef(null)
  const containerRef = useRef(null)
  const abortControllerRef = useRef(null)
  const connectionAttemptRef = useRef(0)

  useEffect(() => {
    if (!camera || !isPlaying) {
      console.log('🛑 Stream pausado o sin cámara')
      setConnectionStatus('pausado')
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      return
    }

    // Evitar múltiples conexiones simultáneas
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      console.log('⏳ Ya hay una conexión activa')
      return
    }

    console.log(`🎬 Conectando a stream MJPEG: ${camera.name}`)
    setConnectionStatus('conectando')
    connectionAttemptRef.current += 1
    const attemptNum = connectionAttemptRef.current

    // Crear nuevo controlador de aborto
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    // Fetch stream MJPEG
    const streamUrl = `/api/stream/${camera.id}/live`

    fetch(streamUrl, { signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        
        console.log('📡 Respuesta recibida, leyendo stream...')
        const reader = response.body.getReader()
        let buffer = new Uint8Array(0)
        let frameCount = 0
        let chunkCount = 0
        
        setConnectionStatus('streaming')

        const processChunk = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              chunkCount++
              
              if (done) {
                console.log(`📹 Stream cerrado. Chunks: ${chunkCount}, Frames: ${frameCount}`)
                setConnectionStatus('error')
                break
              }

              // Concatenar nuevos datos binarios
              const newBuffer = new Uint8Array(buffer.length + value.length)
              newBuffer.set(buffer)
              newBuffer.set(value, buffer.length)
              buffer = newBuffer

              // Log del buffer cada 5 chunks
              if (chunkCount === 1 || chunkCount % 10 === 0) {
                const preview = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 200))
                console.log(`📊 Chunk ${chunkCount}: buffer=${buffer.length} bytes, preview: ${preview.substring(0, 80)}...`)
              }

              // Buscar boundary "--BOUNDARY" (está en formato de string ASCII puro)
              const boundaryStr = '--BOUNDARY'
              const bufferStr = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
              const boundaryIndex = bufferStr.indexOf(boundaryStr)

              if (boundaryIndex >= 0) {
                // Encontramos el boundary
                console.log(`🎯 Boundary encontrado en índice ${boundaryIndex}`)
                
                // Tomar todo hasta el boundary como un frame
                const frameBytes = buffer.slice(0, boundaryIndex)
                buffer = buffer.slice(boundaryIndex)

                // Buscar \r\n\r\n (fin de headers)
                let headerEnd = -1
                for (let i = 0; i < frameBytes.length - 3; i++) {
                  if (frameBytes[i] === 0x0d && frameBytes[i+1] === 0x0a &&
                      frameBytes[i+2] === 0x0d && frameBytes[i+3] === 0x0a) {
                    headerEnd = i + 4
                    break
                  }
                }

                if (headerEnd > 0) {
                  // Extraer JPEG (todo después de los headers)
                  let jpegData = frameBytes.slice(headerEnd)
                  
                  // Remover \r\n final si existe
                  while (jpegData.length >= 2 && 
                         jpegData[jpegData.length-2] === 0x0d && 
                         jpegData[jpegData.length-1] === 0x0a) {
                    jpegData = jpegData.slice(0, jpegData.length - 2)
                  }

                  // Validar que sea JPEG válido (comienza con FF D8 FF)
                  if (jpegData.length > 100 && jpegData[0] === 0xFF && jpegData[1] === 0xD8) {
                    frameCount++
                    const blob = new Blob([jpegData], { type: 'image/jpeg' })
                    const url = URL.createObjectURL(blob)
                    
                    if (imgRef.current) {
                      imgRef.current.src = url
                      console.log(`✅ Frame ${frameCount}: ${jpegData.length} bytes (JPEG válido)`)
                    }
                  } else {
                    console.warn(`⚠️ Datos rechazados: ${jpegData.length} bytes, inicio: ${jpegData[0]?.toString(16)} ${jpegData[1]?.toString(16)}`)
                  }
                } else {
                  console.warn(`⚠️ No encontrado \\r\\n\\r\\n en frameBytes (${frameBytes.length} bytes)`)
                }
              }
            }
          } catch (error) {
            if (error.name !== 'AbortError') {
              console.error('❌ Error procesando stream:', error.message)
              setConnectionStatus('error')
            }
          }
        }

        processChunk()
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Error conectando:', error)
          setConnectionStatus('error')
        }
      })

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }

  }, [camera, isPlaying])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen()
    }
  }

  const handleSnapshot = () => {
    if (imgRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = imgRef.current.naturalWidth || imgRef.current.width
      canvas.height = imgRef.current.naturalHeight || imgRef.current.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(imgRef.current, 0, 0)
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `snapshot-${camera.name}-${new Date().getTime()}.png`
      link.click()
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'streaming':
        return 'bg-emerald-500'
      case 'conectando':
        return 'bg-amber-500'
      case 'pausado':
        return 'bg-gray-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'streaming':
        return <CheckCircle className="w-3.5 h-3.5" />
      case 'conectando':
        return <Loader2 className="w-3.5 h-3.5 animate-spin" />
      case 'pausado':
        return <Pause className="w-3.5 h-3.5" />
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5" />
      default:
        return <Circle className="w-3.5 h-3.5" />
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'streaming':
        return 'Transmitiendo'
      case 'conectando':
        return 'Conectando...'
      case 'pausado':
        return 'Pausado'
      case 'error':
        return 'Error'
      default:
        return 'Desconocido'
    }
  }

  return (
    <div className="camera-viewer-modern">
      {/* Header */}
      <div className="viewer-header-modern">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{camera.name}</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${getStatusColor()} text-white font-medium`}>
                {getStatusIcon()}
                {getStatusText()}
              </span>
              {connectionStatus === 'streaming' && (
                <span className="flex items-center gap-1">
                  <Circle className="w-2 h-2 text-red-500 fill-red-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            className={`control-btn-modern ${isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
            onClick={handlePlayPause}
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="hidden sm:inline">{isPlaying ? 'Pausar' : 'Reproducir'}</span>
          </button>
          
          <button 
            className="control-btn-modern bg-gray-600 hover:bg-gray-700" 
            onClick={handleFullscreen} 
            title="Pantalla completa"
          >
            <Maximize2 className="w-4 h-4" />
            <span className="hidden sm:inline">Fullscreen</span>
          </button>
          
          <button 
            className="control-btn-modern bg-blue-500 hover:bg-blue-600" 
            onClick={handleSnapshot}
            disabled={!imgRef.current}
            title="Captura"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Captura</span>
          </button>
        </div>
      </div>
      
      {/* Video Container */}
      <div className="video-container-modern" ref={containerRef}>
        {connectionStatus === 'conectando' && (
          <div className="stream-placeholder">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-gray-300 font-medium">Conectando al stream</p>
                <p className="text-sm text-gray-500">Por favor espere...</p>
              </div>
            </div>
          </div>
        )}
        
        {connectionStatus === 'error' && (
          <div className="stream-placeholder">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-gray-300 font-medium">Error de conexión</p>
                <p className="text-sm text-gray-500">Reintentando automáticamente...</p>
              </div>
              <button 
                onClick={handlePlayPause}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            </div>
          </div>
        )}

        {connectionStatus === 'pausado' && (
          <div className="stream-placeholder">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-2xl">
                <Pause className="w-10 h-10 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-gray-300 font-medium text-lg">Stream Pausado</p>
                <p className="text-sm text-gray-500">Haz clic para reanudar</p>
              </div>
              <button 
                onClick={handlePlayPause} 
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Iniciar Stream
              </button>
            </div>
          </div>
        )}

        {connectionStatus === 'streaming' && (
          <img 
            ref={imgRef}
            className="stream-image"
            alt="Stream MJPEG"
          />
        )}

        {/* Overlay */}
        <div className="stream-overlay-modern">
          <div className="flex items-center gap-2">
            <span className="live-badge-modern">
              <Circle className="w-2 h-2 fill-white animate-pulse" />
              LIVE
            </span>
            {connectionStatus === 'streaming' && (
              <span className="fps-badge">~1 fps</span>
            )}
          </div>
          <span className="camera-name-badge">{camera.name}</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="viewer-footer-modern">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="info-card">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
              <Settings className="w-3.5 h-3.5" />
              Modo
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">MJPEG Streaming</p>
          </div>
          
          <div className="info-card">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
              <Wifi className="w-3.5 h-3.5" />
              URL RTSP
            </div>
            <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{camera.rtspUrl}</p>
          </div>
          
          <div className="info-card">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
              <Circle className="w-3.5 h-3.5" />
              Estado
            </div>
            <p className={`text-sm font-medium ${camera.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {camera.isActive ? '● En línea' : '○ Offline'}
            </p>
          </div>
          
          <div className="info-card">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
              <Clock className="w-3.5 h-3.5" />
              Actualizado
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {new Date(camera.updatedAt).toLocaleString('es-ES', { 
                day: '2-digit', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
        </div>
        
        {camera.description && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-xs mb-1">
              <Info className="w-3.5 h-3.5" />
              Descripción
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-300">{camera.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default CameraViewer
