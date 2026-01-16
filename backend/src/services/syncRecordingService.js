import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import recordingManager from './recordingManager.js'
import sensorRecorder from './sensorRecorder.js'
import mqttRecordingService from './mqttRecordingService.js'

const prisma = new PrismaClient()

/**
 * SyncRecordingService - Coordina grabación sincronizada de video y sensores
 * 
 * Garantiza:
 * - Timestamp maestro único para toda la sesión
 * - ID de sesión compartido entre video y sensores
 * - Generación de manifest.json al finalizar
 * - Registro de offsets de sincronización
 * - Persistencia en base de datos (Prisma)
 */
class SyncRecordingService extends EventEmitter {
  constructor() {
    super()
    this.activeSessions = new Map() // cameraId -> session data
    this.recordingsDir = path.join(process.cwd(), 'recordings')
  }

  /**
   * Inicia grabación sincronizada para una cámara
   * @param {Object} camera - { id, name, rtspUrl }
   * @param {Object} options - { scenarioId, scenarioName, sensorTopics }
   */
  async startSyncRecording(camera, options = {}) {
    const { scenarioId, scenarioName, sensorTopics = [] } = options

    // Verificar si ya hay una sesión activa
    if (this.activeSessions.has(camera.id)) {
      console.log(`⚠️ Ya hay una sesión de grabación activa para cámara ${camera.id}`)
      return {
        success: false,
        error: 'Ya hay una grabación activa'
      }
    }

    // === GENERAR CONTEXTO DE SESIÓN ===
    const sessionId = uuidv4()
    const masterTimestamp = new Date()
    const masterTimestampISO = masterTimestamp.toISOString()

    console.log(`\n🎬 ════════════════════════════════════════`)
    console.log(`   INICIANDO GRABACIÓN SINCRONIZADA`)
    console.log(`   Session ID: ${sessionId}`)
    console.log(`   Master Timestamp: ${masterTimestampISO}`)
    console.log(`   Cámara: ${camera.name}`)
    if (scenarioName) console.log(`   Escenario: ${scenarioName}`)
    console.log(`════════════════════════════════════════\n`)

    // Crear estructura de sesión en memoria
    const session = {
      sessionId,
      cameraId: camera.id,
      cameraName: camera.name,
      scenarioId,
      scenarioName,
      masterTimestamp,
      masterTimestampISO,
      videoStartTime: null,
      videoOffsetMs: null,
      sensorStartTime: null,
      sensorOffsetMs: null,
      status: 'starting',
      videoFiles: [],
      sensorFile: null,
      dbId: null // ID de registro en BD
    }

    this.activeSessions.set(camera.id, session)

    try {
      // === PERSISTENCIA INICIAL (BD) ===
      if (scenarioId) {
        try {
          const recordingRecord = await prisma.recording.create({
            data: {
              scenarioId: parseInt(scenarioId),
              cameraId: parseInt(camera.id),
              sessionId: sessionId,
              masterTime: masterTimestamp,
              startTime: masterTimestamp,
              metadata: JSON.stringify({
                cameraName: camera.name,
                scenarioName: scenarioName,
                sensorTopics: sensorTopics
              })
            }
          })
          session.dbId = recordingRecord.id
          console.log(`💾 Registro en BD creado: ID ${session.dbId}`)
        } catch (dbError) {
          console.error('⚠️ Error creando registro en BD (continuando sin persistencia):', dbError)
        }
      }

      // === INICIAR VIDEO (FFmpeg) ===
      const videoResult = recordingManager.startRecording(camera, {
        scenarioId,
        scenarioName
      })
      session.videoStartTime = new Date()
      session.videoOffsetMs = Date.now() - masterTimestamp.getTime()

      if (!videoResult.success) {
        throw new Error(`Error iniciando video: ${videoResult.message}`)
      }

      console.log(`📹 Video iniciado (offset: ${session.videoOffsetMs}ms)`)

      // === INICIAR SENSORES (JSONL) ===
      const sensorResult = sensorRecorder.startRecording(
        camera.id,
        camera.name,
        scenarioId,
        scenarioName
      )
      session.sensorStartTime = new Date()
      session.sensorOffsetMs = Date.now() - masterTimestamp.getTime()
      session.sensorFile = sensorResult.filename

      console.log(`📊 Sensores iniciados (offset: ${session.sensorOffsetMs}ms)`)

      // === HABILITAR GRABACIÓN MQTT ===
      mqttRecordingService.startRecordingForCamera(camera.id, {
        recordAllSensors: true,
        sensorIds: sensorTopics
      })

      console.log(`📡 Escucha MQTT habilitada`)

      // Calcular offset total
      const totalOffset = Math.abs(session.videoOffsetMs - session.sensorOffsetMs)
      console.log(`\n✅ Grabación sincronizada iniciada`)
      console.log(`   Offset Video-Sensores: ${totalOffset}ms`)

      session.status = 'recording'

      // Actualizar offset en BD si existe el registro
      if (session.dbId) {
        await prisma.recording.update({
          where: { id: session.dbId },
          data: {
            videoOffset: session.videoOffsetMs,
            sensorOffset: session.sensorOffsetMs
          }
        }).catch(e => console.error('Error actualizando offsets en DB:', e))
      }

      // Emitir evento
      this.emit('syncRecordingStarted', {
        sessionId,
        cameraId: camera.id,
        cameraName: camera.name,
        scenarioName,
        masterTimestamp: masterTimestampISO,
        offsets: {
          video: session.videoOffsetMs,
          sensor: session.sensorOffsetMs,
          total: totalOffset
        }
      })

      return {
        success: true,
        sessionId,
        masterTimestamp: masterTimestampISO,
        offsets: {
          video: session.videoOffsetMs,
          sensor: session.sensorOffsetMs,
          total: totalOffset
        }
      }

    } catch (error) {
      console.error(`❌ Error en grabación sincronizada:`, error)
      
      // Limpiar BD si se creó registro
      if (session.dbId) {
        prisma.recording.delete({ where: { id: session.dbId } }).catch(() => {})
      }

      // Limpiar estado parcial
      this.activeSessions.delete(camera.id)
      
      // Intentar detener lo que se haya iniciado
      try {
        recordingManager.stopRecording(camera.id)
        await sensorRecorder.stopRecording(camera.id)
        mqttRecordingService.stopRecordingForCamera(camera.id)
      } catch (cleanupError) {
        console.error(`⚠️ Error en limpieza:`, cleanupError)
      }

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Detiene grabación sincronizada y genera manifest
   */
  async stopSyncRecording(cameraId) {
    const session = this.activeSessions.get(cameraId)

    if (!session) {
      console.log(`⚠️ No hay sesión activa para cámara ${cameraId}`)
      return {
        success: false,
        error: 'No hay grabación activa'
      }
    }

    console.log(`\n🛑 ════════════════════════════════════════`)
    console.log(`   DETENIENDO GRABACIÓN SINCRONIZADA`)
    console.log(`   Session ID: ${session.sessionId}`)
    console.log(`════════════════════════════════════════\n`)

    session.status = 'stopping'
    const endTimestamp = new Date()

    try {
      // === DETENER VIDEO ===
      const videoResult = await recordingManager.stopRecording(cameraId)
      console.log(`📹 Video detenido`)

      // === DETENER SENSORES ===
      const sensorResult = await sensorRecorder.stopRecording(cameraId)
      console.log(`📊 Sensores detenidos (${sensorResult.recordCount} registros)`)

      // === DESHABILITAR MQTT ===
      mqttRecordingService.stopRecordingForCamera(cameraId)
      console.log(`📡 Escucha MQTT deshabilitada`)

      // === GENERAR MANIFEST ===
      const manifest = await this.generateManifest(session, endTimestamp, videoResult, sensorResult)

      // === ACTUALIZAR BD ===
      if (session.dbId) {
        try {
          await prisma.recording.update({
            where: { id: session.dbId },
            data: {
              endTime: endTimestamp,
              duration: manifest.duration,
              manifestPath: manifest.manifestPath,
              videoPath: manifestDirToFile(manifest.manifestPath, videoResult?.outputDir), // Helper simplificado
              sensorPath: sensorResult?.filepath,
              sensorRecords: sensorResult?.recordCount || 0
            }
          })
          console.log(`💾 Registro en BD actualizado`)
        } catch (dbError) {
          console.error('⚠️ Error actualizando BD:', dbError)
        }
      }

      // Limpiar sesión
      this.activeSessions.delete(cameraId)

      console.log(`\n✅ Grabación sincronizada finalizada`)
      console.log(`   Manifest: ${manifest.manifestPath}`)

      // Emitir evento
      this.emit('syncRecordingStopped', {
        sessionId: session.sessionId,
        cameraId,
        manifestPath: manifest.manifestPath,
        duration: manifest.duration
      })

      return {
        success: true,
        sessionId: session.sessionId,
        manifest,
        duration: manifest.duration,
        sensorRecordCount: sensorResult.recordCount
      }

    } catch (error) {
      console.error(`❌ Error deteniendo grabación:`, error)
      
      // Limpiar de todos modos
      this.activeSessions.delete(cameraId)

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Genera archivo manifest.json con metadatos de sincronización
   */
  async generateManifest(session, endTimestamp, videoResult, sensorResult) {
    const duration = Math.floor((endTimestamp - session.masterTimestamp) / 1000)
    
    // Construir ruta del manifest
    const today = session.masterTimestamp.toISOString().split('T')[0]
    const scenarioFolder = session.scenarioName 
      ? session.scenarioName.replace(/[^a-zA-Z0-9]/g, '_') 
      : 'sin_escenario'
    const manifestDir = path.join(
      this.recordingsDir, 
      scenarioFolder, 
      today, 
      `camera_${session.cameraId}`
    )
    const manifestPath = path.join(manifestDir, `session_${session.sessionId.slice(0, 8)}.json`)

    // Listar archivos de video generados
    let videoFiles = []
    if (fs.existsSync(manifestDir)) {
      videoFiles = fs.readdirSync(manifestDir)
        .filter(f => f.endsWith('.mp4'))
        .map(f => {
          const filePath = path.join(manifestDir, f)
          const stats = fs.statSync(filePath)
          return {
            filename: f,
            size: stats.size,
            created: stats.birthtime
          }
        })
    }

    const manifest = {
      version: '1.0',
      sessionId: session.sessionId,
      camera: {
        id: session.cameraId,
        name: session.cameraName
      },
      scenario: session.scenarioName ? {
        id: session.scenarioId,
        name: session.scenarioName
      } : null,
      timing: {
        masterTimestamp: session.masterTimestampISO,
        startTime: session.masterTimestamp.toISOString(),
        endTime: endTimestamp.toISOString(),
        durationSeconds: duration
      },
      synchronization: {
        videoOffsetMs: session.videoOffsetMs,
        sensorOffsetMs: session.sensorOffsetMs,
        totalOffsetMs: Math.abs(session.videoOffsetMs - session.sensorOffsetMs),
        note: 'Offset positivo indica que el componente inició después del masterTimestamp'
      },
      video: {
        files: videoFiles,
        framesProcessed: videoResult?.framesProcessed || 0
      },
      sensors: {
        filename: sensorResult?.filename || session.sensorFile,
        recordCount: sensorResult?.recordCount || 0,
        filepath: sensorResult?.filepath
      },
      generatedAt: new Date().toISOString()
    }

    // Escribir manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    
    console.log(`📄 Manifest generado: ${manifestPath}`)

    return {
      ...manifest,
      manifestPath
    }
  }

  /**
   * Obtiene estado de una sesión activa
   */
  getSessionStatus(cameraId) {
    const session = this.activeSessions.get(cameraId)
    if (!session) return null

    const now = new Date()
    return {
      sessionId: session.sessionId,
      cameraId: session.cameraId,
      cameraName: session.cameraName,
      scenarioName: session.scenarioName,
      status: session.status,
      masterTimestamp: session.masterTimestampISO,
      duration: Math.floor((now - session.masterTimestamp) / 1000),
      offsets: {
        video: session.videoOffsetMs,
        sensor: session.sensorOffsetMs
      }
    }
  }

  /**
   * Obtiene estado de todas las sesiones activas
   */
  getAllSessionsStatus() {
    const sessions = []
    for (const [cameraId] of this.activeSessions) {
      sessions.push(this.getSessionStatus(cameraId))
    }
    return sessions
  }

  /**
   * Verifica si hay una sesión activa para una cámara
   */
  isRecording(cameraId) {
    return this.activeSessions.has(cameraId)
  }

  /**
   * Detiene todas las sesiones activas
   */
  async stopAll() {
    console.log('🛑 Deteniendo todas las sesiones sincronizadas...')
    
    const promises = []
    for (const [cameraId] of this.activeSessions) {
      promises.push(this.stopSyncRecording(cameraId))
    }

    await Promise.all(promises)
    console.log('✅ Todas las sesiones detenidas')
  }
}

// Helper simple para obtener ruta de video válida para BD en caso de múltiples segmentos
function manifestDirToFile(manifestPath, outputDir) {
    if (!manifestPath) return null;
    return path.dirname(manifestPath); // Guardamos el directorio por ahora si hay multiples archivos
}


// Singleton
const syncRecordingService = new SyncRecordingService()

export default syncRecordingService
