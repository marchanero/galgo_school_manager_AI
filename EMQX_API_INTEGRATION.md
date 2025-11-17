# 📡 Integración EMQX API - Sistema de Sensores

## Descripción General

El sistema ahora integra la API REST de EMQX para monitorear en tiempo real:
- **Clientes conectados** (publishers de sensores)
- **Estadísticas del cluster** MQTT
- **Métricas de mensajes** (enviados, recibidos, dropped)
- **Estado de conexión** de cada sensor

## 🔧 Configuración

### 1. Variables de Entorno (Frontend)

Crea un archivo `.env` en `/frontend`:

```bash
cp .env.example .env
```

Edita con tus credenciales:

```env
VITE_EMQX_API_URL=http://100.82.84.24:18083/api/v5
VITE_EMQX_API_KEY=admin
VITE_EMQX_API_SECRET=galgo2526

VITE_MQTT_BROKER_URL=ws://100.82.84.24:8083/mqtt
VITE_MQTT_USERNAME=admin
VITE_MQTT_PASSWORD=galgo2526
```

### 2. Habilitar CORS en EMQX

Si accedes desde `localhost`, debes configurar CORS en EMQX Dashboard:

1. Abre: `http://100.82.84.24:18083`
2. Login: `admin` / `galgo2526`
3. Ve a: **Management** → **HTTP API**
4. Habilita CORS o agrega tu dominio

**Alternativa:** Usar proxy en Vite (ya configurado en `vite.config.js`):

```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api/v5': {
        target: 'http://100.82.84.24:18083',
        changeOrigin: true
      }
    }
  }
})
```

## 📊 Nuevas Funcionalidades

### Dashboard de Sensores (Mejorado)

**Estadísticas EMQX:**
- ✅ Total de clientes conectados al broker
- ✅ Número de publishers activos (sensor-publisher-*)
- ✅ Mensajes recibidos/enviados en el cluster
- ✅ Detección automática de publishers por sensor

**Tarjetas de Sensores:**
- 🔵 Indicador azul pulsante si el publisher está activo
- 🟢 Indicador verde si hay datos recientes (<1min)
- 🟡 Indicador amarillo si datos antiguos (>1min)
- ⚪ Indicador gris sin datos

**Sección Publishers Activos:**
- Lista de todos los publishers conectados
- ClientID, IP, timestamp de conexión
- Mensajes enviados/recibidos por cliente

## 🔌 Servicios y Hooks

### `emqxApi.js`

Cliente HTTP para la API REST de EMQX:

```javascript
import emqxApi from '../services/emqxApi'

// Obtener estadísticas del cluster
const stats = await emqxApi.getClusterStats()
console.log(stats['connections.count']) // Total conexiones

// Obtener publishers de sensores
const publishers = await emqxApi.getSensorClients()
console.log(publishers.data) // Array de clientes sensor-*

// Verificar si un sensor está conectado
const isConnected = await emqxApi.isSensorConnected('TEMP001')

// Obtener métricas de mensajes
const metrics = await emqxApi.getMessageMetrics()
console.log(metrics.received, metrics.sent)
```

### `useEmqxData` Hook

Hook React para datos EMQX con auto-refresh:

```javascript
import { useEmqxData } from '../hooks/useEmqxData'

function MyComponent() {
  const {
    clusterStats,      // Estadísticas del cluster
    sensorClients,     // Publishers activos
    clients,           // Todos los clientes
    messageMetrics,    // Métricas de mensajes
    loading,           // Estado de carga
    error,             // Errores
    refetch,           // Función para refrescar
    isSensorConnected  // Verificar conexión de sensor
  } = useEmqxData(true, 5000) // Auto-refresh cada 5s
  
  // Verificar sensor específico
  const checkSensor = async () => {
    const connected = await isSensorConnected('TEMP001')
    console.log('TEMP001 conectado:', connected)
  }
  
  return (
    <div>
      <p>Clientes: {clusterStats['connections.count']}</p>
      <p>Publishers: {sensorClients.length}</p>
      <button onClick={refetch}>Refrescar</button>
    </div>
  )
}
```

## 🎨 Componentes Actualizados

### `SensorsDashboard.jsx`

**Nuevas características:**

1. **Panel de estadísticas EMQX** (4 tarjetas):
   ```jsx
   - Clientes Conectados
   - Publishers Sensores
   - Mensajes Recibidos
   - Mensajes Enviados
   ```

2. **Indicador de publisher activo** en cada tarjeta de sensor:
   ```jsx
   {isPublisherActive && (
     <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
   )}
   ```

3. **Sección de publishers activos** al final del dashboard:
   ```jsx
   <div>📡 Publishers Activos (3)</div>
   - sensor-publisher-1731849512345
   - stress-test-1731849600123
   - diagnostic-pub-1731849700456
   ```

## 🧪 Testing

### 1. Verificar API EMQX

```bash
# Desde terminal o Postman
curl -u admin:galgo2526 http://100.82.84.24:18083/api/v5/stats

# Debería retornar JSON con estadísticas
{
  "connections.count": 5,
  "messages.received": 1234,
  "messages.sent": 5678,
  ...
}
```

### 2. Iniciar Publisher

```bash
cd test_publisher
node start.js
# Selecciona opción 1 (Multi-Sensor)
```

### 3. Verificar en Dashboard

1. Abre: `http://localhost:5173`
2. Ve a tab **Sensores**
3. Observa:
   - Panel de estadísticas muestra publishers activos
   - Tarjetas de sensores tienen indicador azul pulsante
   - Última sección muestra el cliente `sensor-publisher-*`

## 🔍 Debugging

### Ver Requests a EMQX API

Abre DevTools (F12) → Network → Filtra por `api/v5`:

```
GET /api/v5/stats         → Estadísticas cluster
GET /api/v5/clients       → Todos los clientes
GET /api/v5/clients?like_clientid=sensor- → Publishers
```

### Ver Logs del Hook

El hook `useEmqxData` imprime logs en consola:

```
[useEmqxData] Fetching data...
[useEmqxData] Success: 3 sensor clients
[useEmqxData] Error: Failed to fetch
```

### Errores Comunes

**Error CORS:**
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solución:** Configurar proxy en `vite.config.js` o habilitar CORS en EMQX

**Error 401 Unauthorized:**
```
401: Authentication failed
```
**Solución:** Verificar `VITE_EMQX_API_KEY` y `VITE_EMQX_API_SECRET` en `.env`

**Error Connection Refused:**
```
ERR_CONNECTION_REFUSED
```
**Solución:** 
- Verificar que EMQX Dashboard esté activo: `http://100.82.84.24:18083`
- Verificar firewall/red
- Confirmar puerto 18083 abierto

## 📈 Métricas Disponibles

### Cluster Stats (`clusterStats`)

```javascript
{
  "connections.count": 10,        // Total conexiones
  "connections.max": 1024000,     // Máximo permitido
  "sessions.count": 10,           // Sesiones activas
  "topics.count": 50,             // Topics con suscriptores
  "subscriptions.count": 100,     // Total suscripciones
  "messages.received": 50000,     // Mensajes recibidos
  "messages.sent": 48000,         // Mensajes enviados
  "messages.dropped": 0,          // Mensajes descartados
  "messages.retained": 10         // Mensajes retenidos
}
```

### Client Info (`sensorClients[0]`)

```javascript
{
  "clientid": "sensor-publisher-1731849512345",
  "username": "admin",
  "ip_address": "192.168.1.100",
  "port": 54321,
  "connected": true,
  "connected_at": "2025-11-17T10:30:45.123Z",
  "keepalive": 60,
  "recv_msg": 0,      // Mensajes recibidos por este cliente
  "send_msg": 1234,   // Mensajes enviados por este cliente
  "subscriptions_cnt": 0
}
```

### Message Metrics (`messageMetrics`)

```javascript
{
  "received": 50000,   // Total recibidos en cluster
  "sent": 48000,       // Total enviados
  "dropped": 0,        // Descartados (QoS, límites)
  "retained": 10,      // Mensajes retenidos
  "delivered": 47500,  // Entregados exitosamente
  "acked": 47000       // Confirmados por suscriptores
}
```

## 🚀 Próximos Pasos

1. **Alertas visuales** cuando un publisher se desconecta
2. **Gráficos históricos** de mensajes por segundo
3. **Filtros** por tipo de sensor en publishers
4. **Notificaciones** cuando se detecta nuevo publisher
5. **Logs en tiempo real** de mensajes MQTT

## 📚 Referencias

- [EMQX HTTP API Docs](https://www.emqx.io/docs/en/latest/admin/api.html)
- [EMQX Dashboard](http://100.82.84.24:18083)
- [Backend MQTT Service](/backend/src/services/mqttService.js)
- [Frontend MQTT Context](/frontend/src/contexts/MQTTContext.jsx)

---

✨ **Integración completa MQTT + EMQX API para monitoreo en tiempo real**
