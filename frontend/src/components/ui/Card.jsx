import React from 'react'

// Variantes de cards
const variants = {
  default: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  elevated: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl',
  outline: 'bg-transparent border-gray-300 dark:border-gray-600',
  ghost: 'bg-gray-50 dark:bg-gray-800/50 border-transparent',
  gradient: 'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800',
  success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  danger: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
}

const sizes = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({ 
  children, 
  variant = 'default', 
  size = 'md',
  hover = false,
  className = '',
  onClick,
  ...props 
}) {
  const baseStyles = 'rounded-xl border transition-all duration-200'
  const hoverStyles = hover ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md' : ''
  const clickableStyles = onClick ? 'cursor-pointer' : ''
  
  return (
    <div 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${hoverStyles} ${clickableStyles} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, icon: Icon, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {Icon && <Icon className="w-5 h-5 text-blue-500" />}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{children}</h3>
    </div>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </div>
  )
}

export default Card
