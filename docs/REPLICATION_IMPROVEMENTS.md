# Mejoras Propuestas - Sistema de Replicación y Sincronización

**Fecha:** 2026-01-15
**Rama:** feat/mock-replication-server-5tb
**Estado:** Propuesto

## Resumen

Este documento detalla las mejoras propuestas para el sistema de replicación de archivos entre el servidor principal y servidores externos, con enfoque en robustez, eficiencia y confiabilidad.

---

## 1. Sistema de Sincronización Bidireccional

### 1.1 Comparación de Archivos con Hash

**Objetivo:** Verificar integridad de archivos antes y después de la transferencia.

**Implementación:**
- Calcular hash SHA256 de archivos locales antes de transferir
- Comparar hash con el archivo en el servidor remoto después de la transferencia
- Solo marcar como sincronizado si los hashes coinciden

**Ubicación:** [backend/src/services/replicationService.js](backend/src/services/replicationService.js)

```javascript
// Función propuesta
async calculateFileHash(filePath) {
  const hash = crypto.createHash('sha256')
  const stream = fs.createReadStream(filePath)

  return new Promise((resolve, reject) => {
    stream.on('data', data => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async verifyRemoteFile(localPath, remotePath, connection) {
  const localHash = await this.calculateFileHash(localPath)
  const remoteHash = await connection.exec(`sha256sum "${remotePath}"`)
  return localHash === remoteHash.split(' ')[0]
}
```

**Beneficios:**
- Garantiza integridad de datos
- Detecta transferencias corruptas
- Evita sincronizaciones incompletas

---

### 1.2 Sincronización de Archivos Faltantes desde Servidor Externo

**Objetivo:** Recuperar archivos que existen en el servidor externo pero faltan en el local.

**Casos de uso:**
- Recuperación ante pérdida de datos local
- Sincronización inicial de nuevo nodo
- Backup inverso

**Implementación:**

```javascript
async syncFromRemote(serverId) {
  const server = await this.prisma.replicationServer.findUnique({
    where: { id: serverId }
  })

  // Obtener lista de archivos remotos
  const remoteFiles = await this.listRemoteFiles(server)

  // Comparar con archivos locales
  const localRecordings = await this.prisma.recording.findMany()
  const localPaths = new Set(localRecordings.map(r => r.filePath))

  // Identificar archivos faltantes
  const missingFiles = remoteFiles.filter(f => !localPaths.has(f.localPath))

  // Descargar archivos faltantes
  for (const file of missingFiles) {
    await this.downloadFromRemote(server, file)
  }
}
```

**Beneficios:**
- Resiliencia ante pérdida de datos
- Sincronización bidireccional real
- Facilita recuperación ante desastres

---

## 2. Gestión de Espacio en Servidor Externo

### 2.1 Monitoreo de Capacidad Remota

**Objetivo:** Prevenir fallos por falta de espacio en servidor externo.

**Implementación:**

```javascript
async checkRemoteSpace(connection, remotePath) {
  const dfOutput = await connection.exec(`df -B1 "${remotePath}"`)
  const lines = dfOutput.trim().split('\n')
  const [, , used, available] = lines[1].split(/\s+/)

  return {
    used: parseInt(used),
    available: parseInt(available),
    total: parseInt(used) + parseInt(available),
    usedPercent: (parseInt(used) / (parseInt(used) + parseInt(available))) * 100
  }
}
```

**Acción automática:**
- Pausar replicación si espacio disponible < 10%
- Alertar al sistema cuando espacio < 20%
- Registrar métricas de uso de espacio

---

### 2.2 Política de Limpieza Automática

**Objetivo:** Eliminar archivos antiguos en servidor externo cuando se alcanza umbral de espacio.

**Estrategia:**
1. Identificar archivos más antiguos
2. Eliminar hasta liberar X% de espacio
3. Mantener archivos recientes (últimos N días)
4. Respetar archivos marcados como "importantes"

**Configuración sugerida:**

```javascript
const cleanupPolicy = {
  triggerThreshold: 85,    // Activar limpieza al 85% de uso
  targetThreshold: 70,     // Limpiar hasta alcanzar 70%
  minRetentionDays: 30,    // Nunca eliminar archivos < 30 días
  protectedTags: ['important', 'event'] // Tags protegidos
}
```

---

## 3. Sistema de Reintentos Inteligente

### 3.1 Backoff Exponencial

**Objetivo:** Reintentar transferencias fallidas con espera incremental.

**Implementación:**

```javascript
async transferWithRetry(file, connection, maxRetries = 5) {
  let attempt = 0
  let delay = 1000 // Comenzar con 1 segundo

  while (attempt < maxRetries) {
    try {
      await this.transferFile(file, connection)
      return { success: true, attempts: attempt + 1 }
    } catch (error) {
      attempt++

      if (attempt >= maxRetries) {
        return { success: false, attempts: attempt, error: error.message }
      }

      // Backoff exponencial: 1s, 2s, 4s, 8s, 16s
      await this.sleep(delay)
      delay *= 2

      console.log(`⚠️ Reintento ${attempt}/${maxRetries} tras ${delay/1000}s`)
    }
  }
}
```

**Beneficios:**
- Maneja problemas de red temporales
- Reduce carga en servidor durante problemas
- Mayor tasa de éxito en transferencias

---

### 3.2 Priorización de Archivos

**Objetivo:** Transferir primero los archivos más importantes o recientes.

**Sistema de prioridad:**
- **Alta:** Archivos de últimas 24h, grabaciones de eventos
- **Media:** Archivos de última semana
- **Baja:** Archivos antiguos

**Implementación:**

```javascript
async getPendingFilesByPriority() {
  return await this.prisma.recording.findMany({
    where: {
      syncStatus: 'pending',
      replicationServerId: { not: null }
    },
    orderBy: [
      { priority: 'desc' },     // Campo nuevo
      { startTime: 'desc' }     // Más recientes primero
    ]
  })
}
```

---

## 4. Sistema de Notificaciones y Alertas

### 4.1 Eventos de Replicación

**Eventos a monitorear:**
- Transferencia exitosa
- Transferencia fallida (tras todos los reintentos)
- Servidor externo inalcanzable
- Espacio bajo en servidor externo
- Corrupción de archivo detectada

**Canales de notificación:**
- MQTT (para frontend en tiempo real)
- Logs estructurados
- WebSocket (dashboard en vivo)

**Implementación:**

```javascript
// En replicationService.js
this.emit('transferSuccess', {
  recordingId,
  serverId,
  fileSize,
  duration
})

this.emit('transferFailed', {
  recordingId,
  serverId,
  error,
  attempts
})

this.emit('serverUnreachable', {
  serverId,
  lastSeen
})
```

---

### 4.2 Dashboard de Estado

**Información a mostrar:**
- Estado de conexión de cada servidor
- Archivos pendientes de sincronización
- Velocidad de transferencia actual
- Uso de espacio en cada servidor
- Historial de errores reciente

**Endpoint propuesto:**

```javascript
// GET /api/replication/dashboard
{
  servers: [
    {
      id: 1,
      name: "Servidor Externo Principal",
      status: "online",
      lastSync: "2026-01-15T10:30:00Z",
      pendingFiles: 5,
      diskUsage: 45.2,
      transferRate: "2.3 MB/s"
    }
  ],
  totalPending: 12,
  totalSynced: 1523,
  last24hTransfers: 48
}
```

---

## 5. Optimizaciones de Rendimiento

### 5.1 Transferencias en Paralelo

**Objetivo:** Aprovechar ancho de banda disponible transfiriendo múltiples archivos simultáneamente.

**Implementación:**

```javascript
async processQueueWithConcurrency(maxConcurrent = 3) {
  const pending = await this.getPendingFilesByPriority()

  const chunks = []
  for (let i = 0; i < pending.length; i += maxConcurrent) {
    chunks.push(pending.slice(i, i + maxConcurrent))
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(file => this.transferFile(file)))
  }
}
```

**Configuración sugerida:**
- WiFi: 2-3 transferencias simultáneas
- Ethernet: 5-8 transferencias simultáneas
- Ajuste dinámico según velocidad detectada

---

### 5.2 Compresión Opcional

**Objetivo:** Reducir tiempo de transferencia para archivos grandes.

**Estrategia:**
- Comprimir con gzip durante transferencia
- Descomprimir automáticamente en destino
- Solo para archivos > 100MB

**Implementación:**

```javascript
async transferCompressed(localPath, remotePath, connection) {
  const tmpCompressed = `${localPath}.gz`

  // Comprimir localmente
  await this.compress(localPath, tmpCompressed)

  // Transferir comprimido
  await connection.put(tmpCompressed, `${remotePath}.gz`)

  // Descomprimir en destino
  await connection.exec(`gunzip "${remotePath}.gz"`)

  // Limpiar temporal
  await fs.unlink(tmpCompressed)
}
```

---

## 6. Seguridad y Autenticación

### 6.1 Validación de Credenciales

**Mejoras propuestas:**
- Rotar periódicamente las claves SSH
- Usar certificados en lugar de contraseñas cuando sea posible
- Validar fingerprint del servidor remoto
- Encriptar credenciales en base de datos

**Implementación:**

```javascript
async validateConnection(server) {
  const connection = await this.getConnection(server.id)

  try {
    // Verificar fingerprint
    const actualFingerprint = await connection.getFingerprint()
    if (server.fingerprint && actualFingerprint !== server.fingerprint) {
      throw new Error('Fingerprint del servidor no coincide')
    }

    // Verificar permisos
    await connection.exec('touch /tmp/test_write')
    await connection.exec('rm /tmp/test_write')

    return { valid: true }
  } catch (error) {
    return { valid: false, error: error.message }
  }
}
```

---

## 7. Logging y Auditoría

### 7.1 Registro Detallado

**Información a registrar:**
- Timestamp de cada operación
- Archivo transferido (nombre, tamaño, duración)
- Servidor destino
- Resultado (éxito/fallo)
- Tiempo de transferencia
- Velocidad promedio
- Errores y stack traces

**Esquema de base de datos:**

```sql
CREATE TABLE replication_logs (
  id INTEGER PRIMARY KEY,
  recordingId INTEGER,
  serverId INTEGER,
  operation TEXT,      -- 'upload', 'download', 'verify', 'delete'
  status TEXT,         -- 'success', 'failed', 'partial'
  fileSize INTEGER,
  transferTime INTEGER, -- milliseconds
  speed REAL,          -- MB/s
  error TEXT,
  timestamp DATETIME,
  FOREIGN KEY (recordingId) REFERENCES Recording(id),
  FOREIGN KEY (serverId) REFERENCES ReplicationServer(id)
)
```

---

### 7.2 Métricas y Estadísticas

**KPIs a trackear:**
- Tasa de éxito de transferencias (%)
- Tiempo promedio de transferencia por GB
- Archivos sincronizados en últimas 24h
- Uso de ancho de banda (MB/día)
- Disponibilidad de servidores (uptime %)

**Endpoint propuesto:**

```javascript
// GET /api/replication/metrics
{
  successRate: 98.5,
  avgTransferTimePerGB: 45, // segundos
  last24hSynced: 48,
  avgBandwidth: 125.3, // MB/hora
  serverUptime: {
    "1": 99.9,
    "2": 95.2
  }
}
```

---

## 8. Plan de Implementación

### Fase 1: Fundamentos (Semana 1-2)
- [ ] Sistema de hash y verificación de integridad
- [ ] Reintentos con backoff exponencial
- [ ] Monitoreo de espacio remoto
- [ ] Logging mejorado

### Fase 2: Robustez (Semana 3-4)
- [ ] Sincronización bidireccional
- [ ] Sistema de prioridades
- [ ] Política de limpieza automática
- [ ] Dashboard de estado básico

### Fase 3: Optimización (Semana 5-6)
- [ ] Transferencias en paralelo
- [ ] Compresión opcional
- [ ] Métricas y estadísticas
- [ ] Dashboard avanzado

### Fase 4: Seguridad (Semana 7-8)
- [ ] Validación de fingerprints
- [ ] Rotación de credenciales
- [ ] Auditoría completa
- [ ] Alertas automáticas

---

## 9. Consideraciones Técnicas

### Hardware Mínimo Recomendado
- **CPU:** 4 cores (para transferencias paralelas)
- **RAM:** 4GB mínimo, 8GB recomendado
- **Red:** 100 Mbps mínimo, Gigabit recomendado
- **Disco:** SSD para mejor rendimiento

### Limitaciones Conocidas
- SSH puede tener overhead significativo (20-30%)
- WiFi puede ser inestable para transferencias largas
- La compresión consume CPU (trade-off tiempo vs recursos)

### Alternativas Consideradas
- **rsync:** Más eficiente pero requiere instalación en ambos lados
- **rclone:** Excelente para cloud storage pero más complejo
- **Custom protocol:** Mayor control pero más desarrollo

---

## 10. Testing y Validación

### Tests Necesarios
1. **Test de integridad:** Verificar hash antes/después
2. **Test de reintentos:** Simular fallos de red
3. **Test de espacio:** Simular disco lleno
4. **Test de concurrencia:** Múltiples transferencias simultáneas
5. **Test de recuperación:** Sincronización bidireccional
6. **Test de rendimiento:** Medir velocidad de transferencia

### Métricas de Éxito
- Tasa de éxito > 99%
- Tiempo de detección de fallo < 30s
- Recuperación automática > 95% de casos
- Zero pérdida de datos verificable
- Dashboard responsive < 2s

---

## Referencias

- Commit inicial: [1a0f556](https://github.com/../commit/1a0f556) - feat: Iniciar rama para gestión de réplicas
- Mock data: [bf1f086](https://github.com/../commit/bf1f086) - feat: Add mock data for external server replication
- Servicio actual: [backend/src/services/replicationService.js](backend/src/services/replicationService.js)
- Rutas API: [backend/src/routes/replication.js](backend/src/routes/replication.js)

---

## Notas Adicionales

Este documento es un plan vivo que se actualizará según se implementen las mejoras y se descubran nuevos requisitos. Cada cambio debe ser revisado y aprobado antes de implementarse en producción.

**Autor:** Claude (Assistant)
**Revisor:** Pendiente
**Última actualización:** 2026-01-15
