import { Settings, Theater, Radio, Wifi, FolderSync, HardDrive, Film, Clapperboard, Gauge } from 'lucide-react'
import ScenarioManager from '../ScenarioManager'
import SensorManager from '../SensorManager'
import MQ from '../MQTTConfig'
import BackupPanel from '../BackupPanel'
import StorageManager from '../StorageManager'
import RecordingDashboard from '../RecordingDashboard'
import VideoProcessing from '../VideoProcessing'
import PerformanceDashboard from '../PerformanceDashboard'

/**
 * ConfigurationContent - Configuration tab content with sub-tabs
 */
export default function ConfigurationContent({ configSubTab, setConfigSubTab }) {
    const configTabs = [
        { id: 'scenarios', label: 'Escenarios', icon: Theater, color: 'blue' },
        { id: 'sensors', label: 'Sensores', icon: Radio, color: 'green' },
        { id: 'mqtt', label: 'MQTT', icon: Wifi, color: 'violet' },
        { id: 'replication', label: 'Replicación', icon: FolderSync, color: 'purple' },
        { id: 'storage', label: 'Almacenamiento', icon: HardDrive, color: 'orange' },
        { id: 'recordings', label: 'Grabaciones', icon: Film, color: 'red' },
        { id: 'processing', label: 'Procesamiento', icon: Clapperboard, color: 'cyan' },
        { id: 'performance', label: 'Rendimiento', icon: Gauge, color: 'emerald' }
    ]

    const getTabClasses = (tab, isActive) => {
        const colors = {
            blue: isActive ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' : '',
            green: isActive ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/20' : '',
            violet: isActive ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400 bg-violet-50 dark:bg-violet-900/20' : '',
            purple: isActive ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20' : '',
            orange: isActive ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-600 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/20' : '',
            red: isActive ? 'text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400 bg-red-50 dark:bg-red-900/20' : '',
            cyan: isActive ? 'text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20' : '',
            emerald: isActive ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : ''
        }
        return isActive
            ? colors[tab.color]
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 dark:from-gray-500 dark:to-gray-700 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Configuración del Sistema
                    </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400 ml-13">
                    Gestiona escenarios, sensores y replicación del sistema
                </p>
            </div>

            {/* Configuration Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
                    {configTabs.map(tab => {
                        const Icon = tab.icon
                        const isActive = configSubTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setConfigSubTab(tab.id)}
                                className={`px-3 py-3 font-medium transition-all duration-200 text-sm ${getTabClasses(tab, isActive)}`}
                            >
                                <div className="flex items-center justify-center gap-1.5">
                                    <Icon className={`w-4 h-4 ${isActive ? '' : 'opacity-70'}`} />
                                    <span className="truncate">{tab.label}</span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Content based on active subtab */}
            <div className="mt-6">
                {configSubTab === 'scenarios' && <ScenarioManager />}
                {configSubTab === 'sensors' && <SensorManager />}
                {configSubTab === 'mqtt' && <MQTTConfig />}
                {configSubTab === 'replication' && <BackupPanel />}
                {configSubTab === 'storage' && <StorageManager />}
                {configSubTab === 'recordings' && <RecordingDashboard />}
                {configSubTab === 'processing' && <VideoProcessing />}
                {configSubTab === 'performance' && <PerformanceDashboard />}
            </div>
        </div>
    )
}
