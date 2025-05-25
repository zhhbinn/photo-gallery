import './PhotoViewer.css'

import { AnimatePresence, m } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'

import type { PhotoManifest } from '~/types/photo'

import { ExifPanel } from './ExifPanel'
import { GalleryThumbnail } from './GalleryThumbnail'
import { ProgressiveImage } from './ProgressiveImage'

interface PhotoViewerProps {
  photos: PhotoManifest[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onIndexChange: (index: number) => void
}

export const PhotoViewer = ({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onIndexChange,
}: PhotoViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const imageContainerRef = useRef<HTMLDivElement>(null)

  const currentPhoto = photos[currentIndex]

  // 计算图片的适配尺寸
  const getImageDisplaySize = () => {
    if (!currentPhoto) return { width: 0, height: 0 }

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const maxWidth = viewportWidth * 0.9
    const maxHeight = viewportHeight * 0.9

    const imageAspectRatio = currentPhoto.width / currentPhoto.height
    const maxAspectRatio = maxWidth / maxHeight

    let displayWidth: number
    let displayHeight: number

    if (imageAspectRatio > maxAspectRatio) {
      // 图片更宽，以宽度为准
      displayWidth = Math.min(maxWidth, currentPhoto.width)
      displayHeight = displayWidth / imageAspectRatio
    } else {
      // 图片更高，以高度为准
      displayHeight = Math.min(maxHeight, currentPhoto.height)
      displayWidth = displayHeight * imageAspectRatio
    }

    return { width: displayWidth, height: displayHeight }
  }

  // 预加载相邻图片
  useEffect(() => {
    if (!isOpen) return

    const preloadImage = (src: string) => {
      const img = new Image()
      img.src = src
    }

    // 预加载前一张和后一张
    if (currentIndex > 0) {
      preloadImage(photos[currentIndex - 1].originalUrl)
    }
    if (currentIndex < photos.length - 1) {
      preloadImage(photos[currentIndex + 1].originalUrl)
    }
  }, [isOpen, currentIndex, photos])

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setTimeout(() => {
        onIndexChange(currentIndex - 1)
      }, 100)
    }
  }, [currentIndex, onIndexChange])

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setTimeout(() => {
        onIndexChange(currentIndex + 1)
      }, 100)
    }
  }, [currentIndex, photos.length, onIndexChange])

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft': {
          event.preventDefault()
          handlePrevious()
          break
        }
        case 'ArrowRight': {
          event.preventDefault()
          handleNext()
          break
        }
        case 'Escape': {
          event.preventDefault()
          onClose()
          break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handlePrevious, handleNext, onClose])

  const imageSize = getImageDisplaySize()

  if (!currentPhoto) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={containerRef}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ touchAction: 'none' }}
        >
          <m.div
            className="absolute inset-0 bg-black/50 backdrop-blur-[70px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          <div className="size-full flex flex-row">
            <div className="flex-1 flex-col flex min-w-0 min-h-0">
              <div className="flex flex-1 min-w-0 relative group min-h-0">
                {/* Buttons */}

                <m.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* 顶部工具栏 - Fixed */}
                  <div className="absolute top-4 left-4 right-4 z-30 flex items-center">
                    {/* 关闭按钮 */}
                    <button
                      type="button"
                      className="absolute right-0 top-0 hover:bg-black/40 duration-200 size-8 flex items-center justify-center rounded-full text-white bg-material-ultra-thick backdrop-blur-2xl"
                      onClick={onClose}
                    >
                      <i className="i-mingcute-close-line" />
                    </button>
                  </div>
                  {/* 导航按钮 */}
                  {currentIndex > 0 && (
                    <button
                      type="button"
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center size-10 text-white bg-material-medium rounded-full backdrop-blur-sm hover:bg-black/40 group-hover:opacity-100 opacity-0 duration-200"
                      onClick={handlePrevious}
                    >
                      <i className="i-mingcute-arrow-left-line text-xl" />
                    </button>
                  )}

                  {currentIndex < photos.length - 1 && (
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center size-10 text-white bg-material-medium rounded-full backdrop-blur-sm hover:bg-black/40 group-hover:opacity-100 opacity-0 duration-200"
                      onClick={handleNext}
                    >
                      <i className="i-mingcute-arrow-right-line text-xl" />
                    </button>
                  )}
                </m.div>

                <m.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  ref={imageContainerRef}
                  className="relative w-full h-full flex items-center justify-center"
                >
                  <AnimatePresence>
                    <ProgressiveImage
                      src={currentPhoto.originalUrl}
                      thumbnailSrc={currentPhoto.thumbnailUrl}
                      blurhash={currentPhoto.blurhash}
                      alt={currentPhoto.title}
                      width={imageSize.width}
                      height={imageSize.height}
                      className="w-full h-full object-contain"
                    />
                  </AnimatePresence>
                </m.div>
              </div>

              <GalleryThumbnail
                currentIndex={currentIndex}
                photos={photos}
                onIndexChange={onIndexChange}
              />
            </div>
            <ExifPanel
              currentPhoto={currentPhoto}
              exifData={currentPhoto.exif}
            />
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
