# 🚀 Quick Start Guide - Video Recording Optimization

This guide will help you get started with the Video Recording Optimization System quickly.

## Prerequisites

- Node.js 16+ installed
- FFmpeg installed on system
- MQTT broker running (optional, for events)
- Sufficient disk space for recordings

## Installation

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

Create `backend/.env`:

```bash
# Copy example
cp backend/.env.example backend/.env

# Edit with your settings
nano backend/.env
```

Minimal configuration:
```bash
DATABASE_URL="file:./dev.db"
PORT=3000
MQTT_BROKER_URL=mqtt://localhost:1883
```

### 3. Initialize Database

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start Services

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Access the application at `http://localhost:5173`

## First Steps

### 1. Add a Camera

1. Go to **Cámaras** tab
2. Click **+** button
3. Fill in camera details:
   - Name: "Test Camera"
   - RTSP URL: `rtsp://admin:password@192.168.1.100:554/stream`
   - Description: Optional
4. Click **Agregar Cámara**

### 2. Configure Storage

1. Go to **Configuración** → **Almacenamiento**
2. Set retention policy (e.g., 30 days)
3. Configure disk thresholds:
   - Warning: 75%
   - Critical: 90%
4. Save configuration

### 3. Start Recording

1. Go to **Dashboard**
2. Find **Estado de Grabaciones** section
3. Camera should auto-start recording
4. Monitor status in real-time

### 4. Optimize Performance

1. Go to **Configuración** → **Rendimiento**
2. Click **Detectar Hardware**
3. View detected encoders
4. Enable hardware acceleration if available
5. Select appropriate profile:
   - `balanced` - Recommended for most cases
   - `performance` - For resource-constrained systems
   - `high` - For archival quality

### 5. Process Videos

1. Go to **Configuración** → **Procesamiento**
2. Generate thumbnails:
   - Click **Generar Thumbnails**
   - Select time batch or all recordings
3. View thumbnails in gallery
4. Extract clips as needed

## Quick Tests

### Test 1: Check System Status

```bash
# Backend health
curl http://localhost:3000/api/health

# Storage status
curl http://localhost:3000/api/storage/status

# Performance status
curl http://localhost:3000/api/performance/status
```

### Test 2: Verify Recording

```bash
# Check if recording
curl http://localhost:3000/api/recordings/status

# View recording stats
curl http://localhost:3000/api/recordings/1/stats
```

### Test 3: Generate Thumbnail

```bash
curl -X POST http://localhost:3000/api/processing/thumbnail \
  -H "Content-Type: application/json" \
  -d '{
    "videoPath": "/path/to/recording.mp4",
    "timestamp": "00:00:05"
  }'
```

## Common Configurations

### High Performance Setup

```javascript
// backend/src/config.js
storage: {
  warningThreshold: 80,
  criticalThreshold: 95,
  autoCleanThreshold: 90,
  checkIntervalMinutes: 10
}
```

Performance profile: `performance`  
Hardware acceleration: Enabled

### High Quality Archival

```javascript
storage: {
  defaultRetentionDays: 90,
  minFreeSpaceGB: 50
}
```

Performance profile: `high`  
Compression: Enabled for videos older than 7 days

### Resource Constrained (Raspberry Pi)

```javascript
storage: {
  defaultRetentionDays: 7,
  autoCleanThreshold: 80
}
```

Performance profile: `performance`  
Max concurrent tasks: 1  
Use `h264_v4l2m2m` or `h264_omx` encoder

## Monitoring

### Check Logs

**Backend logs**:
- Look for `✅` success messages
- Monitor reconnection attempts
- Check MQTT event publications

**Frontend console**:
- Network requests to API
- Component errors
- State updates

### MQTT Events

Subscribe to all events:
```bash
mosquitto_sub -h localhost -t "camera_rtsp/#" -v
```

Storage alerts:
```bash
mosquitto_sub -h localhost -t "camera_rtsp/system/storage/#" -v
```

Recording events:
```bash
mosquitto_sub -h localhost -t "camera_rtsp/recordings/#" -v
```

### Performance Metrics

View in UI:
1. **Dashboard** → **Estado de Grabaciones** - Recording health
2. **Configuración** → **Rendimiento** - System metrics
3. **Configuración** → **Almacenamiento** - Disk usage

## Troubleshooting

### Recording not starting

1. Check camera RTSP URL
2. Verify network connectivity
3. Check FFmpeg is installed: `ffmpeg -version`
4. Review backend logs for errors

### High disk usage

1. Lower retention days
2. Enable auto-cleanup
3. Compress old recordings:
   - Go to **Configuración** → **Procesamiento**
   - Click **Comprimir Videos Antiguos**
   - Select days threshold

### Poor performance

1. Enable hardware acceleration
2. Switch to `performance` profile
3. Reduce concurrent tasks
4. Check system resources: `htop`

### Storage alerts not appearing

1. Verify MQTT broker is running
2. Check broker URL in `.env`
3. Subscribe manually to test:
   ```bash
   mosquitto_sub -h localhost -t "camera_rtsp/#"
   ```

## Next Steps

- Read full documentation: `docs/VIDEO_RECORDING_OPTIMIZATION.md`
- Configure retention policies per scenario
- Set up automated compression schedules
- Integrate with external monitoring systems
- Configure backup/replication

## Support

Issues or questions:
- Check backend console for errors
- Review MQTT events
- Inspect browser DevTools console
- Check API responses

---

**Happy Recording! 🎥**
