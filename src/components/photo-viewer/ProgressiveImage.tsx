import { m, useAnimationControls } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Blurhash } from 'react-blurhash'

import { clsxm } from '~/lib/cn'
import { Spring } from '~/lib/spring'

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

  className,
  onLoad,
  onError,
  onProgress,
}: ProgressiveImageProps) => {
  const [blobSrc, setBlobSrc] = useState<string | null>(null)

  const [highResLoaded, setHighResLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)

  const thumbnailRef = useRef<HTMLImageElement>(null)
  const highResRef = useRef<HTMLImageElement>(null)
  const thumbnailAnimateController = useAnimationControls()
  useEffect(() => {
    setHighResLoaded(false)
    setBlobSrc(null)

    setError(false)
    setLoadingProgress(0)
  }, [src, thumbnailAnimateController])
  useEffect(() => {
    if (highResLoaded || error) return

    let upperXHR: XMLHttpRequest | null = null

    const delayToLoadTimer = setTimeout(() => {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', src)
      xhr.responseType = 'blob'
      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response
          const url = URL.createObjectURL(blob)
          setBlobSrc(url)
          setHighResLoaded(true)
        }
      }

      xhr.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100
          setLoadingProgress(progress)
          onProgress?.(progress)
        }
      }
      xhr.onerror = () => {
        setError(true)
        onError?.()
      }
      xhr.send()

      upperXHR = xhr
    }, 300)
    return () => {
      clearTimeout(delayToLoadTimer)
      upperXHR?.abort()
    }
  }, [
    highResLoaded,
    error,
    onProgress,
    src,
    onError,
    thumbnailAnimateController,
  ])

  const handleThumbnailLoad = useCallback(() => {
    thumbnailAnimateController.start({
      opacity: 1,
    })
  }, [thumbnailAnimateController])

  const handleError = useCallback(() => {
    setError(true)
    onError?.()
  }, [onError])

  // 重置状态当 src 改变时
  useEffect(() => {
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
        <div className="text-center text-text-secondary">
          <i className="i-mingcute-image-line text-4xl mb-2" />
          <p className="text-sm">Failed to load image</p>
        </div>
      </div>
    )
  }

  return (
    <div className={clsxm('relative overflow-hidden', className)}>
      {blurhash && (
        <Blurhash
          hash={blurhash}
          width="100%"
          height="100%"
          resolutionX={32}
          resolutionY={32}
          punch={1}
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}

      {/* 缩略图 */}
      {thumbnailSrc && (
        <m.img
          ref={thumbnailRef}
          initial={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          src={thumbnailSrc}
          key={thumbnailSrc}
          alt={alt}
          transition={Spring.presets.smooth}
          className={'absolute inset-0 w-full h-full object-contain'}
          animate={thumbnailAnimateController}
          onLoad={handleThumbnailLoad}
        />
      )}

      <img
        ref={highResRef}
        src={blobSrc || undefined}
        alt={alt}
        className={clsxm(
          'absolute inset-0 w-full h-full object-contain',
          highResLoaded ? 'opacity-100' : 'opacity-0',
        )}
        onLoad={onLoad}
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
