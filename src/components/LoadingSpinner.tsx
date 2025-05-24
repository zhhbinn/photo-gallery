import { motion } from 'motion/react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export function LoadingSpinner({
  size = 'md',
  text = '加载中...',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <motion.div
        className={`${sizeClasses[size]} border-2 border-gray-600 border-t-white rounded-full`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      {text && (
        <motion.p
          className="mt-4 text-gray-400 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  )
}
