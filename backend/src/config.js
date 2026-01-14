// Configuración de cámaras y credenciales
import dotenv from 'dotenv'
dotenv.config()

export const cameraConfig = {
  // Acceso directo a la cámara en la red de sensores
  ip: process.env.CAMERA_IP || '192.168.8.210',
  username: process.env.CAMERA_USER || 'admin',
  password: process.env.CAMERA_PASS || 'galgo2526',
  port: process.env.CAMERA_PORT || 554,
  protocol: 'rtsp'
}

// URLs de ejemplo
export const streamPaths = {
  stream1: '/stream1',
  stream2: '/stream2',
  stream3: '/stream3',
  mainStream: '/stream',
  subStream: '/stream?token=sub'
}

export const replication = {
  enabled: process.env.REPLICATION_ENABLED === 'true',
  host: process.env.REPLICATION_HOST,
  user: process.env.REPLICATION_USER,
  remotePath: process.env.REPLICATION_PATH,
  sshKeyPath: process.env.REPLICATION_SSH_KEY
}

// Configuración de almacenamiento y retención
export const storage = {
  // Umbrales de alerta (porcentaje de uso del disco)
  warningThreshold: parseInt(process.env.STORAGE_WARNING_THRESHOLD) || 75,
  criticalThreshold: parseInt(process.env.STORAGE_CRITICAL_THRESHOLD) || 90,
  autoCleanThreshold: parseInt(process.env.STORAGE_AUTOCLEAN_THRESHOLD) || 85,
  
  // Retención por defecto (días)
  defaultRetentionDays: parseInt(process.env.STORAGE_RETENTION_DAYS) || 30,
  
  // Espacio mínimo libre requerido (GB)
  minFreeSpaceGB: parseInt(process.env.STORAGE_MIN_FREE_GB) || 10,
  
  // Intervalo de verificación (minutos)
  checkIntervalMinutes: parseInt(process.env.STORAGE_CHECK_INTERVAL_MINUTES) || 5
}

export default {
  cameraConfig,
  streamPaths,
  replication,
  storage
}
