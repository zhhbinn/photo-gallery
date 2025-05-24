import { motion } from 'motion/react'

interface HeaderProps {
  title?: string
  subtitle?: string
  photoCount?: number
}

export function Header({
  title = '摄影作品集',
  subtitle = '用镜头记录生活的美好瞬间',
  photoCount = 0,
}: HeaderProps) {
  return (
    <motion.header
      className="relative bg-black text-white py-16 px-4"
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="max-w-6xl mx-auto text-center">
        <motion.h1
          className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          {title}
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-gray-300 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          {subtitle}
        </motion.p>

        {photoCount > 0 && (
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full text-sm text-gray-300"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{photoCount} 张作品</span>
          </motion.div>
        )}
      </div>

      {/* 装饰性渐变 */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
    </motion.header>
  )
}
