# 🎥 Video Recording Optimization System

Complete enterprise-grade video recording optimization system for the Galgo School Manager AI project.

## 📋 Table of Contents

- [Overview](#overview)
- [Phase 1: Storage Management](#phase-1-storage-management)
- [Phase 2: Resilient Recording](#phase-2-resilient-recording)
- [Phase 3: Post-Processing](#phase-3-post-processing)
- [Phase 4: Performance Optimization](#phase-4-performance-optimization)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [MQTT Events](#mqtt-events)
- [Usage Guide](#usage-guide)

## Overview

This system provides four integrated optimization phases:

1. **Storage Management**: Automated disk monitoring and cleanup
2. **Resilient Recording**: Auto-reconnect and health monitoring
3. **Post-Processing**: Thumbnails, compression, and clip extraction
4. **Performance Optimization**: Hardware acceleration and adaptive encoding

## Phase 1: Storage Management

### Features

- **Automatic Disk Monitoring**: Continuous monitoring of available storage
- **Intelligent Cleanup**: Age and priority-based deletion of old recordings
- **Storage Alerts**: MQTT notifications for low disk space
- **Retention Policies**: Configurable retention periods per scenario

### Backend Service

**File**: `backend/src/services/storageManager.js`

**Key Methods**:
- `start()` - Initialize storage monitoring
- `getDiskInfo()` - Get current disk usage
- `cleanup()` - Manual cleanup trigger
- `setRetentionPolicy(scenario, days)` - Set retention period

**Configuration** (`backend/src/config.js`):
```javascript
storage: {
  warningThreshold: 75,     // % disk usage for warning
  criticalThreshold: 90,    // % disk usage for critical
  autoCleanThreshold: 85,   // % disk usage to trigger auto-cleanup
  defaultRetentionDays: 30, // Default retention period
  minFreeSpaceGB: 10,       // Minimum free space required
  checkIntervalMinutes: 5   // Check interval
}
```

### API Endpoints

**Base URL**: `/api/storage`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Get storage status |
| GET | `/summary` | Get detailed summary |
| GET | `/config` | Get configuration |
| PUT | `/config` | Update configuration |
| GET | `/recordings` | List recordings |
| POST | `/cleanup` | Trigger cleanup |
| POST | `/check` | Check disk space |
| PUT | `/retention/:scenario` | Set retention policy |
| DELETE | `/scenario/:scenario` | Delete scenario recordings |
| DELETE | `/camera/:cameraId` | Delete camera recordings |

### Frontend Component

**File**: `frontend/src/components/StorageManager.jsx`

**Location**: Configuration → Almacenamiento tab

**Features**:
- Real-time disk usage display
- Retention policy management
- Recording browser with filters
- Manual cleanup controls

## Phase 2: Resilient Recording

### Features

- **Auto-Reconnect**: Automatic reconnection with exponential backoff
- **Health Monitoring**: Continuous process health checks
- **Graceful Shutdown**: Proper cleanup on system shutdown
- **MQTT Events**: Real-time recording status updates

### Backend Service

**File**: `backend/src/services/recordingManager.js`

**Key Methods**:
- `startRecording(cameraId, cameraName, rtspUrl, options)` - Start recording
- `stopRecording(cameraId)` - Stop recording
- `isRecording(cameraId)` - Check recording status
- `getStats(cameraId)` - Get recording statistics
- `gracefulStop()` - Shutdown all recordings

**Configuration**:
```javascript
{
  autoReconnect: true,
  reconnectDelay: 5000,      // Initial delay between retries
  maxReconnectAttempts: 10,  // Max retries (0 = infinite)
  healthCheckInterval: 30000, // Health check interval
  staleTimeout: 60000,       // Consider dead if no activity
  segmentTime: 3600          // Segment duration (1 hour)
}
```

### API Endpoints

**Base URL**: `/api/recordings`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Get all recordings status |
| GET | `/:cameraId/stats` | Get recording statistics |
| POST | `/start` | Start recording |
| POST | `/:cameraId/stop` | Stop recording |
| POST | `/stop-all` | Stop all recordings |
| PUT | `/config` | Update configuration |
| GET | `/:cameraId/is-recording` | Check if recording |

### Frontend Component

**File**: `frontend/src/components/RecordingDashboard.jsx`

**Location**: Main Dashboard tab

**Features**:
- Real-time recording status
- Health indicators
- Reconnection statistics
- Manual recording controls

### MQTT Events

- `camera_rtsp/recordings/started` - Recording started
- `camera_rtsp/recordings/stopped` - Recording stopped
- `camera_rtsp/recordings/failed` - Recording failed
- `camera_rtsp/recordings/abandoned` - Recording abandoned after max retries

## Phase 3: Post-Processing

### Features

- **Thumbnail Generation**: Automatic video thumbnails
- **Video Compression**: Hardware-accelerated compression
- **Clip Extraction**: Extract specific time ranges
- **Task Queue**: Priority-based processing queue

### Backend Service

**File**: `backend/src/services/videoProcessor.js`

**Key Methods**:
- `generateThumbnail(videoPath, options)` - Create thumbnail
- `compressVideo(inputPath, outputPath, options)` - Compress video
- `extractClip(videoPath, startTime, duration, options)` - Extract clip
- `batchGenerateThumbnails(options)` - Batch thumbnail generation
- `compressOldVideos(olderThanDays, options)` - Compress old videos

**Configuration**:
```javascript
{
  thumbnailWidth: 320,
  thumbnailHeight: 180,
  thumbnailFormat: 'jpg',
  thumbnailQuality: 80,
  compressionCRF: 23,        // Quality (18-28, lower = better)
  compressionPreset: 'medium', // Speed preset
  maxConcurrentTasks: 2      // Parallel tasks
}
```

### API Endpoints

**Base URL**: `/api/processing`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Get queue status |
| GET | `/config` | Get configuration |
| PUT | `/config` | Update configuration |
| POST | `/thumbnail` | Generate thumbnail |
| POST | `/thumbnails/batch` | Batch generate |
| GET | `/thumbnails` | List thumbnails |
| POST | `/compress` | Compress video |
| POST | `/compress/old` | Compress old videos |
| POST | `/clip` | Extract clip |
| GET | `/clips` | List clips |
| POST | `/video-info` | Get video information |
| DELETE | `/task/:taskId` | Cancel task |

### Frontend Component

**File**: `frontend/src/components/VideoProcessing.jsx`

**Location**: Configuration → Procesamiento tab

**Features**:
- Task queue monitoring
- Thumbnail gallery
- Clip extractor
- Batch compression tools
- Progress tracking

## Phase 4: Performance Optimization

### Features

- **Hardware Detection**: Auto-detect GPU encoders
- **Frame Caching**: Intelligent caching with TTL
- **Adaptive Profiles**: Dynamic profile switching
- **Performance Metrics**: Real-time monitoring

### Backend Services

#### HardwareDetector

**File**: `backend/src/services/hardwareDetector.js`

**Supported Encoders**:
- NVIDIA NVENC (`h264_nvenc`)
- Intel VAAPI (`h264_vaapi`)
- AMD AMF (`h264_amf`)
- Intel QuickSync (`h264_qsv`)
- Raspberry Pi (`h264_v4l2m2m`, `h264_omx`)
- CPU fallback (`libx264`)

**Quality Profiles**:
- `high` - Best quality for archival
- `balanced` - Good quality/performance (default)
- `performance` - Fast encoding
- `lowlatency` - Real-time streaming

**Key Methods**:
- `detect()` - Detect available encoders
- `benchmark()` - Benchmark encoding speed
- `getFFmpegArgs(encoder, profile)` - Get FFmpeg arguments

#### FrameCache

**File**: `backend/src/services/frameCache.js`

**Key Methods**:
- `start()` - Start cache service
- `cacheFrame(cameraId, frameData, resolution)` - Cache frame
- `getFrame(cameraId, resolution)` - Retrieve frame
- `getStats()` - Get cache statistics

**Configuration**:
```javascript
{
  maxFramesPerCamera: 30,      // Buffer size
  frameTTL: 5000,              // TTL in ms
  cleanupInterval: 10000,      // Cleanup interval
  enableMultiResolution: true, // Multi-resolution support
  resolutions: ['original', '720p', '480p', '240p']
}
```

#### PerformanceManager

**File**: `backend/src/services/performanceManager.js`

**Key Methods**:
- `initialize()` - Initialize all services
- `getStatus()` - Get complete status
- `setProfile(profile)` - Change encoding profile
- `setHwAccel(enabled)` - Toggle hardware acceleration
- `getAdaptiveConfig(networkSpeed)` - Get adaptive config

**Configuration**:
```javascript
{
  cpuHighThreshold: 80,      // Switch to performance profile
  cpuLowThreshold: 40,       // Switch to high quality
  metricsInterval: 5000,     // Metrics collection interval
  adaptiveMode: true         // Enable adaptive switching
}
```

### API Endpoints

**Base URL**: `/api/performance`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Get full system status |
| GET | `/hardware` | Get hardware info |
| POST | `/detect` | Re-detect hardware |
| POST | `/benchmark` | Run benchmark |
| GET | `/metrics` | Get real-time metrics |
| PUT | `/profile` | Change profile |
| PUT | `/hwaccel` | Toggle HW acceleration |
| GET | `/config` | Get configuration |
| PUT | `/config` | Update configuration |
| GET | `/cache` | Get cache stats |
| POST | `/adaptive-config` | Get adaptive config |

### Frontend Component

**File**: `frontend/src/components/PerformanceDashboard.jsx`

**Location**: Configuration → Rendimiento tab

**Features**:
- Hardware information display
- Real-time CPU/Memory gauges
- Encoding profile selector
- Hardware acceleration toggle
- Benchmark runner
- Cache statistics
- Configuration panel

## Configuration

### Environment Variables

Create `.env` in backend directory:

```bash
# Storage Configuration
STORAGE_WARNING_THRESHOLD=75
STORAGE_CRITICAL_THRESHOLD=90
STORAGE_AUTOCLEAN_THRESHOLD=85
STORAGE_RETENTION_DAYS=30
STORAGE_MIN_FREE_GB=10
STORAGE_CHECK_INTERVAL_MINUTES=5

# MQTT Configuration
MQTT_BROKER_URL=mqtt://localhost:1883

# Database
DATABASE_URL="file:./dev.db"

# Server
PORT=3000
NODE_ENV=development
```

### Prisma Configuration

No schema changes required for this feature. The system uses existing `Camera` and `Recording` models.

## MQTT Events

### Storage Events

```javascript
// Low disk space alert
Topic: camera_rtsp/system/storage/alert
Payload: {
  level: "warning" | "critical",
  previousLevel: string,
  diskUsage: number,
  available: number,
  availableFormatted: string,
  timestamp: string
}

// Cleanup completed
Topic: camera_rtsp/system/storage/cleanup
Payload: {
  deletedFiles: number,
  freedSpace: number,
  freedSpaceFormatted: string,
  timestamp: string
}
```

### Recording Events

```javascript
// Recording started
Topic: camera_rtsp/recordings/started
Payload: {
  cameraId: number,
  cameraName: string,
  rtspUrl: string,
  timestamp: string
}

// Recording stopped
Topic: camera_rtsp/recordings/stopped
Payload: {
  cameraId: number,
  cameraName: string,
  reason: string,
  timestamp: string
}

// Recording failed
Topic: camera_rtsp/recordings/failed
Payload: {
  cameraId: number,
  cameraName: string,
  reason: string,
  attempt: number,
  timestamp: string
}

// Recording abandoned
Topic: camera_rtsp/recordings/abandoned
Payload: {
  cameraId: number,
  cameraName: string,
  totalAttempts: number,
  timestamp: string
}
```

### Processing Events

```javascript
// Task completed
Topic: camera_rtsp/processing/completed
Payload: {
  taskId: string,
  type: string,
  result: object,
  timestamp: string
}

// Task failed
Topic: camera_rtsp/processing/failed
Payload: {
  taskId: string,
  type: string,
  error: string,
  timestamp: string
}

// Compression progress
Topic: camera_rtsp/processing/progress
Payload: {
  taskId: string,
  type: string,
  progress: number,
  timestamp: string
}
```

## Usage Guide

### Starting the System

1. **Install dependencies**:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Run database migrations**:
   ```bash
   cd backend && npm run prisma:migrate
   ```

3. **Start backend**:
   ```bash
   cd backend && npm run dev
   ```

4. **Start frontend**:
   ```bash
   cd frontend && npm run dev
   ```

### Accessing Features

#### Storage Management

1. Navigate to **Configuration** tab
2. Click **Almacenamiento** subtab
3. View disk usage and configure retention policies
4. Browse and manage recordings

#### Recording Monitoring

1. Navigate to **Dashboard** tab
2. View **Estado de Grabaciones** section
3. Monitor active recordings and health status
4. Start/stop recordings as needed

#### Video Processing

1. Navigate to **Configuration** tab
2. Click **Procesamiento** subtab
3. Generate thumbnails, compress videos, or extract clips
4. Monitor processing queue

#### Performance Optimization

1. Navigate to **Configuration** tab
2. Click **Rendimiento** subtab
3. View hardware capabilities
4. Select encoding profile
5. Run benchmarks
6. View cache statistics

### API Examples

#### Start Recording

```bash
curl -X POST http://localhost:3000/api/recordings/start \
  -H "Content-Type: application/json" \
  -d '{
    "cameraId": 1,
    "cameraName": "Camera 1",
    "rtspUrl": "rtsp://admin:pass@192.168.1.100/stream",
    "scenarioId": 1
  }'
```

#### Generate Thumbnail

```bash
curl -X POST http://localhost:3000/api/processing/thumbnail \
  -H "Content-Type: application/json" \
  -d '{
    "videoPath": "/path/to/video.mp4",
    "timestamp": "00:00:10",
    "width": 320,
    "height": 180
  }'
```

#### Check Storage Status

```bash
curl http://localhost:3000/api/storage/status
```

#### Get Performance Status

```bash
curl http://localhost:3000/api/performance/status
```

### Best Practices

1. **Storage Management**:
   - Set appropriate retention policies for different scenarios
   - Monitor disk usage regularly
   - Enable auto-cleanup for production systems

2. **Recording**:
   - Use appropriate segment times for your use case
   - Monitor reconnection statistics
   - Ensure network stability for critical recordings

3. **Processing**:
   - Use batch operations for multiple files
   - Schedule heavy processing during off-peak hours
   - Monitor task queue to avoid backlog

4. **Performance**:
   - Run hardware detection on first setup
   - Use hardware acceleration when available
   - Adjust profiles based on system load
   - Monitor cache hit rates

## Troubleshooting

### Common Issues

1. **High CPU usage during recording**:
   - Enable hardware acceleration
   - Switch to performance profile
   - Reduce number of concurrent recordings

2. **Storage fills up quickly**:
   - Lower retention days
   - Enable compression of old videos
   - Reduce recording quality/bitrate

3. **Frequent reconnections**:
   - Check network stability
   - Increase reconnect delay
   - Verify camera RTSP URL

4. **Processing queue backlog**:
   - Increase maxConcurrentTasks
   - Use hardware acceleration
   - Process during off-peak hours

## Support

For issues or questions:
- Check server logs in backend console
- Review MQTT events for system alerts
- Inspect browser console for frontend errors
- Review API responses for error details

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-14  
**Author**: Galgo School Manager AI Team
