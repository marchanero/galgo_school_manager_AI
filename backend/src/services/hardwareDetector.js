import { spawn, execSync } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'

/**
 * HardwareDetector - Detección de capacidades de hardware para encoding
 * 
 * Soporta:
 * - NVIDIA NVENC (GPU NVIDIA)
 * - Intel VAAPI (GPU Intel integrada)
 * - AMD AMF (GPU AMD)
 * - Raspberry Pi OMX (VideoCore)
 * - CPU fallback (libx264)
 */
class HardwareDetector extends EventEmitter {
  constructor() {
    super()
    
    this.capabilities = {
      detected: false,
      cpu: null,
      gpu: null,
      encoders: [],
      decoders: [],
      recommended: null,
      systemInfo: {}
    }
    
    this.encoderPriority = [
      'h264_nvenc',      // NVIDIA (mejor rendimiento)
      'h264_vaapi',      // Intel/AMD VAAPI
      'h264_amf',        // AMD
      'h264_qsv',        // Intel QuickSync
      'h264_v4l2m2m',    // Raspberry Pi / ARM
      'h264_omx',        // Raspberry Pi legacy
      'libx264'          // CPU fallback
    ]
    
    this.profiles = {
      // Perfil de alta calidad (para archivo)
      high: {
        nvenc: { preset: 'p7', rc: 'vbr', cq: 19 },
        vaapi: { qp: 20 },
        qsv: { preset: 'veryslow', global_quality: 20 },
        libx264: { preset: 'slow', crf: 18 }
      },
      // Perfil balanceado (default)
      balanced: {
        nvenc: { preset: 'p4', rc: 'vbr', cq: 23 },
        vaapi: { qp: 26 },
        qsv: { preset: 'medium', global_quality: 25 },
        libx264: { preset: 'medium', crf: 23 }
      },
      // Perfil de rendimiento (para streaming en vivo)
      performance: {
        nvenc: { preset: 'p1', rc: 'cbr', b: '4M' },
        vaapi: { qp: 30 },
        qsv: { preset: 'veryfast', global_quality: 30 },
        libx264: { preset: 'ultrafast', crf: 28 }
      },
      // Perfil de baja latencia (para tiempo real)
      lowlatency: {
        nvenc: { preset: 'p1', rc: 'cbr', b: '2M', 'tune': 'ull' },
        vaapi: { qp: 32 },
        qsv: { preset: 'veryfast', global_quality: 32 },
        libx264: { preset: 'ultrafast', tune: 'zerolatency', crf: 30 }
      }
    }
  }

  /**
   * Detecta todas las capacidades de hardware
   */
  async detect() {
    console.log('🔍 Detectando capacidades de hardware...')
    
    try {
      // Info del sistema
      this.capabilities.systemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      }
      
      this.capabilities.cpu = this.capabilities.systemInfo.cpuModel
      
      // Detectar GPU
      await this.detectGPU()
      
      // Detectar encoders disponibles en FFmpeg
      await this.detectFFmpegEncoders()
      
      // Determinar encoder recomendado
      this.capabilities.recommended = this.getRecommendedEncoder()
      
      this.capabilities.detected = true
      
      console.log('✅ Detección de hardware completada')
      console.log(`   CPU: ${this.capabilities.cpu}`)
      console.log(`   GPU: ${this.capabilities.gpu || 'No detectada'}`)
      console.log(`   Encoder recomendado: ${this.capabilities.recommended}`)
      
      this.emit('detected', this.capabilities)
      
      return this.capabilities
      
    } catch (error) {
      console.error('❌ Error detectando hardware:', error.message)
      this.capabilities.detected = true
      this.capabilities.recommended = 'libx264'
      return this.capabilities
    }
  }

  /**
   * Detecta GPU disponible
   */
  async detectGPU() {
    // Intentar detectar NVIDIA
    try {
      const nvidiaSmi = execSync('nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000
      }).trim()
      
      if (nvidiaSmi) {
        this.capabilities.gpu = `NVIDIA ${nvidiaSmi}`
        return
      }
    } catch (e) {
      // No hay NVIDIA
    }
    
    // Intentar detectar Intel
    try {
      const vainfo = execSync('vainfo 2>/dev/null | head -5', {
        encoding: 'utf-8',
        timeout: 5000
      })
      
      if (vainfo.includes('VA-API')) {
        const driverMatch = vainfo.match(/Driver version:\s*(.+)/i)
        this.capabilities.gpu = `Intel VAAPI ${driverMatch ? driverMatch[1] : ''}`
        return
      }
    } catch (e) {
      // No hay VAAPI
    }
    
    // Intentar detectar AMD
    try {
      const amdgpu = execSync('lspci 2>/dev/null | grep -i amd | grep -i vga', {
        encoding: 'utf-8',
        timeout: 5000
      }).trim()
      
      if (amdgpu) {
        this.capabilities.gpu = `AMD ${amdgpu.split(':').pop()?.trim() || 'GPU'}`
        return
      }
    } catch (e) {
      // No hay AMD
    }
    
    // Verificar Raspberry Pi
    try {
      const vcgencmd = execSync('vcgencmd version 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000
      })
      
      if (vcgencmd) {
        this.capabilities.gpu = 'Raspberry Pi VideoCore'
        return
      }
    } catch (e) {
      // No es Raspberry Pi
    }
  }

  /**
   * Detecta encoders disponibles en FFmpeg
   */
  async detectFFmpegEncoders() {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-encoders'])
      let output = ''
      
      ffmpeg.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      ffmpeg.stderr.on('data', (data) => {
        output += data.toString()
      })
      
      ffmpeg.on('close', () => {
        // Buscar encoders H.264
        for (const encoder of this.encoderPriority) {
          if (output.includes(encoder)) {
            this.capabilities.encoders.push(encoder)
          }
        }
        
        // Buscar decoders
        const decoders = ['h264_cuvid', 'h264_qsv', 'h264_v4l2m2m', 'h264']
        for (const decoder of decoders) {
          if (output.includes(decoder)) {
            this.capabilities.decoders.push(decoder)
          }
        }
        
        resolve()
      })
      
      ffmpeg.on('error', () => {
        // FFmpeg no disponible, usar defaults
        this.capabilities.encoders = ['libx264']
        resolve()
      })
    })
  }

  /**
   * Obtiene el encoder recomendado basado en hardware
   */
  getRecommendedEncoder() {
    for (const encoder of this.encoderPriority) {
      if (this.capabilities.encoders.includes(encoder)) {
        return encoder
      }
    }
    return 'libx264'
  }

  /**
   * Genera argumentos FFmpeg optimizados para un encoder
   */
  getEncoderArgs(encoder, profile = 'balanced') {
    const profileConfig = this.profiles[profile] || this.profiles.balanced
    const args = []
    
    switch (encoder) {
      case 'h264_nvenc':
        args.push('-c:v', 'h264_nvenc')
        const nvencConf = profileConfig.nvenc
        args.push('-preset', nvencConf.preset)
        args.push('-rc', nvencConf.rc)
        if (nvencConf.cq) args.push('-cq', nvencConf.cq.toString())
        if (nvencConf.b) args.push('-b:v', nvencConf.b)
        if (nvencConf.tune) args.push('-tune', nvencConf.tune)
        args.push('-gpu', '0')
        break
        
      case 'h264_vaapi':
        args.push('-vaapi_device', '/dev/dri/renderD128')
        args.push('-c:v', 'h264_vaapi')
        args.push('-vf', 'format=nv12,hwupload')
        args.push('-qp', profileConfig.vaapi.qp.toString())
        break
        
      case 'h264_qsv':
        args.push('-c:v', 'h264_qsv')
        args.push('-preset', profileConfig.qsv.preset)
        args.push('-global_quality', profileConfig.qsv.global_quality.toString())
        break
        
      case 'h264_v4l2m2m':
        args.push('-c:v', 'h264_v4l2m2m')
        args.push('-b:v', '4M')
        break
        
      case 'h264_omx':
        args.push('-c:v', 'h264_omx')
        args.push('-b:v', '4M')
        break
        
      case 'libx264':
      default:
        args.push('-c:v', 'libx264')
        const x264Conf = profileConfig.libx264
        args.push('-preset', x264Conf.preset)
        args.push('-crf', x264Conf.crf.toString())
        if (x264Conf.tune) args.push('-tune', x264Conf.tune)
        break
    }
    
    return args
  }

  /**
   * Genera argumentos FFmpeg completos para grabación
   */
  getRecordingArgs(options = {}) {
    const {
      encoder = this.capabilities.recommended || 'libx264',
      profile = 'balanced',
      inputUrl,
      outputPath,
      segmentTime = 3600,
      audioCodec = 'aac',
      audioBitrate = '128k'
    } = options
    
    const args = [
      // Input
      '-rtsp_transport', 'tcp',
      '-stimeout', '5000000',
      '-i', inputUrl,
      
      // Video encoder
      ...this.getEncoderArgs(encoder, profile),
      
      // Audio
      '-c:a', audioCodec,
      '-b:a', audioBitrate,
      
      // Segmentación
      '-f', 'segment',
      '-segment_time', segmentTime.toString(),
      '-segment_format', 'mp4',
      '-segment_format_options', 'movflags=+faststart',
      '-reset_timestamps', '1',
      '-strftime', '1',
      
      // Robustez
      '-avoid_negative_ts', 'make_zero',
      '-max_muxing_queue_size', '9999',
      
      outputPath
    ]
    
    return args
  }

  /**
   * Genera argumentos FFmpeg para streaming de baja latencia
   */
  getStreamingArgs(options = {}) {
    const {
      encoder = this.capabilities.recommended || 'libx264',
      inputUrl,
      format = 'mpjpeg',  // mjpeg, hls, rtsp
      fps = 15,
      scale = null
    } = options
    
    const args = [
      // Input
      '-rtsp_transport', 'tcp',
      '-i', inputUrl,
      
      // Filtros
      '-vf', scale ? `fps=${fps},scale=${scale}` : `fps=${fps}`,
    ]
    
    if (format === 'mpjpeg') {
      args.push(
        '-c:v', 'mjpeg',
        '-q:v', '5',
        '-f', 'mpjpeg',
        '-'
      )
    } else if (format === 'hls') {
      args.push(
        ...this.getEncoderArgs(encoder, 'lowlatency'),
        '-f', 'hls',
        '-hls_time', '2',
        '-hls_list_size', '3',
        '-hls_flags', 'delete_segments+append_list'
      )
    }
    
    return args
  }

  /**
   * Benchmark de encoder
   */
  async benchmarkEncoder(encoder, duration = 5) {
    console.log(`⏱️ Benchmarking ${encoder}...`)
    
    return new Promise((resolve) => {
      const startTime = Date.now()
      let framesEncoded = 0
      
      // Generar video de prueba
      const args = [
        '-f', 'lavfi',
        '-i', `testsrc=duration=${duration}:size=1920x1080:rate=30`,
        ...this.getEncoderArgs(encoder, 'performance'),
        '-f', 'null',
        '-'
      ]
      
      const ffmpeg = spawn('ffmpeg', args)
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString()
        const frameMatch = output.match(/frame=\s*(\d+)/)
        if (frameMatch) {
          framesEncoded = parseInt(frameMatch[1])
        }
      })
      
      ffmpeg.on('close', (code) => {
        const elapsed = (Date.now() - startTime) / 1000
        const fps = framesEncoded / elapsed
        
        resolve({
          encoder,
          success: code === 0,
          framesEncoded,
          elapsedSeconds: elapsed,
          fps: Math.round(fps),
          score: Math.round(fps * 10) // Score simple basado en FPS
        })
      })
      
      ffmpeg.on('error', () => {
        resolve({
          encoder,
          success: false,
          error: 'Encoder no disponible'
        })
      })
    })
  }

  /**
   * Ejecuta benchmark de todos los encoders disponibles
   */
  async runFullBenchmark() {
    console.log('🏃 Ejecutando benchmark de encoders...')
    const results = []
    
    for (const encoder of this.capabilities.encoders) {
      const result = await this.benchmarkEncoder(encoder)
      results.push(result)
      console.log(`   ${encoder}: ${result.success ? `${result.fps} FPS` : 'FALLÓ'}`)
    }
    
    // Ordenar por score
    results.sort((a, b) => (b.score || 0) - (a.score || 0))
    
    // Actualizar recomendación basada en benchmark
    const best = results.find(r => r.success)
    if (best) {
      this.capabilities.recommended = best.encoder
      console.log(`✅ Mejor encoder: ${best.encoder} (${best.fps} FPS)`)
    }
    
    return results
  }
}

// Singleton
const hardwareDetector = new HardwareDetector()

export default hardwareDetector
