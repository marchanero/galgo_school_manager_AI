import { AlertTriangle, CheckCircle, X } from 'lucide-react'

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false }) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 dark:border-gray-700 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Icon */}
          <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
            isDanger 
              ? 'bg-red-100 dark:bg-red-900/30' 
              : 'bg-blue-100 dark:bg-blue-900/30'
          }`}>
            {isDanger ? (
              <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
            ) : (
              <CheckCircle className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            )}
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                isDanger 
                  ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/25' 
                  : 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/25'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
