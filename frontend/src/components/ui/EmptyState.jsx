import React from 'react'
import { 
  Video, 
  Radio, 
  FileVideo, 
  Search, 
  AlertCircle,
  Plus,
  RefreshCw,
  Inbox
} from 'lucide-react'

const illustrations = {
  cameras: Video,
  sensors: Radio,
  recordings: FileVideo,
  search: Search,
  error: AlertCircle,
  empty: Inbox,
}

const defaultMessages = {
  cameras: {
    title: 'No hay cámaras configuradas',
    description: 'Agrega tu primera cámara para comenzar a monitorear',
    actionLabel: 'Agregar Cámara',
  },
  sensors: {
    title: 'No hay sensores conectados',
    description: 'Los sensores aparecerán aquí cuando se conecten vía MQTT',
    actionLabel: 'Configurar MQTT',
  },
  recordings: {
    title: 'No hay grabaciones',
    description: 'Las grabaciones aparecerán aquí cuando inicies una sesión',
    actionLabel: 'Ir a Dashboard',
  },
  search: {
    title: 'Sin resultados',
    description: 'No se encontraron elementos que coincidan con tu búsqueda',
    actionLabel: 'Limpiar filtros',
  },
  error: {
    title: 'Algo salió mal',
    description: 'Ocurrió un error inesperado. Intenta nuevamente.',
    actionLabel: 'Reintentar',
  },
  empty: {
    title: 'Nada por aquí',
    description: 'Este espacio está vacío',
    actionLabel: null,
  },
}

export function EmptyState({ 
  type = 'empty',
  title,
  description,
  actionLabel,
  onAction,
  icon: CustomIcon,
  className = '',
}) {
  const Icon = CustomIcon || illustrations[type] || Inbox
  const messages = defaultMessages[type] || defaultMessages.empty
  
  const displayTitle = title || messages.title
  const displayDescription = description || messages.description
  const displayActionLabel = actionLabel !== undefined ? actionLabel : messages.actionLabel

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in ${className}`}>
      {/* Ilustración circular */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
          <Icon className="w-10 h-10 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
        </div>
        {/* Círculo decorativo */}
        <div className="absolute -inset-2 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 animate-spin-slow" />
      </div>

      {/* Texto */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {displayTitle}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        {displayDescription}
      </p>

      {/* Acción */}
      {displayActionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          {displayActionLabel}
        </button>
      )}
    </div>
  )
}

// Variante compacta para listas
export function EmptyStateCompact({ 
  message = 'No hay elementos',
  icon: Icon = Inbox,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 text-center ${className}`}>
      <Icon className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2" strokeWidth={1.5} />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  )
}

// Estado de error
export function ErrorState({ 
  title = 'Error de conexión',
  message = 'No se pudo conectar con el servidor',
  onRetry,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in ${className}`}>
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      )}
    </div>
  )
}

export default EmptyState
