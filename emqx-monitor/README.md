# 🚀 Argus - Monitor de Mensajes MQTT

Sistema completo de monitoreo con dashboard React moderno usando Tailwind CSS y diseño con sidebar.

## ✨ Características

- **🎨 Diseño Moderno** - Tema oscuro con sidebar lateral y efectos glassmorphism
- **📊 Dashboard Interactivo** - Estadísticas del cluster con animaciones y gradientes
- **📡 Monitor de mensajes MQTT** - Visualización en tiempo real con WebSocket
- **� Dashboard VR** - Visualización especializada de datos de realidad virtual
- **�🧭 Navegación por pestañas** - Sidebar con navegación intuitiva
- **📱 Responsive Design** - Adaptable a móviles y desktop
- **🔄 Auto-refresco** - Datos actualizados cada 10 segundos
- **🌐 WebSocket MQTT** - Conexión directa al broker para mensajes instantáneos

## 🚀 Inicio Rápido

### 1. Iniciar EMQX
```bash
cd emqx_config_state
docker-compose up -d
```

### 2. Iniciar el Dashboard
```bash
cd emqx-monitor
npm install
npm run dev
```
Accede a: `http://localhost:5173`

### 3. Generar Datos de Prueba
```bash
cd virtual_sensor_publisher
npm install
npm run multi  # 4 clientes con 11 sensores cada uno
```

## 📱 Uso del Monitor de Mensajes

### Conectar al Broker MQTT
1. El monitor se conecta automáticamente al iniciar
2. Verifica el estado de conexión (🟢 Conectado / 🔴 Desconectado)

### 🎛️ Modos de Monitoreo

#### **Modo Auto-Monitor (Recomendado)**
- **Activar**: Usa el toggle "🔄 Auto-Monitor" en la parte superior
- **Función**: Monitorea automáticamente TODOS los tópicos del broker (`#`)
- **Ventajas**: Captura todos los mensajes sin configuración manual
- **Visual**: Indicador púrpura con animación cuando está activo
- **Controles**: Los selectores manuales se deshabilitan automáticamente

#### **Modo Manual (Avanzado)**
- **Suscripción específica**: Elige tópicos individuales o usa wildcards
- **Selector predefinido**: Elige de tópicos VR comunes (`vr/status/+`, etc.)
- **Tópico personalizado**: Escribe cualquier tópico (ej: `vr/#`)
- **Wildcards**: Usa `+` para un nivel o `#` para múltiples niveles

### Visualización de Mensajes
- **Último mensaje**: Muestra el mensaje más reciente recibido
- **Historial**: Lista completa de mensajes con timestamp
- **Formato JSON**: Mensajes formateados para fácil lectura
- **Auto-monitor**: Muestra TODOS los mensajes cuando está activo

### Filtros Avanzados
- **Filtro de texto**: Busca en el contenido de los mensajes
- **Filtro por ID**: Filtra mensajes de un dispositivo específico (extrae ID del topic)
- **Combinación**: Ambos filtros se pueden usar simultáneamente

## 🎯 Tópicos Disponibles

### Aplicación VR - Tópicos Individuales

```text
vr/status/+          # Estado de dispositivos VR
vr/commands/+        # Comandos enviados a dispositivos VR
vr/datos_reloj/+     # Datos del reloj/sincronización
vr/acciones_json/+   # Acciones en formato JSON
vr/wandering_data/+  # Datos de wandering/movimiento libre
vr/head_movement/+   # Movimiento de cabeza
```

### Wildcards Útiles

```text
vr/+         # Todos los tipos de datos VR
vr/#         # Todos los sub-tópicos VR
#            # Todos los tópicos del broker
```

## 🥽 Dashboard VR

### Visualización Especializada

El **Dashboard VR** proporciona una visualización dedicada y organizada de todos los datos de realidad virtual:

#### **Estado de Dispositivos**
- **Vista general**: Estado de conexión, batería, temperatura y uptime
- **Indicadores visuales**: Colores por estado (verde=en línea, rojo=fuera de línea)
- **Métricas en tiempo real**: Nivel de batería, fuerza de conexión, temperatura

#### **Movimiento de Cabeza**
- **Tracking 3D**: Posición y rotación de la cabeza (X, Y, Z, Yaw, Pitch, Roll)
- **Eye-tracking**: Estado de ojos abiertos/cerrados con coordenadas de mirada
- **Confianza**: Nivel de confianza del sistema de seguimiento

#### **Acciones del Usuario**
- **Historial de acciones**: Movimientos, saltos, interacciones
- **Coordenadas 3D**: Posición exacta de cada acción
- **Métricas de rendimiento**: Duración, velocidad, éxito/error

#### **Datos de Wandering**
- **Navegación libre**: Posición 3D y orientación
- **Sensores ambientales**: Obstáculos, nivel de luz, nivel de sonido
- **Vectores de movimiento**: Velocidad, dirección, aceleración

#### **Comandos y Sincronización**
- **Comandos del sistema**: Start/stop session, calibración, actualizaciones
- **Sincronización de reloj**: NTP sync, drift de tiempo, precisión
- **Prioridades**: Alta/normal para gestión de comandos

### Filtros Avanzados

- **Filtro por dispositivo**: Selecciona un dispositivo específico (VR001, VR002, etc.)
- **Vista unificada**: Todos los tipos de datos en una sola pantalla
- **Auto-refresh**: Actualización automática de datos en tiempo real

### Navegación

1. **Abrir Dashboard** → http://localhost:5173
2. **Seleccionar "Dashboard VR"** en el sidebar (icono 🥽)
3. **Usar filtros** para enfocarte en dispositivos específicos
4. **¡Visualiza todos los datos VR en tiempo real!**

## 🛠️ Desarrollo

## �️ Desarrollo

### Estructura del Proyecto
```
emqx-monitor/
├── src/
│   ├── components/     # Componentes React
│   │   ├── MessageMonitor.jsx    # Monitor de mensajes MQTT
│   │   ├── ClusterStats.jsx      # Estadísticas del cluster
│   │   ├── ClientsList.jsx       # Lista de clientes
│   │   ├── SubscriptionsList.jsx # Lista de suscripciones
│   │   └── NodesList.jsx         # Lista de nodos
│   ├── hooks/
│   │   ├── useEmqxData.js        # Hook para API REST
│   │   └── useMQTT.js            # Hook para MQTT WebSocket
│   ├── services/
│   │   ├── emqxApi.js            # Cliente API REST
│   │   └── mqttClient.js         # Cliente MQTT WebSocket
│   └── App.jsx                   # Componente principal
├── tailwind.config.js            # Configuración Tailwind
└── postcss.config.js             # Configuración PostCSS
```

### Tecnologías
- **React 18** - Framework frontend
- **Vite** - Build tool ultrarrápido
- **Tailwind CSS** - Framework CSS utility-first
- **Axios** - Cliente HTTP para API REST
- **MQTT.js** - Cliente MQTT para WebSocket
- **EMQX 5.7** - Broker MQTT

## 🔧 Configuración

### Variables de Entorno (.env.local)
```env
# API EMQX
VITE_EMQX_API_KEY=334debcfbdc435a8
VITE_EMQX_API_SECRET=hC5Tik9CQUZs39CmDzMSi5uoILanHz4lBLl5I7KseDcKG

# MQTT (en mqttClient.js)
MQTT_BROKER=ws://localhost:8083/mqtt
MQTT_USERNAME=usuario
MQTT_PASSWORD=usuario1234
```

## 📊 API Endpoints

### REST API (puerto 18083)
- `GET /api/v5/stats` - Estadísticas del cluster
- `GET /api/v5/clients` - Lista de clientes
- `GET /api/v5/subscriptions` - Lista de suscripciones
- `GET /api/v5/nodes` - Lista de nodos
- `GET /api/v5/topics` - Lista de tópicos
- `GET /api/v5/routes` - Rutas de tópicos

### WebSocket MQTT (puerto 8083)
- Conexión: `ws://localhost:8083/mqtt`
- Protocolo: MQTT over WebSocket
- Autenticación: Usuario/contraseña

## 🧪 Pruebas

### Ejecutar Todas las APIs
```bash
./test_emqx_api.sh
```

### Comandos curl Individuales
```bash
# Ver comandos disponibles
cat curl_commands.txt
```

## 🚀 Producción

### Configuración Docker
```bash
cd emqx_config_state
docker-compose -f docker-compose.prod.yml up -d
```

### Build de Producción
```bash
cd emqx-monitor
npm run build
npm run preview
```

## 📝 Notas de Desarrollo

- **Tailwind CSS**: Todas las clases están purgadas en producción
- **MQTT Connection**: Reconexión automática en caso de fallo
- **Real-time Updates**: API polling cada 10 segundos + MQTT para mensajes
- **Error Handling**: Manejo robusto de errores de conexión
- **Responsive**: Diseño adaptativo para móviles y desktop

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

---

**Argus** - Sistema de monitoreo MQTT completo y moderno 🚀

### Build para Producción

```bash
npm run build
```

La salida estará en `dist/`

### Preview de Build

```bash
npm run preview
```

## 📡 API de EMQX Usada

El proyecto consume los siguientes endpoints de la API REST de EMQX v5:

- `GET /api/v5/stats` - Estadísticas generales del cluster
- `GET /api/v5/clients` - Lista de clientes conectados
- `GET /api/v5/subscriptions` - Lista de suscripciones
- `GET /api/v5/nodes` - Información de nodos del cluster

## 🔐 Autenticación

La aplicación utiliza autenticación básica HTTP con las credenciales configuradas en `.env.local`. Asegúrate de que:

1. El usuario EMQX tenga permisos de lectura en la API
2. Las credenciales coincidan con tu `docker-compose.yml`

## 📱 Estructura del Proyecto

```
src/
├── components/           # Componentes React
│   ├── ClusterStats.jsx
│   ├── ClientsList.jsx
│   ├── SubscriptionsList.jsx
│   └── NodesList.jsx
├── hooks/               # Custom hooks
│   └── useEmqxData.js
├── services/            # Servicios de API
│   └── emqxApi.js
├── App.jsx
├── main.jsx
└── index.css
```

## 🔄 Cómo Funciona

1. El hook `useEmqxData` se encarga de:
   - Conectarse a la API de EMQX
   - Obtener datos de clientes, suscripciones y nodos
   - Refrescar los datos cada 10 segundos
   - Manejar errores de conexión

2. Los componentes se actualizan reactivamente cuando los datos cambian

3. El usuario puede hacer clic en "Actualizar" para refrescar manualmente

## 🐛 Troubleshooting

### Error: "Cannot connect to EMQX"

1. Verifica que EMQX esté corriendo: `docker ps`
2. Verifica la URL de la API en `.env.local`
3. Verifica las credenciales en `docker-compose.yml`
4. Comprueba la conectividad: `curl -u admin:admin1234 http://localhost:18083/api/v5/stats`

### Error: CORS

Si tienes errores de CORS, considera usar un proxy o configurar EMQX con headers CORS apropiados.

## 📄 Licencia

Proyecto Argus 2025
