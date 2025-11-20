import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ReplicationConfig {
  schedule: string;
  enabled: boolean;
  retentionDays: number;
  deleteAfterExport: boolean;
}

export default function ReplicationConfig() {
  const [config, setConfig] = useState<ReplicationConfig>({
    schedule: '0 3 * * *',
    enabled: false,
    retentionDays: 0,
    deleteAfterExport: false
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/replication/config`);
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching replication config:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await axios.post(`${API_URL}/api/replication/config`, config);
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: 'Error al guardar la configuración' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualReplication = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await axios.post(`${API_URL}/api/replication/start`);
      setMessage({ type: 'success', text: 'Replicación manual iniciada' });
    } catch (error) {
      console.error('Error starting replication:', error);
      setMessage({ type: 'error', text: 'Error al iniciar replicación' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Replicación de Videos
      </h3>
      
      <div className="space-y-6">
        {/* Activación General */}
        <div className="flex items-center justify-between">
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              />
              <div className={`block w-14 h-8 rounded-full transition-colors ${
                config.enabled ? 'bg-blue-600' : 'bg-gray-400'
              }`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                config.enabled ? 'transform translate-x-6' : ''
              }`}></div>
            </div>
            <div className="ml-3 text-gray-700 dark:text-gray-300 font-medium">
              {config.enabled ? 'Replicación Automática Activada' : 'Replicación Automática Desactivada'}
            </div>
          </label>
        </div>

        {/* Horario */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Horario (Cron Expression)
          </label>
          <input
            type="text"
            value={config.schedule}
            onChange={(e) => setConfig({ ...config, schedule: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="0 3 * * *"
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Ejemplo: "0 3 * * *" para ejecutar todos los días a las 3:00 AM
          </p>
        </div>

        {/* Política de Retención */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Política de Retención Local</h4>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="deleteAfterExport"
                type="checkbox"
                checked={config.deleteAfterExport}
                onChange={(e) => setConfig({ ...config, deleteAfterExport: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="deleteAfterExport" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Borrar archivos locales después de sincronizar
              </label>
            </div>

            <div className={`transition-opacity ${config.deleteAfterExport ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mantener archivos locales por (días)
              </label>
              <input
                type="number"
                min="0"
                title="Días de retención"
                value={config.retentionDays}
                onChange={(e) => setConfig({ ...config, retentionDays: parseInt(e.target.value) || 0 })}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Los archivos más antiguos que este número de días se borrarán del disco local tras una sincronización exitosa. (0 = borrar inmediatamente tras sync)
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar Configuración'}
          </button>
          
          <button
            onClick={handleManualReplication}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
          >
            Ejecutar Ahora
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-md ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
