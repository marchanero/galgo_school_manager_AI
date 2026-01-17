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
  // Configuración básica
  enabled: process.env.REPLICATION_ENABLED === 'true',
  
  // Tipo de destino: 'mount' (local), 'rclone', 'rsync-ssh'
  destinationType: process.env.REPLICATION_DESTINATION_TYPE || 'mount',
  
  // Para tipo 'mount': ruta del punto de montaje SMB/NFS
  mountPath: process.env.REPLICATION_MOUNT_PATH || '/srv/galgovideo',
  
  // Para tipo 'rclone' o 'rsync-ssh': configuración de red
  host: process.env.REPLICATION_HOST,
  port: parseInt(process.env.REPLICATION_PORT) || 22,
  user: process.env.REPLICATION_USER,
  password: process.env.REPLICATION_PASSWORD,
  remotePath: process.env.REPLICATION_PATH,
  sshKeyPath: process.env.REPLICATION_SSH_KEY,
  
  // Motor de transferencia (para tipos de red)
  engine: process.env.REPLICATION_ENGINE || 'rclone', // 'rclone' o 'rsync'
  rcloneRemote: process.env.REPLICATION_RCLONE_REMOTE || 'truenas',
  
  // Opciones de transferencia
  transfers: parseInt(process.env.REPLICATION_TRANSFERS) || 4,
  checkers: parseInt(process.env.REPLICATION_CHECKERS) || 8,
  retries: parseInt(process.env.REPLICATION_RETRIES) || 10,
  retrySleep: parseInt(process.env.REPLICATION_RETRY_SLEEP) || 30,
  timeout: parseInt(process.env.REPLICATION_TIMEOUT) || 300,
  
  // Verificación de integridad
  verifyHash: process.env.REPLICATION_VERIFY_HASH !== 'false',
  
  // Umbrales de espacio remoto
  remoteMaxUsePercent: parseInt(process.env.REPLICATION_REMOTE_MAX_USE_PERCENT) || 85,
  remoteCriticalPercent: parseInt(process.env.REPLICATION_REMOTE_CRITICAL_PERCENT) || 95,
  
  // Backoff exponencial
  backoffBase: parseInt(process.env.REPLICATION_BACKOFF_BASE) || 2,
  backoffMax: parseInt(process.env.REPLICATION_BACKOFF_MAX) || 300,
  
  // Configuración para mock de pruebas
  useMock: process.env.REPLICATION_USE_MOCK === 'true',
  mockCapacityTB: parseInt(process.env.REPLICATION_MOCK_CAPACITY_TB) || 6
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
