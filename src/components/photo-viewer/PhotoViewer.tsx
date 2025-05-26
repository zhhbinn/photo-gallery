import './PhotoViewer.css'
// Import Swiper styles
import 'swiper/css'
import 'swiper/css/navigation'

import { AnimatePresence, m } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Swiper as SwiperType } from 'swiper'
import { Keyboard, Navigation, Virtual } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'

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
  const swiperRef = useRef<SwiperType | null>(null)
  const [isImageZoomed, setIsImageZoomed] = useState(false)

  const currentPhoto = photos[currentIndex]

  // 当 PhotoViewer 关闭时重置缩放状态
  useEffect(() => {
    if (!isOpen) {
      setIsImageZoomed(false)
    }
  }, [isOpen])

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
      onIndexChange(currentIndex - 1)
    }
  }, [currentIndex, onIndexChange])

  // const handleNext = useCallback(() => {
  //   // if (currentIndex < photos.length - 1) {
  //   //   onIndexChange(currentIndex + 1)
  //   // }
  // }, [currentIndex, photos.length, onIndexChange])

  // 同步 Swiper 的索引
  useEffect(() => {
    if (swiperRef.current && swiperRef.current.activeIndex !== currentIndex) {
      swiperRef.current.slideTo(currentIndex, 300)
    }
    // 切换图片时重置缩放状态
    setIsImageZoomed(false)
  }, [currentIndex])

  // 当图片缩放状态改变时，控制 Swiper 的触摸行为
  useEffect(() => {
    if (swiperRef.current) {
      if (isImageZoomed) {
        // 图片被缩放时，禁用 Swiper 的触摸滑动
        swiperRef.current.allowTouchMove = false
      } else {
        // 图片未缩放时，启用 Swiper 的触摸滑动
        swiperRef.current.allowTouchMove = true
      }
    }
  }, [isImageZoomed])

  // 处理图片缩放状态变化
  const handleZoomChange = useCallback((isZoomed: boolean) => {
    setIsImageZoomed(isZoomed)
  }, [])

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
          // handleNext()
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
  }, [isOpen, handlePrevious, onClose])

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
                {/* 顶部工具栏 */}
                <m.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute top-4 left-4 right-4 z-30 flex items-center"
                >
                  {/* 关闭按钮 */}
                  <button
                    type="button"
                    className="absolute right-0 top-0 hover:bg-black/40 duration-200 size-8 flex items-center justify-center rounded-full text-white bg-material-ultra-thick backdrop-blur-2xl"
                    onClick={onClose}
                  >
                    <i className="i-mingcute-close-line" />
                  </button>
                </m.div>

                {/* Swiper 容器 */}
                <Swiper
                  modules={[Navigation, Keyboard, Virtual]}
                  spaceBetween={0}
                  slidesPerView={1}
                  initialSlide={currentIndex}
                  virtual
                  keyboard={{
                    enabled: true,
                    onlyInViewport: true,
                  }}
                  navigation={{
                    prevEl: '.swiper-button-prev-custom',
                    nextEl: '.swiper-button-next-custom',
                  }}
                  onSwiper={(swiper) => {
                    swiperRef.current = swiper
                    // 初始化时确保触摸滑动是启用的
                    swiper.allowTouchMove = !isImageZoomed
                  }}
                  onSlideChange={(swiper) => {
                    onIndexChange(swiper.activeIndex)
                  }}
                  className="w-full h-full"
                  style={{ touchAction: 'pan-y' }}
                >
                  {photos.map((photo, index) => (
                    <SwiperSlide
                      key={photo.id}
                      className="flex items-center justify-center"
                      virtualIndex={index}
                    >
                      <m.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="relative w-full h-full flex items-center justify-center"
                      >
                        <ProgressiveImage
                          src={photo.originalUrl}
                          thumbnailSrc={photo.thumbnailUrl}
                          blurhash={photo.blurhash}
                          alt={photo.title}
                          width={
                            index === currentIndex ? imageSize.width : undefined
                          }
                          height={
                            index === currentIndex
                              ? imageSize.height
                              : undefined
                          }
                          className="w-full h-full object-contain"
                          onZoomChange={
                            index === currentIndex
                              ? handleZoomChange
                              : undefined
                          }
                        />
                      </m.div>
                    </SwiperSlide>
                  ))}
                </Swiper>

                {/* 自定义导航按钮 */}
                {currentIndex > 0 && (
                  <button
                    type="button"
                    className="swiper-button-prev-custom absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center size-10 text-white bg-material-medium rounded-full backdrop-blur-sm hover:bg-black/40 group-hover:opacity-100 opacity-0 duration-200"
                    onClick={handlePrevious}
                  >
                    <i className="i-mingcute-arrow-left-line text-xl" />
                  </button>
                )}

                {currentIndex < photos.length - 1 && (
                  <button
                    type="button"
                    className="swiper-button-next-custom absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center size-10 text-white bg-material-medium rounded-full backdrop-blur-sm hover:bg-black/40 group-hover:opacity-100 opacity-0 duration-200"
                    // onClick={handleNext}
                  >
                    <i className="i-mingcute-arrow-right-line text-xl" />
                  </button>
                )}
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
