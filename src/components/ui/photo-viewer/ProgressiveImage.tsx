import { m, useAnimationControls } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { clsxm } from '~/lib/cn'
import {
  convertHeicImage,
  detectHeicFormat,
  isBrowserSupportHeic,
  revokeConvertedUrl,
} from '~/lib/heic-converter'
import { Spring } from '~/lib/spring'

import type { WebGLImageViewerRef } from '../WebGLImageViewer'
import { WebGLImageViewer } from '../WebGLImageViewer'
import type { LoadingIndicatorRef } from './LoadingIndicator'
import { LoadingIndicator } from './LoadingIndicator'

const canUseWebGL = (() => {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl')
  return gl !== null
})()
interface ProgressiveImageProps {
  src: string
  thumbnailSrc?: string

  alt: string
  width?: number
  height?: number
  className?: string
  onError?: () => void
  onProgress?: (progress: number) => void
  onZoomChange?: (isZoomed: boolean) => void

  enableZoom?: boolean
  enablePan?: boolean
  maxZoom?: number
  minZoom?: number

  isCurrentImage?: boolean
}

export const ProgressiveImage = ({
  src,
  thumbnailSrc,

  alt,
  className,

  onError,
  onProgress,
  onZoomChange,

  maxZoom = 20,
  minZoom = 1,
  isCurrentImage = false,
}: ProgressiveImageProps) => {
  const [blobSrc, setBlobSrc] = useState<string | null>(null)
  const [highResLoaded, setHighResLoaded] = useState(false)
  const [error, setError] = useState(false)

  const thumbnailRef = useRef<HTMLImageElement>(null)

  const transformRef = useRef<WebGLImageViewerRef>(null)
  const thumbnailAnimateController = useAnimationControls()
  const convertedUrlRef = useRef<string | null>(null)
  const loadingIndicatorRef = useRef<LoadingIndicatorRef>(null)

  // Reset states when image changes
  useEffect(() => {
    setHighResLoaded(false)
    setBlobSrc(null)
    setError(false)

    // Reset loading indicator
    loadingIndicatorRef.current?.resetLoadingState()

    // Clean up previous converted URL
    if (convertedUrlRef.current) {
      revokeConvertedUrl(convertedUrlRef.current)
      convertedUrlRef.current = null
    }

    // Reset transform when image changes
    if (transformRef.current) {
      transformRef.current.resetView()
    }
  }, [src])

  useEffect(() => {
    if (highResLoaded || error || !isCurrentImage) return

    // Show loading indicator
    loadingIndicatorRef.current?.updateLoadingState({
      isVisible: true,
    })

    let upperXHR: XMLHttpRequest | null = null

    const delayToLoadTimer = setTimeout(async () => {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', src)
      xhr.responseType = 'blob'
      xhr.onload = async () => {
        if (xhr.status === 200) {
          const blob = xhr.response

          try {
            // 检测是否为 HEIC 格式
            const shouldHeicTransformed =
              !isBrowserSupportHeic() && (await detectHeicFormat(blob))

            // Update loading indicator with HEIC format info
            loadingIndicatorRef.current?.updateLoadingState({
              isHeicFormat: shouldHeicTransformed,
              loadingProgress: 100,
              loadedBytes: blob.size,
              totalBytes: blob.size,
            })

            if (shouldHeicTransformed) {
              // 如果是 HEIC 格式，进行转换
              loadingIndicatorRef.current?.updateLoadingState({
                isConverting: true,
              })

              try {
                const conversionResult = await convertHeicImage(blob)

                convertedUrlRef.current = conversionResult.url
                setBlobSrc(conversionResult.url)
                setHighResLoaded(true)

                // Hide loading indicator
                loadingIndicatorRef.current?.updateLoadingState({
                  isVisible: false,
                })

                console.info(
                  `HEIC converted: ${(blob.size / 1024).toFixed(1)}KB → ${(conversionResult.convertedSize / 1024).toFixed(1)}KB`,
                )
              } catch (conversionError) {
                console.error('HEIC conversion failed:', conversionError)
                setError(true)

                // Hide loading indicator on error
                loadingIndicatorRef.current?.updateLoadingState({
                  isVisible: false,
                })

                onError?.()
              }
            } else {
              // 普通图片格式
              const url = URL.createObjectURL(blob)

              setBlobSrc(url)
              setHighResLoaded(true)

              // Hide loading indicator
              loadingIndicatorRef.current?.updateLoadingState({
                isVisible: false,
              })
            }
          } catch (detectionError) {
            console.error('Format detection failed:', detectionError)
            // 如果检测失败，按普通图片处理
            const url = URL.createObjectURL(blob)

            setBlobSrc(url)
            setHighResLoaded(true)

            // Hide loading indicator
            loadingIndicatorRef.current?.updateLoadingState({
              isVisible: false,
            })
          }
        }
      }

      xhr.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100

          // Update loading progress
          loadingIndicatorRef.current?.updateLoadingState({
            loadingProgress: progress,
            loadedBytes: e.loaded,
            totalBytes: e.total,
          })

          onProgress?.(progress)
        }
      }
      xhr.onerror = () => {
        setError(true)

        // Hide loading indicator on error
        loadingIndicatorRef.current?.updateLoadingState({
          isVisible: false,
        })

        onError?.()
      }
      xhr.send()

      upperXHR = xhr
    }, 300)
    return () => {
      clearTimeout(delayToLoadTimer)
      upperXHR?.abort()
    }
  }, [highResLoaded, error, onProgress, src, onError, isCurrentImage])

  const onTransformed = useCallback(
    (originalScale: number, relativeScale: number) => {
      const isZoomed = Math.abs(relativeScale - 1) > 0.01

      onZoomChange?.(isZoomed)
    },
    [onZoomChange],
  )

  const handleThumbnailLoad = useCallback(() => {
    thumbnailAnimateController.start({
      opacity: 1,
    })
  }, [thumbnailAnimateController])

  if (error) {
    return (
      <div
        className={clsxm(
          'flex items-center justify-center bg-material-opaque',
          className,
        )}
      >
        <div className="text-text-secondary text-center">
          <i className="i-mingcute-image-line mb-2 text-4xl" />
          <p className="text-sm">图片加载失败</p>
        </div>
      </div>
    )
  }

  return (
    <div className={clsxm('relative overflow-hidden', className)}>
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
          className="absolute inset-0 h-full w-full object-contain"
          animate={thumbnailAnimateController}
          onLoad={handleThumbnailLoad}
        />
      )}

      {highResLoaded && blobSrc && (
        <WebGLImageViewer
          ref={transformRef}
          src={blobSrc}
          className="absolute inset-0 h-full w-full"
          initialScale={1}
          minScale={minZoom}
          maxScale={maxZoom}
          limitToBounds={true}
          centerOnInit={true}
          smooth={true}
          onZoomChange={onTransformed}
          debug={import.meta.env.DEV}
        />
      )}

      {/* 备用图片（当 WebGL 不可用时） */}
      {!canUseWebGL && highResLoaded && blobSrc && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/20">
          <i className="i-mingcute-warning-line mb-2 text-4xl" />
          <span className="text-center text-sm text-white">
            WebGL 不可用，无法渲染图片
          </span>
        </div>
      )}

      {/* 加载指示器 */}
      <LoadingIndicator ref={loadingIndicatorRef} />

      {/* 缩放提示 */}

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded bg-black/50 px-2 py-1 text-xs text-white opacity-0 duration-200 group-hover:opacity-50">
        双击或双指缩放
      </div>
    </div>
  )
}
