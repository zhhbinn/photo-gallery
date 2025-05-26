import { useGesture } from '@use-gesture/react'
import { AnimatePresence, m, useAnimationControls } from 'motion/react'
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
  enableZoom?: boolean
  enablePan?: boolean
  maxZoom?: number
  minZoom?: number
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
  enableZoom = true,
  enablePan = true,
  maxZoom = 10,
  minZoom = 1,
}: ProgressiveImageProps) => {
  const [blobSrc, setBlobSrc] = useState<string | null>(null)
  const [highResLoaded, setHighResLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // Transform states for pan and zoom
  const [transform, setTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const thumbnailRef = useRef<HTMLImageElement>(null)
  const highResRef = useRef<HTMLImageElement>(null)
  const thumbnailAnimateController = useAnimationControls()

  // Reset transform when image changes
  useEffect(() => {
    setHighResLoaded(false)
    setBlobSrc(null)
    setError(false)
    setLoadingProgress(0)
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [src, thumbnailAnimateController])
  // Gesture handling
  const bind = useGesture(
    {
      onDrag: ({ offset: [x, y], pinching, cancel, event }) => {
        event.preventDefault()
        event.stopPropagation()
        if (!enablePan || pinching) return
        if (transform.scale <= 1) {
          cancel()
          return
        }

        // Calculate bounds to prevent dragging too far
        const container = containerRef.current
        if (!container) return

        const { width, height } = container.getBoundingClientRect()
        const scaledWidth = width * transform.scale
        const scaledHeight = height * transform.scale

        const maxX = (scaledWidth - width) / 2
        const maxY = (scaledHeight - height) / 2

        const boundedX = Math.max(-maxX, Math.min(maxX, x))
        const boundedY = Math.max(-maxY, Math.min(maxY, y))

        setTransform((prev) => ({ ...prev, x: boundedX, y: boundedY }))
      },

      onPinch: ({ offset: [scale], origin: [ox, oy], event }) => {
        // Prevent default behavior to avoid page zoom
        event.preventDefault()
        event.stopPropagation()
        if (!enableZoom) return

        const newScale = Math.max(minZoom, Math.min(maxZoom, scale))

        // If scaling back to 1, reset position
        if (newScale <= 1) {
          setTransform({ x: 0, y: 0, scale: 1 })
          return
        }

        // Calculate new position based on pinch origin
        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const centerX = rect.width / 2
        const centerY = rect.height / 2

        // Calculate offset from center
        const offsetX = (ox - centerX) * (newScale - transform.scale)
        const offsetY = (oy - centerY) * (newScale - transform.scale)

        setTransform((prev) => ({
          x: prev.x - offsetX,
          y: prev.y - offsetY,
          scale: newScale,
        }))
      },
      onWheel: ({ delta: [, dy], ctrlKey, metaKey, event }) => {
        if (!enableZoom) {
          // If zoom is disabled, prevent all wheel events
          event.preventDefault()
          event.stopPropagation()
          return
        }

        if (ctrlKey || metaKey) {
          // This is our controlled zoom, prevent browser zoom but allow our zoom
          event.preventDefault()
          event.stopPropagation()

          const scaleFactor = 1 + Math.abs(dy) * 0.01
          const newScale =
            dy > 0
              ? Math.max(minZoom, transform.scale / scaleFactor)
              : Math.min(maxZoom, transform.scale * scaleFactor)

          if (newScale <= 1) {
            setTransform({ x: 0, y: 0, scale: 1 })
          } else {
            setTransform((prev) => ({ ...prev, scale: newScale }))
          }
        }
      },
      onDoubleClick: ({ event }) => {
        if (!enableZoom) return

        // Prevent default behavior
        event.preventDefault()

        if (transform.scale > 1) {
          setTransform({ x: 0, y: 0, scale: 1 })
        } else {
          setTransform({ x: 0, y: 0, scale: 2 })
        }
      },
    },
    {
      drag: {
        from: () => [transform.x, transform.y],
        bounds: () => {
          if (transform.scale <= 1)
            return { left: 0, right: 0, top: 0, bottom: 0 }

          const container = containerRef.current
          if (!container) return { left: 0, right: 0, top: 0, bottom: 0 }

          const { width, height } = container.getBoundingClientRect()
          const scaledWidth = width * transform.scale
          const scaledHeight = height * transform.scale

          const maxX = (scaledWidth - width) / 2
          const maxY = (scaledHeight - height) / 2

          return {
            left: -maxX,
            right: maxX,
            top: -maxY,
            bottom: maxY,
          }
        },
        preventDefault: true,
        filterTaps: true,
      },
      pinch: {
        from: () => [transform.scale, 0],
        scaleBounds: { min: minZoom, max: maxZoom },
        preventDefault: true,
        filterTaps: true,
        pinchOnWheel: true,
      },
      wheel: {
        preventDefault: true,
      },
    },
  )

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
          <p className="text-sm">图片加载失败</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={clsxm('relative overflow-hidden touch-none', className)}
      {...bind()}
      style={{
        cursor: transform.scale > 1 ? 'grab' : 'default',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {blurhash && (
        <Blurhash
          hash={blurhash}
          width="100%"
          height="100%"
          resolutionX={32}
          resolutionY={32}
          punch={1}
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            transformOrigin: 'center',
            transition: 'transform 0.1s ease-out',
          }}
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
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            transformOrigin: 'center',
            transition: 'transform 0.1s ease-out',
          }}
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
        style={{
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          transformOrigin: 'center',
          transition: 'transform 0.1s ease-out',
        }}
      />

      {/* 加载指示器 */}
      <AnimatePresence>
        {!highResLoaded && !error && (
          <m.div
            className="absolute inset-0 flex items-center justify-center bg-black/20 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={Spring.presets.snappy}
          >
            <div className="text-center text-white">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">正在加载高清图片...</p>
              <p className="text-xs text-white/70 mt-1">
                {Math.round(loadingProgress)}%
              </p>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* 缩放提示 */}
      {enableZoom && transform.scale <= 1 && (
        <div className="absolute bottom-4 duration-200 opacity-0 group-hover:opacity-50 left-1/2 transform -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
          双击或双指缩放
        </div>
      )}
    </div>
  )
}
