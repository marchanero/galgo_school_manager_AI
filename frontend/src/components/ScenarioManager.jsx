import React, { useState } from 'react'
import { useScenario } from '../contexts/ScenarioContext'
import ScenarioForm from './ScenarioForm'
import DeviceAssignment from './DeviceAssignment'
import ThresholdConfig from './ThresholdConfig'
import { 
  Settings, 
  Plus, 
  Edit3, 
  Trash2, 
  Play, 
  Pause, 
  Smartphone, 
  Zap,
  Video,
  Radio,
  CheckCircle,
  XCircle,
  ChevronRight,
  LayoutGrid,
  Loader2,
  AlertCircle,
  Theater
} from 'lucide-react'

function ScenarioManager() {
  const {
    scenarios,
    activeScenario,
    loading,
    error,
    deleteScenario,
    activateScenario
  } = useScenario()

  const [showForm, setShowForm] = useState(false)
  const [editingScenario, setEditingScenario] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list', 'form', 'devices', 'thresholds'
  const [selectedScenario, setSelectedScenario] = useState(null)

  const handleCreateNew = () => {
    setEditingScenario(null)
    setViewMode('form')
  }

  const handleEdit = (scenario) => {
    setEditingScenario(scenario)
    setViewMode('form')
  }

  const handleDelete = async (scenario) => {
    if (!confirm(`¿Eliminar el escenario "${scenario.name}"?`)) return
    
    const result = await deleteScenario(scenario.id)
    if (result.success) {
      alert('Escenario eliminado exitosamente')
    } else {
      alert('Error al eliminar: ' + result.message)
    }
  }

  const handleActivate = (scenario) => {
    if (activeScenario?.id === scenario.id) {
      activateScenario(null) // Desactivar
    } else {
      activateScenario(scenario) // Activar
    }
  }

  const handleConfigureDevices = (scenario) => {
    setSelectedScenario(scenario)
    setViewMode('devices')
  }

  const handleConfigureThresholds = (scenario) => {
    setSelectedScenario(scenario)
    setViewMode('thresholds')
  }

  const handleFormClose = () => {
    setViewMode('list')
    setEditingScenario(null)
  }

  const handleDevicesClose = () => {
    setViewMode('list')
    setSelectedScenario(null)
  }

  const handleThresholdsClose = () => {
    setViewMode('list')
    setSelectedScenario(null)
  }

  // Vista de formulario
  if (viewMode === 'form') {
    return (
      <ScenarioForm
        scenario={editingScenario}
        onClose={handleFormClose}
      />
    )
  }

  // Vista de asignación de dispositivos
  if (viewMode === 'devices' && selectedScenario) {
    return (
      <DeviceAssignment
        scenario={selectedScenario}
        onClose={handleDevicesClose}
      />
    )
  }

  // Vista de configuración de umbrales
  if (viewMode === 'thresholds' && selectedScenario) {
    return (
      <ThresholdConfig
        scenario={selectedScenario}
        onClose={handleThresholdsClose}
      />
    )
  }

  // Vista de lista de escenarios
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Theater className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Configuración de Escenarios
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestiona aulas y asigna dispositivos
            </p>
          </div>
        </div>
        <button
          onClick={handleCreateNew}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nuevo Escenario
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Escenario Activo Banner */}
      {activeScenario && (
        <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 text-lg">
                    {activeScenario.name}
                  </h3>
                  <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-medium rounded-full">
                    ACTIVO
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  <span className="flex items-center gap-1">
                    <Video className="w-4 h-4" />
                    {activeScenario.cameras?.length || 0} cámaras
                  </span>
                  <span className="flex items-center gap-1">
                    <Radio className="w-4 h-4" />
                    {activeScenario.sensors?.length || 0} sensores
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => activateScenario(null)}
              className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl transition-colors text-sm font-medium flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Desactivar
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Cargando escenarios...</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && scenarios.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center mb-4">
            <LayoutGrid className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No hay escenarios configurados
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Crea tu primer escenario para organizar cámaras y sensores por ubicación
          </p>
          <button
            onClick={handleCreateNew}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Crear Escenario
          </button>
        </div>
      )}

      {/* Scenarios Grid */}
      {!loading && scenarios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map(scenario => {
            const isActive = activeScenario?.id === scenario.id
            
            return (
              <div
                key={scenario.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border-2 transition-all hover:shadow-xl ${
                  isActive
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
              >
                {/* Card Header */}
                <div className={`p-5 ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isActive 
                          ? 'bg-emerald-500' 
                          : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                      }`}>
                        {isActive ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : (
                          <Theater className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {scenario.name}
                        </h3>
                        {scenario.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                            {scenario.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      scenario.active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {scenario.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                      <div className="flex items-center justify-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
                        <Video className="w-4 h-4" />
                        <span className="text-xl font-bold">{scenario.cameras?.length || 0}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Cámaras</div>
                    </div>
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center">
                      <div className="flex items-center justify-center gap-1.5 text-purple-600 dark:text-purple-400 mb-1">
                        <Radio className="w-4 h-4" />
                        <span className="text-xl font-bold">{scenario.sensors?.length || 0}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Sensores</div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <button
                    onClick={() => handleActivate(scenario)}
                    className={`w-full px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                      isActive
                        ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Desactivar
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Activar Escenario
                      </>
                    )}
                  </button>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleEdit(scenario)}
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleConfigureDevices(scenario)}
                      className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                      title="Dispositivos"
                    >
                      <Smartphone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleConfigureThresholds(scenario)}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                      title="Umbrales"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(scenario)}
                    className="w-full px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ScenarioManager
