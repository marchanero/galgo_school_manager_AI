import React, { useState, useEffect } from 'react'
import { 
  Gauge, X, Save, Loader2, AlertCircle, Lightbulb, CheckCircle,
  Thermometer, Droplets, Wind, Volume2, Sun, CloudRain, FlaskConical,
  ArrowDown, ArrowUp, Settings, ToggleLeft, ToggleRight
} from 'lucide-react'
import { useScenario } from '../contexts/ScenarioContext'

function ThresholdConfig({ scenario, onClose }) {
  const { updateScenario } = useScenario()
  
  // Tipos de sensores comunes con sus unidades y colores
  const sensorTypes = [
    { type: 'temperatura', label: 'Temperatura', unit: '°C', icon: Thermometer, color: 'red', defaultMin: 18, defaultMax: 26 },
    { type: 'humedad', label: 'Humedad', unit: '%', icon: Droplets, color: 'blue', defaultMin: 30, defaultMax: 70 },
    { type: 'co2', label: 'CO₂', unit: 'ppm', icon: Wind, color: 'emerald', defaultMin: 400, defaultMax: 1000 },
    { type: 'presion', label: 'Presión', unit: 'hPa', icon: Gauge, color: 'purple', defaultMin: 980, defaultMax: 1030 },
    { type: 'ruido', label: 'Ruido', unit: 'dB', icon: Volume2, color: 'orange', defaultMin: 30, defaultMax: 70 },
    { type: 'luz', label: 'Luz', unit: 'lux', icon: Sun, color: 'yellow', defaultMin: 200, defaultMax: 1000 },
    { type: 'voc', label: 'VOC', unit: 'ppb', icon: CloudRain, color: 'gray', defaultMin: 0, defaultMax: 500 },
    { type: 'gases/no2', label: 'NO₂', unit: 'ppm', icon: FlaskConical, color: 'pink', defaultMin: 0, defaultMax: 0.2 },
    { type: 'gases/so2', label: 'SO₂', unit: 'ppm', icon: FlaskConical, color: 'amber', defaultMin: 0, defaultMax: 0.1 },
    { type: 'gases/co', label: 'CO', unit: 'ppm', icon: FlaskConical, color: 'cyan', defaultMin: 0, defaultMax: 9 },
  ]

  const colorClasses = {
    red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800', active: 'bg-red-50 dark:bg-red-900/20' },
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', active: 'bg-blue-50 dark:bg-blue-900/20' },
    emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', active: 'bg-emerald-50 dark:bg-emerald-900/20' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', active: 'bg-purple-50 dark:bg-purple-900/20' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', active: 'bg-orange-50 dark:bg-orange-900/20' },
    yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800', active: 'bg-yellow-50 dark:bg-yellow-900/20' },
    gray: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700', active: 'bg-gray-50 dark:bg-gray-900/20' },
    pink: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800', active: 'bg-pink-50 dark:bg-pink-900/20' },
    amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', active: 'bg-amber-50 dark:bg-amber-900/20' },
    cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800', active: 'bg-cyan-50 dark:bg-cyan-900/20' },
  }

  const [thresholds, setThresholds] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (scenario && scenario.thresholds) {
      setThresholds(scenario.thresholds)
    } else {
      // Inicializar con valores por defecto
      const defaultThresholds = {}
      sensorTypes.forEach(sensor => {
        defaultThresholds[sensor.type] = {
          enabled: false,
          min: sensor.defaultMin,
          max: sensor.defaultMax
        }
      })
      setThresholds(defaultThresholds)
    }
  }, [scenario])

  const handleToggle = (type) => {
    setThresholds(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        enabled: !prev[type]?.enabled
      }
    }))
  }

  const handleMinChange = (type, value) => {
    setThresholds(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        min: parseFloat(value) || 0
      }
    }))
  }

  const handleMaxChange = (type, value) => {
    setThresholds(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        max: parseFloat(value) || 0
      }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const result = await updateScenario(scenario.id, {
        thresholds: thresholds
      })

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

  const enabledCount = Object.entries(thresholds).filter(([_, config]) => config?.enabled).length

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Configurar Umbrales
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Escenario: <span className="font-medium text-gray-700 dark:text-gray-300">{scenario.name}</span>
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

          {/* Info */}
          <div className="mb-6 flex items-start gap-3 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800">
            <Lightbulb className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-teal-700 dark:text-teal-300">
              <strong>Sugerencia:</strong> Define rangos aceptables para cada tipo de sensor. 
              Los valores fuera de estos umbrales podrán activar alertas o grabaciones automáticas.
            </div>
          </div>

          {/* Lista de Umbrales */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto mb-6 pr-2">
            {sensorTypes.map(sensor => {
              const colors = colorClasses[sensor.color]
              const Icon = sensor.icon
              const isEnabled = thresholds[sensor.type]?.enabled

              return (
                <div
                  key={sensor.type}
                  className={`rounded-2xl overflow-hidden transition-all border-2 ${
                    isEnabled
                      ? `${colors.border} ${colors.active}`
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
                  }`}
                >
                  {/* Sensor Header */}
                  <div 
                    onClick={() => handleToggle(sensor.type)}
                    className="flex items-center justify-between p-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isEnabled ? colors.bg : 'bg-gray-200 dark:bg-gray-600'
                      }`}>
                        <Icon className={`w-5 h-5 ${isEnabled ? colors.text : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {sensor.label}
                        </h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Unidad: {sensor.unit}
                        </span>
                      </div>
                    </div>
                    {isEnabled ? (
                      <ToggleRight className={`w-8 h-8 ${colors.text}`} />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-400" />
                    )}
                  </div>

                  {/* Rangos (solo si está habilitado) */}
                  {isEnabled && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-200/50 dark:border-gray-600/50">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <ArrowDown className="w-4 h-4 text-blue-500" />
                            Mínimo ({sensor.unit})
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={thresholds[sensor.type]?.min || sensor.defaultMin}
                            onChange={(e) => handleMinChange(sensor.type, e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <ArrowUp className="w-4 h-4 text-red-500" />
                            Máximo ({sensor.unit})
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={thresholds[sensor.type]?.max || sensor.defaultMax}
                            onChange={(e) => handleMaxChange(sensor.type, e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Resumen */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl mb-6">
            <div className="flex items-center gap-2">
              <CheckCircle className={`w-5 h-5 ${enabledCount > 0 ? 'text-emerald-500' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sensores configurados
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{enabledCount}</span>
              <span className="text-gray-500 dark:text-gray-400">/ {sensorTypes.length}</span>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-teal-500/25 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? 'Guardando...' : 'Guardar Umbrales'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ThresholdConfig
