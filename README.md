# 🎥 Visor de Cámaras RTSP - MERN Stack

Una aplicación web moderna para visualizar streams de cámaras RTSP usando **React + Vite** en el frontend y **Node.js + Express** en el backend, con **SQLite** y **Prisma ORM** para la gestión de datos.

## 🚀 Características

- ✅ Frontend moderno con React 18 y Vite
- ✅ Backend API REST con Express.js
- ✅ Base de datos SQLite con Prisma ORM
- ✅ Gestión completa de cámaras RTSP
- ✅ Interfaz responsive y moderna
- ✅ Stream de video en tiempo real
- ✅ Control de reproducción (play/pause)
- ✅ Información en tiempo real de cámaras
- ✅ **Gestión de Sensores IoT (MQTT)**
- ✅ **Escenarios y Aulas configurables**
- ✅ **Reglas de grabación basadas en eventos**
- ✅ **Sistema de replicación y backup con rclone/rsync**
- ✅ **Persistencia de configuración de servidor en base de datos**
- ✅ **Interfaz de configuración de backup en frontend**

## 📋 Requisitos Previos

- Node.js 16+ (recomendado 18 o superior)
- npm o yarn
- Terminal/CMD

## 🎥 Configuración de Cámaras

La aplicación está configurada para conectarse a las siguientes cámaras RTSP:

| Parámetro | Valor |
|-----------|-------|
| **IP** | `192.168.8.210` |
| **Usuario** | `admin` |
| **Contraseña** | `galgo2526` |
| **Puerto** | `554` |
| **Protocolo** | RTSP |

**URLs de Streaming:**
- `rtsp://admin:galgo2526@192.168.8.210:554/stream1`
- `rtsp://admin:galgo2526@192.168.8.210:554/stream2`
- `rtsp://admin:galgo2526@192.168.8.210:554/stream3`

## 🔄 Sistema de Replicación y Backup

La aplicación incluye un sistema completo de replicación de archivos para backup automático de grabaciones de cámaras a servidores externos.

### Características del Sistema

- **Motores de Replicación:** rclone (recomendado) o rsync
- **Transporte Seguro:** SSH con claves o contraseñas
- **Persistencia de Configuración:** Almacenamiento en base de datos Prisma
- **Modo Simulación:** Configuración mock para desarrollo
- **Verificación de Integridad:** Hash SHA256 opcional
- **Reintentos Inteligentes:** Backoff exponencial
- **Transferencias Paralelas:** Múltiples archivos simultáneos
- **Monitoreo en Tiempo Real:** Dashboard con estadísticas

### Configuración del Servidor de Backup

1. **Acceder al Panel de Backup:**
   - Ir a la pestaña "Replicación" en el frontend
   - Hacer clic en el icono de engranaje ⚙️
   - Expandir "Mostrar configuración del servidor"

2. **Configurar Servidor:**
   - **Modo Simulación:** Para desarrollo (sin servidor real)
   - **Servidor Real:** Configurar IP, puerto, usuario y credenciales
   - **Opciones Avanzadas:** Transferencias paralelas, reintentos, verificación hash

3. **Probar Conexión:**
   - Usar el botón "Probar Conexión" para verificar credenciales
   - Guardar configuración para persistirla en la base de datos

### Endpoints de API de Replicación

- `GET /api/replication/stats` - Obtener estadísticas de replicación
- `POST /api/replication/start` - Iniciar replicación manual
- `POST /api/replication/stop` - Detener replicación
- `GET /api/replication/server-config` - Obtener configuración del servidor
- `POST /api/replication/server-config` - Guardar configuración del servidor
- `POST /api/replication/test-connection` - Probar conexión al servidor

### Ejemplo de Configuración

```bash
# Obtener configuración actual
curl http://localhost:3000/api/replication/server-config

# Configurar servidor mock
curl -X POST http://localhost:3000/api/replication/server-config \
  -H "Content-Type: application/json" \
  -d '{
    "useMock": true,
    "engine": "rclone",
    "host": "",
    "port": 22,
    "user": "",
    "remotePath": "/mnt/backups/cameras",
    "transfers": 4,
    "retries": 10,
    "verifyHash": true
  }'

# Configurar servidor real (TrueNAS)
curl -X POST http://localhost:3000/api/replication/server-config \
  -H "Content-Type: application/json" \
  -d '{
    "useMock": false,
    "engine": "rclone",
    "host": "192.168.1.100",
    "port": 22,
    "user": "backupuser",
    "password": "securepass",
    "remotePath": "/mnt/backups/cameras",
    "transfers": 4,
    "retries": 10,
    "verifyHash": true
  }'
```

## 🌡️ Gestión de Sensores y Escenarios

La aplicación permite integrar sensores IoT vía MQTT y organizar cámaras y sensores en "Escenarios" (aulas, salas, etc.).

### Características de Sensores

- **Integración MQTT Automática:** Los sensores se detectan mediante suscripción a tópicos específicos.
- **Tipos de Datos:** Soporta temperatura, humedad, CO2, y métricas biométricas (EmotiBit).
- **Dashboard en Tiempo Real:** Visualización de los últimos datos recibidos en el frontend.
- **Umbrales:** Configuración de límites (min/max) por tipo de sensor y escenario.

### Escenarios y Reglas

- **Agrupación Lógica:** Asignación de cámaras y sensores a espacios físicos específicos.
- **Reglas de Grabación:** Automatización de grabaciones basada en condiciones de sensores.
  - *Ejemplo:* Si la temperatura de la "Aula 1" es > 30°C, iniciar grabación automática.
- **Historial de Ejecuciones:** Registro detallado de qué reglas se dispararon y qué acciones realizaron.

### Endpoints de Sensores y Escenarios

- `GET /api/sensors` - Listar todos los sensores detectados/configurados
- `PUT /api/sensors/:id` - Actualizar configuración de sensor
- `GET /api/scenarios` - Obtener todos los escenarios
- `POST /api/scenarios` - Crear nuevo escenario
- `POST /api/scenarios/:id/thresholds` - Configurar umbrales para un escenario

## 🛠️ Instalación

### 1. Instalación del Backend

```bash
cd backend
npm install
```

Generar el cliente Prisma:
```bash
npm run prisma:generate
```

Crear la base de datos y ejecutar migraciones:
```bash
npm run prisma:migrate
```

### 2. Instalación del Frontend

```bash
cd frontend
npm install
```

## 🚀 Uso

### Desarrollar localmente

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

El backend estará disponible en `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

### Scripts disponibles

#### Backend
- `npm run dev` - Ejecutar en modo desarrollo con hot-reload
- `npm start` - Ejecutar en producción
- `npm run prisma:generate` - Generar cliente Prisma
- `npm run prisma:migrate` - Ejecutar migraciones
- `npm run prisma:studio` - Abrir Prisma Studio (interfaz gráfica de BD)

#### Frontend
- `npm run dev` - Ejecutar en modo desarrollo
- `npm run build` - Construir para producción
- `npm run preview` - Previsualizar build de producción
- `npm run lint` - Ejecutar linter

## 📁 Estructura del Proyecto

```
galgo_school_manager_AI/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Esquema de la base de datos
│   │   └── migrations/         # Migraciones de BD
│   ├── src/
│   │   ├── controllers/        # Lógica de negocio
│   │   ├── routes/             # Rutas de la API
│   │   │   ├── replication.js  # Endpoints de replicación
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── replicationService.js  # Servicio de replicación
│   │   │   └── ...
│   │   ├── utils/              # Funciones auxiliares
│   │   └── index.js            # Punto de entrada
│   ├── .env                    # Variables de entorno
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BackupPanel.jsx  # Panel de configuración de backup
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── api.js          # Cliente API con métodos de replicación
│   │   │   └── ...
│   │   ├── App.jsx             # Componente principal
│   │   └── main.jsx            # Punto de entrada
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── docs/
│   ├── REPLICATION_IMPROVEMENTS.md  # Mejoras propuestas
│   └── network-setup.md     # Configuración de red
│
├── scripts/
│   ├── setup-rclone-truenas.sh      # Script de configuración rclone
│   ├── rclone-replication.service.example  # Servicio systemd
│   └── ...
│
└── README.md
```

## 🔌 Endpoints de la API

### Cámaras

- `GET /cameras` - Obtener todas las cámaras
- `GET /cameras/:id` - Obtener cámara por ID
- `POST /cameras` - Crear nueva cámara
- `PUT /cameras/:id` - Actualizar cámara
- `DELETE /cameras/:id` - Eliminar cámara

### Replicación y Backup

- `GET /api/replication/stats` - Estadísticas de replicación
- `POST /api/replication/start` - Iniciar replicación manual
- `POST /api/replication/stop` - Detener replicación
- `GET /api/replication/server-config` - Obtener configuración del servidor
- `POST /api/replication/server-config` - Guardar configuración del servidor
- `POST /api/replication/test-connection` - Probar conexión al servidor

### Ejemplo de solicitud POST

```bash
curl -X POST http://localhost:3000/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cámara Entrada",
    "rtspUrl": "rtsp://192.168.1.100:554/stream",
    "description": "Cámara de entrada principal"
  }'
```

## 🗄️ Modelo de Base de Datos

### Camera
```prisma
{
  id: Int (PRIMARY KEY)
  name: String (UNIQUE)
  rtspUrl: String (UNIQUE)
  description: String?
  isActive: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

### StreamLog
```prisma
{
  id: Int (PRIMARY KEY)
  cameraId: Int (FOREIGN KEY)
  status: String ("success", "failed", "offline")
  message: String?
  createdAt: DateTime
}
```

## 🔧 Variables de Entorno

### Backend (.env)
```
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV=development
MQTT_BROKER_URL=mqtt://localhost:1883

# Credenciales de Cámara (Opcional - Defaults en código)
CAMERA_IP=192.168.8.210
CAMERA_USER=admin
CAMERA_PASS=galgo2526
CAMERA_PORT=554

# Configuración de Replicación (Opcional - Configurable vía API)
REPLICATION_ENGINE=rclone
REPLICATION_HOST=192.168.1.100
REPLICATION_PORT=22
REPLICATION_USER=backupuser
REPLICATION_REMOTE_PATH=/mnt/backups/cameras
REPLICATION_TRANSFERS=4
REPLICATION_RETRIES=10
REPLICATION_VERIFY_HASH=true
```

## 🐳 Docker Deployment

El proyecto incluye configuración para despliegue con Docker y Docker Compose, ideal para Raspberry Pi o servidores.

### Requisitos
- Docker
- Docker Compose

### Despliegue Rápido

1. Clonar el repositorio
2. Crear archivo `.env` en `backend/` (usar `.env.example` como guía)
3. Ejecutar:

```bash
docker-compose up -d
```

Esto iniciará:
- **Backend**: http://localhost:3000
- **Frontend**: http://localhost (Puerto 80)
- **MQTT Broker**: Puerto 1883

### Volúmenes Persistentes
- `backend/prisma`: Base de datos SQLite
- `backend/recordings`: Grabaciones de video
- `backend/media`: Archivos temporales de streaming
- `mosquitto/data`: Persistencia MQTT

## 📦 Dependencias Principales

### Backend
- `express` - Framework web
- `cors` - Middleware para CORS
- `@prisma/client` - Cliente ORM
- `dotenv` - Variables de entorno

### Frontend
- `react` - Librería UI
- `vite` - Build tool
- `axios` - Cliente HTTP

## 🌐 Visualizar Base de Datos

Para ver y gestionar los datos en la base de datos usando Prisma Studio:

```bash
cd backend
npm run prisma:studio
```

Se abrirá en `http://localhost:5555`

## 🔄 Workflow de Desarrollo

1. Configurar servidor de backup:
```bash
# Configurar modo simulación
curl -X POST http://localhost:3000/api/replication/server-config \
  -H "Content-Type: application/json" \
  -d '{"useMock": true, "engine": "rclone"}'
```

2. Crear una cámara vía API:
```bash
curl -X POST http://localhost:3000/cameras \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Camera","rtspUrl":"rtsp://example.com/stream"}'
```

3. Acceder a `http://localhost:5173`
4. La cámara aparecerá en el listado
5. Seleccionar cámara para visualizar stream
6. Ir a la pestaña "Replicación" para configurar y monitorear backups

## 🚢 Deployment

### Build para producción

**Backend:**
```bash
cd backend
npm install --production
```

**Frontend:**
```bash
cd frontend
npm run build
```

Los archivos estáticos compilados estarán en `frontend/dist`

## 📝 Notas Importantes

- La visualización de streams RTSP requiere un proxy o servidor que maneje el protocolo RTSP
- Se puede usar `ffmpeg` o `GStreamer` para convertir RTSP a HLS/DASH
- Por defecto, la app usa placeholders para las imágenes del stream

## 🌐 Configuración de Red para Sensores

Si los sensores y cámaras están conectados a través de un router GL.iNet (OpenWRT), es necesario configurar el routing para acceder a ellos desde Ubuntu.

### Topología de Red

```
Ubuntu (192.168.50.1) ──► GL.iNet Router (192.168.50.2/192.168.8.1) ──► Sensores (192.168.8.x)
```

### Configuración Rápida

```bash
# Ejecutar script de configuración automática
sudo ./scripts/setup-sensor-network.sh --install
```

### Configuración Manual

1. **Añadir ruta estática en Ubuntu:**
   ```bash
   sudo ip route add 192.168.8.0/24 via 192.168.50.2 dev <interfaz_usb>
   ```

2. **Configurar firewall en GL.iNet:**
   - Acceder a LuCI: `http://192.168.50.2`
   - Network → Firewall → Custom Rules
   - Añadir reglas FORWARD y NAT bypass

Para más detalles, consulta la [documentación completa](docs/network-setup.md).

### Verificar Conectividad

```bash
ping 192.168.8.210  # Cámara
ffprobe rtsp://admin:galgo2526@192.168.8.210:554/stream1  # Stream RTSP
```

## 🚀 Mejoras Implementadas y Futuras - Sistema de Replicación

El proyecto incluye funcionalidades implementadas y un roadmap de mejoras adicionales para el sistema de replicación y sincronización de archivos.

### ✅ Funcionalidades Implementadas

- ✅ **Persistencia de configuración del servidor** - Configuración guardada en base de datos Prisma
- ✅ **Interfaz de configuración en frontend** - Panel completo para configurar servidor de backup
- ✅ **Modo simulación** - Configuración mock para desarrollo sin servidor real
- ✅ **Sistema de hash y verificación de integridad** - Verificación opcional con SHA256
- ✅ **Reintentos con backoff exponencial** - Reintentos inteligentes para transferencias fallidas
- ✅ **Transferencias en paralelo** - Múltiples archivos simultáneos
- ✅ **Monitoreo básico** - Estadísticas de replicación en tiempo real

### 🔄 Mejoras Futuras (Fases 2-4)
- 🔄 **Sincronización bidireccional** - Recuperar archivos faltantes desde servidor externo
- 🔄 **Sistema de prioridades** - Transferir primero archivos importantes o recientes
- 🔄 **Política de limpieza automática** - Eliminar archivos antiguos cuando se alcanza umbral de espacio
- 🔄 **Dashboard de estado básico** - Monitoreo visual del estado de replicación

### Fase 3: Optimización (Semanas 5-6)
- ⚡ **Transferencias en paralelo** - Múltiples archivos simultáneos para aprovechar ancho de banda
- ⚡ **Compresión opcional** - Reducir tiempo de transferencia para archivos grandes
- ⚡ **Métricas y estadísticas** - KPIs de rendimiento y disponibilidad
- ⚡ **Dashboard avanzado** - Interfaz completa de monitoreo en tiempo real

### Fase 4: Seguridad (Semanas 7-8)
- 🔒 **Validación de fingerprints** - Verificar identidad de servidores remotos
- 🔒 **Rotación de credenciales** - Actualización automática de claves SSH
- 🔒 **Auditoría completa** - Trazabilidad total de operaciones
- 🔒 **Alertas automáticas** - Notificaciones de eventos críticos

### Características Clave
- **Verificación de integridad** con hash SHA256
- **Reintentos inteligentes** con backoff exponencial
- **Monitoreo de capacidad** remota automática
- **Sincronización bidireccional** para recuperación de datos
- **Transferencias paralelas** para máximo rendimiento
- **Compresión opcional** para archivos grandes
- **Sistema de prioridades** para archivos críticos
- **Dashboard en tiempo real** con métricas detalladas

Para más detalles sobre la implementación y especificaciones técnicas, consulta el documento completo en [`docs/REPLICATION_IMPROVEMENTS.md`](docs/REPLICATION_IMPROVEMENTS.md).

---

## 🤝 Contribuir

Este es un proyecto base. Siéntete libre de modificar y mejorar según tus necesidades.

## 📄 Licencia

Este proyecto está disponible bajo licencia MIT.

## 📞 Soporte

Para más información sobre:
- **React + Vite**: https://vitejs.dev/guide/
- **Prisma**: https://www.prisma.io/docs/
- **Express**: https://expressjs.com/

---

**¡Disfruta visualizando tus cámaras RTSP!** 🎉
