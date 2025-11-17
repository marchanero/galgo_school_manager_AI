import React, { useState } from 'react'
import { EmqxProvider, useEmqxContext } from './contexts/EmqxContext'
import { ClusterStats } from './components/ClusterStats'
import { ClientsList } from './components/ClientsList'
import { SubscriptionsList } from './components/SubscriptionsList'
import { NodesList } from './components/NodesList'
import MessageMonitor from './components/MessageMonitor'
import VRDashboard from './components/VRDashboard'

// Componente interno que usa el contexto
function AppContent() {
  const {
    clusterInfo,
    clients,
    subscriptions,
    nodes,
    loading,
    error,
    stats,
    refreshAllData
  } = useEmqxContext()

  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊', description: 'Vista general del cluster' },
    { id: 'messages', name: 'Mensajes MQTT', icon: '📡', description: 'Monitor de mensajes en tiempo real' },
    { id: 'vr', name: 'Dashboard VR', icon: '🥽', description: 'Visualización de datos VR en tiempo real' },
    { id: 'clients', name: 'Clientes', icon: '👥', description: 'Gestión de clientes conectados' },
    { id: 'subscriptions', name: 'Suscripciones', icon: '🔔', description: 'Lista de suscripciones activas' },
    { id: 'nodes', name: 'Nodos', icon: '🖥️', description: 'Estado del cluster' }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            <ClusterStats clusterInfo={clusterInfo} loading={loading} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ClientsList clients={clients} loading={loading} />
              <SubscriptionsList subscriptions={subscriptions} loading={loading} />
            </div>
            <NodesList nodes={nodes} loading={loading} />
          </div>
        )
      case 'messages':
        return <MessageMonitor />
      case 'vr':
        return <VRDashboard />
      case 'clients':
        return <ClientsList clients={clients} loading={loading} fullView />
      case 'subscriptions':
        return <SubscriptionsList subscriptions={subscriptions} loading={loading} fullView />
      case 'nodes':
        return <NodesList nodes={nodes} loading={loading} fullView />
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar - Fixed on the left */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 border-r border-slate-700 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static lg:w-64`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">EMQX</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Granada</h1>
                <p className="text-slate-400 text-xs">Monitor</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  setSidebarOpen(false)
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div className="text-left">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs opacity-70">{item.description}</div>
                </div>
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700 flex-shrink-0">
            <div className="text-center text-slate-500 text-xs">
              EMQX Granada v2.0
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h2 className="text-2xl font-bold text-white">
                  {navigation.find(nav => nav.id === activeTab)?.name}
                </h2>
                <p className="text-slate-400 text-sm">
                  {navigation.find(nav => nav.id === activeTab)?.description}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Status Indicator */}
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-slate-400 text-sm">Sistema Activo</span>
              </div>

              <button
                onClick={refreshAllData}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Actualizando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Actualizar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Page Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                  <span className="text-red-400">⚠️</span>
                </div>
                <div>
                  <h3 className="text-red-400 font-medium">Error de conexión</h3>
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          {renderContent()}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

// Componente principal con Provider
function App() {
  return (
    <EmqxProvider>
      <AppContent />
    </EmqxProvider>
  )
}

export default App
