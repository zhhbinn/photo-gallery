import { AnimatePresence, m, useAnimationControls } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Blurhash } from 'react-blurhash'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

import { clsxm } from '~/lib/cn'
import {
  convertHeicImage,
  detectHeicFormat,
  revokeConvertedUrl,
} from '~/lib/heic-converter'
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
  onZoomChange?: (isZoomed: boolean) => void
  enableZoom?: boolean
  enablePan?: boolean
  maxZoom?: number
  minZoom?: number
  isMobile?: boolean
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
  onZoomChange,
  enableZoom = true,
  enablePan = true,
  maxZoom = 10,
  minZoom = 1,
}: ProgressiveImageProps) => {
  const [blobSrc, setBlobSrc] = useState<string | null>(null)
  const [highResLoaded, setHighResLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isHeicFormat, setIsHeicFormat] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  const thumbnailRef = useRef<HTMLImageElement>(null)
  const highResRef = useRef<HTMLImageElement>(null)
  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const thumbnailAnimateController = useAnimationControls()
  const convertedUrlRef = useRef<string | null>(null)

  // Reset states when image changes
  useEffect(() => {
    setHighResLoaded(false)
    setBlobSrc(null)
    setError(false)
    setLoadingProgress(0)
    setIsHeicFormat(false)
    setIsConverting(false)

    // Clean up previous converted URL
    if (convertedUrlRef.current) {
      revokeConvertedUrl(convertedUrlRef.current)
      convertedUrlRef.current = null
    }

    // Reset transform when image changes
    if (transformRef.current) {
      transformRef.current.resetTransform()
    }
  }, [src])

  // 组件卸载时清理 URL
  useEffect(() => {
    return () => {
      if (convertedUrlRef.current) {
        revokeConvertedUrl(convertedUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (highResLoaded || error) return

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
            const isHeic = await detectHeicFormat(blob)
            setIsHeicFormat(isHeic)

            if (isHeic) {
              // 如果是 HEIC 格式，进行转换
              setIsConverting(true)
              try {
                const conversionResult = await convertHeicImage(blob, {
                  quality: 0.85,
                  format: 'image/jpeg',
                })

                convertedUrlRef.current = conversionResult.url
                setBlobSrc(conversionResult.url)
                setHighResLoaded(true)
                setIsConverting(false)

                console.info(
                  `HEIC converted: ${(blob.size / 1024).toFixed(1)}KB → ${(conversionResult.convertedSize / 1024).toFixed(1)}KB`,
                )
              } catch (conversionError) {
                console.error('HEIC conversion failed:', conversionError)
                setError(true)
                setIsConverting(false)
                onError?.()
              }
            } else {
              // 普通图片格式
              const url = URL.createObjectURL(blob)
              setBlobSrc(url)
              setHighResLoaded(true)
            }
          } catch (detectionError) {
            console.error('Format detection failed:', detectionError)
            // 如果检测失败，按普通图片处理
            const url = URL.createObjectURL(blob)
            setBlobSrc(url)
            setHighResLoaded(true)
          }
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
  }, [highResLoaded, error, onProgress, src, onError])

  const handleThumbnailLoad = useCallback(() => {
    thumbnailAnimateController.start({
      opacity: 1,
    })
  }, [thumbnailAnimateController])

  const handleError = useCallback(() => {
    setError(true)
    onError?.()
  }, [onError])

  if (error) {
    return (
      <div
        className={clsxm(
          'flex items-center justify-center bg-material-opaque',
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

      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={minZoom}
        maxScale={maxZoom}
        wheel={{
          step: 0.1,
          wheelDisabled: !enableZoom,
          touchPadDisabled: !enableZoom,
        }}
        pinch={{
          step: 0.5,
          disabled: !enableZoom,
        }}
        doubleClick={{
          step: 2,
          disabled: !enableZoom,
          mode: 'toggle',
          animationTime: 200,
        }}
        panning={{
          disabled: !enablePan,
          velocityDisabled: true,
        }}
        limitToBounds={true}
        centerOnInit={true}
        smooth={true}
        alignmentAnimation={{
          sizeX: 0,
          sizeY: 0,
          velocityAlignmentTime: 0.2,
        }}
        velocityAnimation={{
          sensitivity: 1,
          animationTime: 0.2,
        }}
        onTransformed={(ref, state) => {
          // 当缩放比例不等于 1 时，认为图片被缩放了
          const isZoomed = state.scale !== 1
          onZoomChange?.(isZoomed)
        }}
      >
        <TransformComponent
          wrapperClass="!w-full !h-full !absolute !inset-0"
          contentClass="!w-full !h-full flex items-center justify-center"
        >
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
              className="absolute inset-0 w-full h-full object-contain"
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
        </TransformComponent>
      </TransformWrapper>

      {/* 加载指示器 */}
      <AnimatePresence>
        {!highResLoaded && !error && (
          <m.div
            className="absolute inset-0 flex items-center justify-center bg-black/20 z-10 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={Spring.presets.snappy}
          >
            <div className="text-center text-white">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
              {isConverting ? (
                <>
                  <p className="text-sm">正在转换 HEIC 图片...</p>
                  <p className="text-xs text-white/70 mt-1">
                    使用高性能 WASM 引擎
                  </p>
                </>
              ) : isHeicFormat ? (
                <>
                  <p className="text-sm">正在下载 HEIC 图片...</p>
                  <p className="text-xs text-white/70 mt-1">
                    {Math.round(loadingProgress)}%
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm">正在加载高清图片...</p>
                  <p className="text-xs text-white/70 mt-1">
                    {Math.round(loadingProgress)}%
                  </p>
                </>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* 缩放提示 */}
      {enableZoom && (
        <div className="absolute bottom-4 duration-200 opacity-0 group-hover:opacity-50 left-1/2 transform -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none z-20">
          双击或双指缩放
        </div>
      )}
    </div>
  )
}
