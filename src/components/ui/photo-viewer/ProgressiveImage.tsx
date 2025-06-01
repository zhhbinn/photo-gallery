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
import {
  convertMovToMp4,
  isVideoConversionSupported,
  isWebCodecsSupported,
  needsVideoConversion,
} from '~/lib/video-converter'

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

  // Live Photo 相关 props
  isLivePhoto?: boolean
  livePhotoVideoUrl?: string
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

  // Live Photo props
  isLivePhoto = false,
  livePhotoVideoUrl,
}: ProgressiveImageProps) => {
  const [blobSrc, setBlobSrc] = useState<string | null>(null)
  const [highResLoaded, setHighResLoaded] = useState(false)
  const [error, setError] = useState(false)

  // Live Photo 相关状态
  const [isPlayingLivePhoto, setIsPlayingLivePhoto] = useState(false)
  const [livePhotoVideoLoaded, setLivePhotoVideoLoaded] = useState(false)
  const [convertedVideoUrl, setConvertedVideoUrl] = useState<string | null>(
    null,
  )
  const [isConvertingVideo, setIsConvertingVideo] = useState(false)
  const [conversionMethod, setConversionMethod] = useState<string>('')

  const thumbnailRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const transformRef = useRef<WebGLImageViewerRef>(null)
  const thumbnailAnimateController = useAnimationControls()
  const convertedUrlRef = useRef<string | null>(null)
  const loadingIndicatorRef = useRef<LoadingIndicatorRef>(null)

  // Live Photo hover 相关
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Reset states when image changes
  useEffect(() => {
    setHighResLoaded(false)
    setBlobSrc(null)
    setError(false)
    setIsPlayingLivePhoto(false)
    setLivePhotoVideoLoaded(false)
    setConvertedVideoUrl(null)
    setIsConvertingVideo(false)
    setConversionMethod('')

    // Reset loading indicator
    loadingIndicatorRef.current?.resetLoadingState()

    // Clean up previous converted URL
    if (convertedUrlRef.current) {
      revokeConvertedUrl(convertedUrlRef.current)
      convertedUrlRef.current = null
    }

    // Clean up converted video URL
    if (convertedVideoUrl) {
      URL.revokeObjectURL(convertedVideoUrl)
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

            // 处理 Live Photo 视频（在图片加载完成后）
            if (
              isLivePhoto &&
              livePhotoVideoUrl &&
              !livePhotoVideoLoaded &&
              !isConvertingVideo
            ) {
              const processLivePhotoVideo = async () => {
                const video = videoRef.current
                if (!video) return

                try {
                  // 检查是否需要转换
                  if (needsVideoConversion(livePhotoVideoUrl)) {
                    // 检查浏览器是否支持视频转换
                    if (!isVideoConversionSupported()) {
                      console.warn(
                        'Video conversion not supported in this browser',
                      )
                      return
                    }

                    setIsConvertingVideo(true)

                    // 更新加载指示器显示转换进度
                    loadingIndicatorRef.current?.updateLoadingState({
                      isVisible: true,
                      isConverting: true,
                      loadingProgress: 0,
                    })

                    console.info('Converting MOV video to MP4...')

                    const result = await convertMovToMp4(
                      livePhotoVideoUrl,
                      (progress) => {
                        loadingIndicatorRef.current?.updateLoadingState({
                          isVisible: true,
                          isConverting: progress.isConverting,
                          loadingProgress: progress.progress,
                          conversionMessage: progress.message,
                          codecInfo: progress.message.includes('编码器')
                            ? progress.message
                            : undefined,
                        })
                      },
                    )

                    if (result.success && result.videoUrl) {
                      setConvertedVideoUrl(result.videoUrl)
                      setConversionMethod(result.method || 'unknown')
                      video.src = result.videoUrl
                      video.load()

                      console.info(
                        `Video conversion completed using ${result.method}. Size: ${result.convertedSize ? Math.round(result.convertedSize / 1024) : 'unknown'}KB`,
                      )
                    } else {
                      console.error('Video conversion failed:', result.error)
                    }

                    setIsConvertingVideo(false)
                    loadingIndicatorRef.current?.updateLoadingState({
                      isVisible: false,
                    })
                  } else {
                    // 直接使用原始视频
                    video.src = livePhotoVideoUrl
                    video.load()
                  }

                  const handleVideoCanPlay = () => {
                    setLivePhotoVideoLoaded(true)
                    video.removeEventListener(
                      'canplaythrough',
                      handleVideoCanPlay,
                    )
                  }

                  video.addEventListener('canplaythrough', handleVideoCanPlay)
                } catch (error) {
                  console.error('Failed to process Live Photo video:', error)
                  setIsConvertingVideo(false)
                  loadingIndicatorRef.current?.updateLoadingState({
                    isVisible: false,
                  })
                }
              }

              // 异步处理视频，不阻塞图片显示
              processLivePhotoVideo()
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
  }, [
    highResLoaded,
    error,
    onProgress,
    src,
    onError,
    isCurrentImage,
    isLivePhoto,
    livePhotoVideoUrl,
    livePhotoVideoLoaded,
    isConvertingVideo,
  ])

  // Live Photo hover 处理
  const handleBadgeMouseEnter = useCallback(() => {
    if (
      !isLivePhoto ||
      !livePhotoVideoLoaded ||
      isPlayingLivePhoto ||
      isConvertingVideo
    )
      return

    hoverTimerRef.current = setTimeout(() => {
      setIsPlayingLivePhoto(true)
      const video = videoRef.current
      if (video) {
        video.currentTime = 0
        video.play()
      }
    }, 200) // 200ms hover 延迟
  }, [isLivePhoto, livePhotoVideoLoaded, isPlayingLivePhoto, isConvertingVideo])

  const handleBadgeMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }

    if (isPlayingLivePhoto) {
      setIsPlayingLivePhoto(false)
      const video = videoRef.current
      if (video) {
        video.pause()
        video.currentTime = 0
      }
    }
  }, [isPlayingLivePhoto])

  // 视频播放结束处理
  const handleVideoEnded = useCallback(() => {
    setIsPlayingLivePhoto(false)
  }, [])

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

      {/* Live Photo 视频 */}
      {isLivePhoto && livePhotoVideoUrl && (
        <video
          ref={videoRef}
          className={clsxm(
            'absolute inset-0 h-full w-full object-contain duration-200',
            isPlayingLivePhoto ? 'z-10' : 'opacity-0 pointer-events-none',
          )}
          muted
          playsInline
          onEnded={handleVideoEnded}
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

      {/* Live Photo 标识 */}
      {isLivePhoto && (
        <div
          className={clsxm(
            'absolute z-50 flex items-center space-x-1 rounded-xl bg-black/50 px-1 py-1 text-xs text-white cursor-pointer transition-all duration-200 hover:bg-black/70',
            import.meta.env.DEV ? 'top-16 right-4' : 'top-4 left-4',
          )}
          onMouseEnter={handleBadgeMouseEnter}
          onMouseLeave={handleBadgeMouseLeave}
        >
          {isConvertingVideo ? (
            <div className="flex items-center gap-1 px-1">
              <i className="i-mingcute-loading-line animate-spin" />
              <span>实况视频转换中</span>
            </div>
          ) : (
            <>
              <img
                className="size-4 invert-100"
                src="data:image/webp;base64,UklGRjICAABXRUJQVlA4WAoAAAAQAAAAHwAAHwAAQUxQSOUBAAABkCPZtmo369zzZPtz1XPEzBAyM4ozMzNbNIoPUmhmdsQ4BDF9iKUBUHwMn6wRRMQEMMEF5D84Ja+68jgFfK9iKqCuDALrL5DZsHOQK2tASvI4OKv6CStDkeU827OgEi1B4O1Virz1DKQo5e5RYHrD197er7enAWfu4BUhcGoTJG3sc2vrl3GLw+bDIAUclS8gmrbjAiAnbSAKb/fj8inzbiCZoQhOQR2x4YxweQaax7FuP6QsTAAWLYIAYUtBzQbcP8rlJ0y34wSoypilKwlw3Kbz+Bz6T97GUZQqs85Os0qcjDZQUPAHlvPjA0razsMFS6N8+saqnI8AeFvD9CdgsbUjQoctglQfofUeeb1NIfpSRbTbYkj2E9mZR/AHl/PtE0razsF5S6N8+sbyfh+hYMOoOKrNOjvNqnEy1kBh5dITptsJAlSlzdJVBDhp03h+Df3Hse4ApCxCABYvhgAxS8DuNbh/UObcQLJDYVRBlfDwADQsRMnrOPgSYlk7Rt7jlonCk4O4fAic2IJrs5GPyeTHEWt1bDkHQmGPBxeAGS2/Bvp/Nk8HDt1BKVbgYQNFXnoPQvFK5aKdz1kWCa7gUf20/XiUKrD6Oj171mQ5swGE0p0CfoX6gDrK6pS86ii/gDDBAQBWUDggJgAAANACAJ0BKiAAIAA+kUSdSqWjoqGoCACwEglpAAA9o6AA/vjPGsAA"
              />
              <span className="mr-1">实况</span>
              {conversionMethod && (
                <span className="rounded bg-white/20 px-1 text-xs">
                  {conversionMethod === 'webcodecs' ? 'WebCodecs' : 'FFmpeg'}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* 操作提示 */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded bg-black/50 px-2 py-1 text-xs text-white opacity-0 duration-200 group-hover:opacity-50">
        {isLivePhoto
          ? isConvertingVideo
            ? `正在使用 ${isWebCodecsSupported() ? 'WebCodecs' : 'FFmpeg'} 转换视频格式...`
            : '悬浮在实况标识上播放 / 双击缩放'
          : '双击或双指缩放'}
      </div>
    </div>
  )
}
