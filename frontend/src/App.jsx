import { useState, useEffect } from 'react'
import './App.css'
import CameraList from './components/CameraList'
import WebRTCViewer from './components/WebRTCViewer'
import CameraModal from './components/CameraModal'
import ConfirmModal from './components/ConfirmModal'
import SensorsDashboard from './components/SensorsDashboard'
import RulesManager from './components/RulesManager'
import DashboardSummary from './components/DashboardSummary'
import ScenarioManager from './components/ScenarioManager'
import SensorManager from './components/SensorManager'
import ReplicationStats from './components/ReplicationStats'
import ReplicationConfig from './components/ReplicationConfig'
import api from './services/api'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { RecordingProvider, useRecording } from './contexts/RecordingContext'
import { MQTTProvider } from './contexts/MQTTContext'
import { ScenarioProvider, useScenario } from './contexts/ScenarioContext'

// Componente Header separado
function AppHeader({ serverStatus, activeRecordingsCount, theme, toggleTheme, activeTab, setActiveTab }) {
  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { id: 'cameras', label: '📹 Cámaras', icon: '📹' },
    { id: 'rules', label: '⚙️ Reglas', icon: '⚙️' },
    { id: 'config', label: '🏫 Configuración', icon: '🏫' }
  ]

  return (
    <header className="bg-gray-50 dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div>
            <h1 className="text-2xl font-bold gradient-text">🐕 Galgo-Hub - School</h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">Visor y grabador de transmisiones</span>
          </div>
          <div className="flex items-center space-x-6">
            <span className={`live-indicator ${serverStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}>
              {serverStatus === 'online' ? '🟢 En línea' : '🔴 Fuera de línea'}
            </span>
            {activeRecordingsCount > 0 && (
              <span className="live-indicator bg-red-600 animate-pulse">
                🔴 {activeRecordingsCount} Grabando
              </span>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              title={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>

        {/* Tabs Navigation - Simplificado a 4 tabs */}
        <div className="flex space-x-1 border-t border-gray-200 dark:border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

// Componente para el contenido de Configuración
function ConfigurationContent({ configSubTab, setConfigSubTab }) {
  const configTabs = [
    { id: 'scenarios', label: 'Escenarios', icon: '🎭', color: 'blue' },
    { id: 'sensors', label: 'Sensores', icon: '📡', color: 'green' },
    { id: 'replication', label: 'Replicación', icon: '🔄', color: 'purple' }
  ]

  const getTabClasses = (tab, isActive) => {
    const colors = {
      blue: isActive ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' : '',
      green: isActive ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/20' : '',
      purple: isActive ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20' : ''
    }
    return isActive 
      ? colors[tab.color]
      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          ⚙️ Configuración del Sistema
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Gestiona escenarios, sensores y replicación del sistema
        </p>
      </div>

      {/* Tabs de Configuración */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {configTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setConfigSubTab(tab.id)}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${getTabClasses(tab, configSubTab === tab.id)}`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Contenido según subtab activo */}
      <div className="mt-6">
        {configSubTab === 'scenarios' && <ScenarioManager />}
        {configSubTab === 'sensors' && <SensorManager />}
        {configSubTab === 'replication' && (
          <div className="space-y-6">
            <ReplicationStats />
            <ReplicationConfig />
          </div>
        )}
      </div>
    </div>
  )
}

// Componente principal AppContent
function AppContent() {
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState(() => {
    const saved = localStorage.getItem('selectedCamera')
    return saved ? JSON.parse(saved) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [serverStatus, setServerStatus] = useState('checking')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, cameraId: null, cameraName: '' })
  // Recuperar tab activo del localStorage
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard'
  })
  // Subtab para la sección de configuración
  const [configSubTab, setConfigSubTab] = useState(() => {
    return localStorage.getItem('configSubTab') || 'scenarios'
  })
  const { theme, toggleTheme } = useTheme()
  const { isRecording, activeRecordingsCount, startRecording, stopRecording } = useRecording()
  const { activeScenario } = useScenario()

  // Verificar estado del servidor
  useEffect(() => {
    const checkServer = async () => {
      try {
        await api.getHealth()
        setServerStatus('online')
        setError(null)
      } catch (err) {
        setServerStatus('offline')
        setError('❌ No se puede conectar al servidor')
      }
    }

    checkServer()
    const interval = setInterval(checkServer, 5000)
    return () => clearInterval(interval)
  }, [])

  // Persistir cámara seleccionada en localStorage
  useEffect(() => {
    if (selectedCamera) {
      localStorage.setItem('selectedCamera', JSON.stringify(selectedCamera))
    } else {
      localStorage.removeItem('selectedCamera')
    }
  }, [selectedCamera])

  // Persistir tab activo en localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  // Persistir subtab de configuración en localStorage
  useEffect(() => {
    localStorage.setItem('configSubTab', configSubTab)
  }, [configSubTab])

  // Advertir al usuario si hay grabaciones activas antes de cerrar/recargar
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (activeRecordingsCount > 0) {
        const message = `Hay ${activeRecordingsCount} grabación(es) en curso. ¿Estás seguro de cerrar? Las grabaciones se guardarán automáticamente.`
        e.preventDefault()
        e.returnValue = message
        return message
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [activeRecordingsCount])

  // Obtener listado de cámaras
  useEffect(() => {
    fetchCameras()
  }, [])

  const fetchCameras = async () => {
    try {
      setLoading(true)
      const data = await api.getCameras()
      setCameras(data)
      setError(null)
    } catch (err) {
      setError(err.message)
      setCameras([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddCamera = async (formData) => {
    try {
      const newCamera = await api.createCamera(formData)
      fetchCameras()
      
      // Auto-iniciar grabación usando el escenario activo si existe
      console.log('📹 Nueva cámara agregada, iniciando grabación:', {
        cameraId: newCamera.id,
        cameraName: newCamera.name,
        activeScenario: activeScenario,
        willUseScenario: activeScenario ? activeScenario.name : 'sin_escenario'
      })
      
      await startRecording(newCamera.id, newCamera.name, {
        scenarioId: activeScenario?.id,
        scenarioName: activeScenario?.name
      })
      
      setError(null)
    } catch (err) {
      setError(`Error al crear cámara: ${err.message}`)
    }
  }

  const handleDeleteCamera = async (cameraId) => {
    const camera = cameras.find(c => c.id === cameraId)
    setConfirmDelete({
      isOpen: true,
      cameraId,
      cameraName: camera?.name || 'esta cámara'
    })
  }

  // Alias para compatibilidad con el botón de eliminar en configuración
  const handleDeleteRequest = (cameraId, cameraName) => {
    setConfirmDelete({
      isOpen: true,
      cameraId,
      cameraName: cameraName || 'esta cámara'
    })
  }

  const confirmDeleteCamera = async () => {
    try {
      // Detener grabación primero
      await stopRecording(confirmDelete.cameraId)
      
      await api.deleteCamera(confirmDelete.cameraId)
      fetchCameras()
      if (selectedCamera?.id === confirmDelete.cameraId) {
        setSelectedCamera(null)
      }
      setConfirmDelete({ isOpen: false, cameraId: null, cameraName: '' })
      setError(null)
    } catch (err) {
      setError(`Error al eliminar cámara: ${err.message}`)
    }
  }

  return (
    <div className="app min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 flex flex-col">
      <AppHeader 
        serverStatus={serverStatus}
        activeRecordingsCount={activeRecordingsCount}
        theme={theme}
        toggleTheme={toggleTheme}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      
      {/* Tab Content */}
      <div className={`flex-1 ${activeTab === 'cameras' ? 'flex overflow-hidden' : 'overflow-y-auto'}`}>
        {/* Dashboard con Sensores integrados */}
        <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
          <div className="max-w-7xl mx-auto p-6 space-y-6">
            <DashboardSummary />
            {/* Sensores en tiempo real integrados en Dashboard */}
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">📊 Sensores en Tiempo Real</h2>
              <SensorsDashboard />
            </div>
          </div>
        </div>

        {/* Cámaras */}
        <div className={activeTab === 'cameras' ? 'flex flex-1 gap-4 p-4 overflow-hidden min-h-0' : 'hidden'}>
          <aside className="card w-80 flex flex-col flex-shrink-0 min-h-0">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cámaras</h2>
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="btn-primary py-1 px-3 text-sm"
                title="Agregar cámara"
              >
                ➕
              </button>
            </div>
            
            {loading && <p className="text-sm text-gray-500">⏳ Cargando...</p>}
            {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
            
            <div className="flex-1 overflow-y-auto min-h-0">
              <CameraList 
                cameras={cameras} 
                selectedCamera={selectedCamera}
                onSelectCamera={setSelectedCamera}
                onDeleteCamera={handleDeleteCamera}
              />
            </div>
            
            <button onClick={fetchCameras} className="btn-secondary w-full mt-4 flex-shrink-0">
              🔄 Refrescar
            </button>
          </aside>

          <main className="card flex-1 flex flex-col overflow-hidden min-h-0">
            {selectedCamera ? (
              <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                <WebRTCViewer camera={selectedCamera} />
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-500 dark:text-gray-400">
                <p className="text-xl">Selecciona una cámara</p>
              </div>
            )}
          </main>
        </div>

        {/* Reglas */}
        {activeTab === 'rules' && (
          <div className="max-w-7xl mx-auto p-6">
            <RulesManager />
          </div>
        )}

        {/* Configuración - usa componente separado */}
        {activeTab === 'config' && (
          <ConfigurationContent 
            configSubTab={configSubTab}
            setConfigSubTab={setConfigSubTab}
          />
        )}
      </div>

      <CameraModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddCamera}
      />

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, cameraId: null, cameraName: '' })}
        onConfirm={confirmDeleteCamera}
        title="Eliminar Cámara"
        message={`¿Estás seguro que deseas eliminar "${confirmDelete.cameraName}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDanger={true}
      />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <ScenarioProvider>
        <MQTTProvider>
          <RecordingProvider>
            <AppContent />
          </RecordingProvider>
        </MQTTProvider>
      </ScenarioProvider>
    </ThemeProvider>
  )
}

export default App