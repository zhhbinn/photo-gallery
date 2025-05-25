import { m } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Blurhash } from 'react-blurhash'

import { clsxm } from '~/lib/cn'

interface ProgressiveImageProps {
  src: string
  thumbnailSrc?: string
  blurhash?: string
  alt: string
  width?: number
  height?: number
  className?: string
  onLoad?: () => void
  onError?: () => void
  onProgress?: (progress: number) => void
}

export const ProgressiveImage = ({
  src,
  thumbnailSrc,
  blurhash,
  alt,
  width,
  height,
  className,
  onLoad,
  onError,
  onProgress,
}: ProgressiveImageProps) => {
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false)
  const [highResLoaded, setHighResLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const highResRef = useRef<HTMLImageElement>(null)
  const thumbnailRef = useRef<HTMLImageElement>(null)

  // 模拟加载进度
  useEffect(() => {
    if (highResLoaded || error) return

    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        const newProgress = prev + Math.random() * 5
        const clampedProgress = Math.min(newProgress, 85)
        onProgress?.(clampedProgress)
        return clampedProgress
      })
    }, 100)

    return () => clearInterval(interval)
  }, [highResLoaded, error, onProgress])

  const handleThumbnailLoad = useCallback(() => {
    setThumbnailLoaded(true)
  }, [])

  const handleHighResLoad = useCallback(() => {
    setHighResLoaded(true)
    setLoadingProgress(100)
    onProgress?.(100)
    onLoad?.()
  }, [onLoad, onProgress])

  const handleError = useCallback(() => {
    setError(true)
    onError?.()
  }, [onError])

  // 重置状态当 src 改变时
  useEffect(() => {
    setThumbnailLoaded(false)
    setHighResLoaded(false)
    setError(false)
    setLoadingProgress(0)
  }, [src])

  if (error) {
    return (
      <div
        className={clsxm(
          'flex items-center justify-center bg-gray-100',
          className,
        )}
      >
        <div className="text-center text-gray-500">
          <i className="i-mingcute-image-line text-4xl mb-2" />
          <p className="text-sm">Failed to load image</p>
        </div>
      </div>
    )
  }

  return (
    <div className={clsxm('relative overflow-hidden', className)}>
      {/* Blurhash 背景 */}
      {blurhash && !thumbnailLoaded && !highResLoaded && (
        <Blurhash
          hash={blurhash}
          width={width || 400}
          height={height || 300}
          resolutionX={32}
          resolutionY={32}
          punch={1}
          className="absolute inset-0 w-full h-full"
        />
      )}

      {/* 缩略图 */}
      {thumbnailSrc && (
        <m.img
          ref={thumbnailRef}
          src={thumbnailSrc}
          alt={alt}
          className={clsxm(
            'absolute inset-0 w-full h-full object-contain transition-opacity duration-300',
            thumbnailLoaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={handleThumbnailLoad}
          initial={{ opacity: 0 }}
          animate={{ opacity: thumbnailLoaded && !highResLoaded ? 1 : 0 }}
        />
      )}

      {/* 高清图片 */}
      <img
        ref={highResRef}
        src={src}
        alt={alt}
        className={clsxm(
          'w-full h-full object-contain transition-opacity duration-500',
          highResLoaded ? 'opacity-100' : 'opacity-0',
        )}
        onLoad={handleHighResLoad}
        onError={handleError}
        draggable={false}
        loading="eager"
        decoding="async"
      />

      {/* 加载指示器 */}
      {!highResLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="text-center text-white">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm">Loading high resolution...</p>
            <p className="text-xs text-white/70 mt-1">
              {Math.round(loadingProgress)}%
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
