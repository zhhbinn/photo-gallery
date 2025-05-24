import { motion } from 'motion/react'
import { useState } from 'react'
import { Blurhash } from 'react-blurhash'
import { useInView } from 'react-intersection-observer'

import type { Photo } from '../types/photo'

interface PhotoCardProps {
  photo: Photo
  onClick: (photo: Photo) => void
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  })

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const handleImageError = () => {
    setImageError(true)
  }

  const handleClick = () => {
    onClick(photo)
  }

  return (
    <motion.div
      ref={ref}
      className="group relative overflow-hidden rounded-lg bg-gray-900 cursor-pointer"
      style={{ aspectRatio: photo.aspectRatio }}
      onClick={handleClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Blurhash 占位符 */}
      {photo.blurhash && !imageLoaded && !imageError && (
        <Blurhash
          hash={photo.blurhash}
          width="100%"
          height="100%"
          resolutionX={32}
          resolutionY={32}
          punch={1}
          className="absolute inset-0"
        />
      )}

      {/* 实际图片 */}
      {inView && (
        <img
          src={photo.thumbnailUrl}
          alt={photo.title}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy"
        />
      )}

      {/* 错误状态 */}
      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-gray-400 text-center">
            <div className="text-2xl mb-2">📷</div>
            <div className="text-sm">加载失败</div>
          </div>
        </div>
      )}

      {/* 悬停遮罩 */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300" />

      {/* 照片信息 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <h3 className="text-white font-medium text-sm mb-1 line-clamp-2">
          {photo.title}
        </h3>
        {photo.description && (
          <p className="text-gray-300 text-xs line-clamp-2">
            {photo.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-gray-400 text-xs">
            {new Date(photo.dateTaken).toLocaleDateString('zh-CN')}
          </span>
          <span className="text-gray-400 text-xs">{photo.views} 次查看</span>
        </div>
      </div>

      {/* 加载指示器 */}
      {!imageLoaded && !imageError && inView && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </motion.div>
  )
}
