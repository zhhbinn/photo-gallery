import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Blurhash } from 'react-blurhash'

import type { Photo } from '../types/photo'

interface PhotoModalProps {
  photo: Photo | null
  isOpen: boolean
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
}

export function PhotoModal({
  photo,
  isOpen,
  onClose,
  onNext,
  onPrev,
}: PhotoModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (photo) {
      setImageLoaded(false)
      setImageError(false)
    }
  }, [photo])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape': {
          onClose()
          break
        }
        case 'ArrowLeft': {
          onPrev?.()
          break
        }
        case 'ArrowRight': {
          onNext?.()
          break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onNext, onPrev])

  if (!photo) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const handleImageError = () => {
    setImageError(true)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
        >
          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 text-white hover:text-gray-300 transition-colors"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* 导航按钮 */}
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 text-white hover:text-gray-300 transition-colors"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 text-white hover:text-gray-300 transition-colors"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}

          {/* 图片容器 */}
          <motion.div
            className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Blurhash 占位符 */}
            {photo.blurhash && !imageLoaded && !imageError && (
              <Blurhash
                hash={photo.blurhash}
                width={Math.min(window.innerWidth * 0.9, photo.width)}
                height={Math.min(window.innerHeight * 0.9, photo.height)}
                resolutionX={32}
                resolutionY={32}
                punch={1}
                className="rounded-lg"
              />
            )}

            {/* 实际图片 */}
            <img
              src={photo.originalUrl}
              alt={photo.title}
              className={`max-w-full max-h-full object-contain rounded-lg transition-opacity duration-500 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />

            {/* 错误状态 */}
            {imageError && (
              <div className="flex items-center justify-center bg-gray-800 rounded-lg p-8">
                <div className="text-gray-400 text-center">
                  <div className="text-4xl mb-4">📷</div>
                  <div className="text-lg">图片加载失败</div>
                </div>
              </div>
            )}

            {/* 加载指示器 */}
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </motion.div>

          {/* 照片信息 */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="max-w-4xl mx-auto">
              <h2 className="text-white text-xl font-semibold mb-2">
                {photo.title}
              </h2>
              {photo.description && (
                <p className="text-gray-300 text-sm mb-3">
                  {photo.description}
                </p>
              )}
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>
                  拍摄时间:{' '}
                  {new Date(photo.dateTaken).toLocaleDateString('zh-CN')}
                </span>
                <span>{photo.views} 次查看</span>
                <span>
                  {photo.width} × {photo.height}
                </span>
              </div>
              {photo.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {photo.tags.map((tag) => (
                    <span
                      key={`tag-${tag}`}
                      className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
