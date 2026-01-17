import { useState, useEffect } from 'react'
import api from '../../services/api'
import { toast } from 'react-hot-toast'

/**
 * useAppState - Custom hook for App-level state management
 * 
 * Manages:
 * - Cameras list and selection
 * - Active tab and config subtab
 * - Server status checking
 * - LocalStorage persistence
 * - Camera CRUD operations
 */
export function useAppState({ startRecording, stopRecording, activeScenario }) {
  // Camera state
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState(() => {
    const saved = localStorage.getItem('selectedCamera')
    return saved ? JSON.parse(saved) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Navigation state
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard'
  })
  const [configSubTab, setConfigSubTab] = useState(() => {
    return localStorage.getItem('configSubTab') || 'scenarios'
  })

  // Server status
  const [serverStatus, setServerStatus] = useState('checking')

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState({ 
    isOpen: false, 
    cameraId: null, 
    cameraName: '' 
  })

  /**
   * Check server health
   */
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

  /**
   * Persist selected camera to localStorage
   */
  useEffect(() => {
    if (selectedCamera) {
      localStorage.setItem('selectedCamera', JSON.stringify(selectedCamera))
    } else {
      localStorage.removeItem('selectedCamera')
    }
  }, [selectedCamera])

  /**
   * Persist active tab
   */
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  /**
   * Persist config subtab
   */
  useEffect(() => {
    localStorage.setItem('configSubTab', configSubTab)
  }, [configSubTab])

  /**
   * Listen for navigation messages from dashboard
   */
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'NAVIGATE_TAB') {
        setActiveTab(event.data.tab)
      } else if (event.data?.type === 'NAVIGATE_CONFIG') {
        setActiveTab('config')
        setConfigSubTab(event.data.subTab)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  /**
   * Fetch cameras on mount
   */
  useEffect(() => {
    fetchCameras()
  }, [])

  /**
   * Fetch cameras from API
   */
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

  /**
   * Add new camera
   */
  const handleAddCamera = async (formData) => {
    try {
      const newCamera = await api.createCamera(formData)
      fetchCameras()
      
      // Auto-start recording with active scenario
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
      
      toast.success(`Cámara "${newCamera.name}" agregada correctamente`)
      setError(null)
    } catch (err) {
      toast.error(`Error al crear cámara: ${err.message}`)
      setError(`Error al crear cámara: ${err.message}`)
    }
  }

  /**
   * Request camera deletion
   */
  const handleDeleteCamera = async (cameraId) => {
    const camera = cameras.find(c => c.id === cameraId)
    setConfirmDelete({
      isOpen: true,
      cameraId,
      cameraName: camera?.name || 'esta cámara'
    })
  }

  /**
   * Confirm camera deletion
   */
  const confirmDeleteCamera = async () => {
    const cameraName = confirmDelete.cameraName
    try {
      // Stop recording first
      await stopRecording(confirmDelete.cameraId)
      
      await api.deleteCamera(confirmDelete.cameraId)
      fetchCameras()
      if (selectedCamera?.id === confirmDelete.cameraId) {
        setSelectedCamera(null)
      }
      setConfirmDelete({ isOpen: false, cameraId: null, cameraName: '' })
      toast.success(`Cámara "${cameraName}" eliminada`)
      setError(null)
    } catch (err) {
      toast.error(`Error al eliminar cámara: ${err.message}`)
      setError(`Error al eliminar cámara: ${err.message}`)
    }
  }

  return {
    // Camera state
    cameras,
    selectedCamera,
    setSelectedCamera,
    loading,
    error,
    
    // Navigation
    activeTab,
    setActiveTab,
    configSubTab,
    setConfigSubTab,
    
    // Server
    serverStatus,
    
    // Modals
    isModalOpen,
    setIsModalOpen,
    confirmDelete,
    setConfirmDelete,
    
    // Methods
    fetchCameras,
    handleAddCamera,
    handleDeleteCamera,
    confirmDeleteCamera
  }
}
