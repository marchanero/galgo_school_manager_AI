import React, { useState, useEffect } from 'react'
import { 
  Layout, X, Save, Loader2, AlertCircle, Lightbulb,
  CheckCircle, ToggleLeft, ToggleRight, FileText, Edit3, Plus
} from 'lucide-react'
import { useScenario } from '../contexts/ScenarioContext'

function ScenarioForm({ scenario, onClose }) {
  const { createScenario, updateScenario } = useScenario()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    active: true
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (scenario) {
      setFormData({
        name: scenario.name || '',
        description: scenario.description || '',
        active: scenario.active !== undefined ? scenario.active : true
      })
    }
  }, [scenario])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('El nombre es requerido')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let result
      if (scenario) {
        // Actualizar
        result = await updateScenario(scenario.id, formData)
      } else {
        // Crear nuevo
        result = await createScenario(formData)
      }

      if (result.success) {
        onClose()
      } else {
        setError(result.message || 'Error al guardar')
      }
    } catch (err) {
      setError('Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              {scenario ? <Edit3 className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {scenario ? 'Editar Escenario' : 'Nuevo Escenario'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {scenario ? 'Modifica los detalles del escenario' : 'Crea un nuevo espacio de trabajo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Error */}
          {error && (
            <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Layout className="w-4 h-4 text-violet-500" />
                Nombre del Escenario *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="Ej: Aula 101, Laboratorio A"
                required
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-500" />
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all resize-none"
                placeholder="Descripción opcional del escenario..."
                rows={3}
              />
            </div>

            {/* Estado Activo */}
            <div 
              onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
              className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                formData.active 
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800' 
                  : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  formData.active 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}>
                  <CheckCircle className={`w-5 h-5 ${formData.active ? 'text-emerald-600' : 'text-gray-500'}`} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    Estado del Escenario
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formData.active ? 'Escenario activo y listo para usar' : 'Escenario desactivado'}
                  </p>
                </div>
              </div>
              {formData.active ? (
                <ToggleRight className="w-10 h-10 text-emerald-500" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-gray-400" />
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-violet-500/25 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {saving ? 'Guardando...' : scenario ? 'Actualizar' : 'Crear Escenario'}
              </button>
            </div>
          </form>

          {/* Info */}
          <div className="mt-6 flex items-start gap-3 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
            <Lightbulb className="w-5 h-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-violet-700 dark:text-violet-300">
              <strong>Sugerencia:</strong> Después de crear el escenario, podrás asignar cámaras, sensores y configurar umbrales desde el panel de gestión.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScenarioForm
