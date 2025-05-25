import './PhotoViewer.css'

import type { Exif } from 'exif-reader'
import { AnimatePresence, m } from 'motion/react'
import type { FC } from 'react'
import { Fragment, useCallback, useEffect, useRef } from 'react'

import {
  CarbonIsoOutline,
  MaterialSymbolsShutterSpeed,
  StreamlineImageAccessoriesLensesPhotosCameraShutterPicturePhotographyPicturesPhotoLens,
  TablerAperture,
} from '~/icons'
import { clsxm } from '~/lib/cn'
import type { PhotoManifest } from '~/types/photo'

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
            <div className="flex-1 flex-col flex min-w-0">
              <div className="flex flex-1 min-w-0 relative group">
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
                      className="absolute right-0 top-0 hover:bg-fill-quaternary-light duration-200 size-8 flex items-center justify-center rounded-full text-white bg-material-ultra-thick backdrop-blur-2xl"
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
                  <ProgressiveImage
                    src={currentPhoto.originalUrl}
                    thumbnailSrc={currentPhoto.thumbnailUrl}
                    blurhash={currentPhoto.blurhash}
                    alt={currentPhoto.title}
                    width={imageSize.width}
                    height={imageSize.height}
                    className="w-full h-full object-contain"
                  />
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

const GalleryThumbnail: FC<{
  currentIndex: number
  photos: PhotoManifest[]
  onIndexChange: (index: number) => void
}> = ({ currentIndex, photos, onIndexChange }) => {
  return (
    <m.div
      className="absolute bottom-0 left-0 right-0 z-10 shrink-0 backdrop-blur-3xl bg-material-medium"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-material-medium backdrop-blur-[70px]">
        <div className="flex gap-3 overflow-x-auto p-4 scrollbar-hide">
          {photos.map((photo, index) => (
            <button
              type="button"
              key={photo.id}
              className={clsxm(
                'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 transition-all contain-intrinsic-size',
                index === currentIndex
                  ? 'ring-accent scale-110'
                  : 'ring-transparent hover:ring-accent',
              )}
              onClick={() => onIndexChange(index)}
            >
              <img
                src={photo.thumbnailUrl}
                alt={photo.title}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </m.div>
  )
}

const ExifPanel: FC<{
  currentPhoto: PhotoManifest
  exifData: Exif | null
}> = ({ currentPhoto, exifData }) => {
  const formattedExifData = formatExifData(exifData)
  return (
    <m.div
      className="w-80 bg-material-medium p-4 shrink-0 text-white overflow-y-auto z-10 backdrop-blur-3xl"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="text-lg font-semibold mb-4">图片信息</h3>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-white/80 mb-2">基本信息</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">文件名</span>
              <span>{currentPhoto.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">尺寸</span>
              <span>
                {currentPhoto.width} × {currentPhoto.height}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">文件大小</span>
              <span>{(currentPhoto.size / 1024 / 1024).toFixed(1)}MB</span>
            </div>
          </div>
        </div>

        {formattedExifData && (
          <Fragment>
            {formattedExifData.camera && (
              <div>
                <h4 className="text-sm font-medium text-white/80 mb-2">
                  设备信息
                </h4>
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">相机</span>
                    <span>{formattedExifData.camera}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-white/80 mb-2">
                拍摄参数
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {formattedExifData.focalLength35mm && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1">
                    <StreamlineImageAccessoriesLensesPhotosCameraShutterPicturePhotographyPicturesPhotoLens className="text-white/70 text-sm" />
                    <span className="text-xs">
                      {formattedExifData.focalLength35mm}mm
                    </span>
                  </div>
                )}

                {formattedExifData.aperture && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1">
                    <TablerAperture className="text-white/70 text-sm" />
                    <span className="text-xs">
                      {formattedExifData.aperture}
                    </span>
                  </div>
                )}

                {formattedExifData.shutterSpeed && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1">
                    <MaterialSymbolsShutterSpeed className="text-white/70 text-sm" />
                    <span className="text-xs">
                      {formattedExifData.shutterSpeed}
                    </span>
                  </div>
                )}

                {formattedExifData.iso && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-md px-2 py-1">
                    <CarbonIsoOutline className="text-white/70 text-sm" />
                    <span className="text-xs">ISO {formattedExifData.iso}</span>
                  </div>
                )}
              </div>
            </div>

            {formattedExifData.dateTime && (
              <div>
                <h4 className="text-sm font-medium text-white/80 mb-2">
                  拍摄时间
                </h4>
                <div className="text-sm text-white/80">
                  {typeof formattedExifData.dateTime === 'string'
                    ? new Date(formattedExifData.dateTime).toLocaleString()
                    : formattedExifData.dateTime instanceof Date
                      ? formattedExifData.dateTime.toLocaleString()
                      : String(formattedExifData.dateTime)}
                </div>
              </div>
            )}
          </Fragment>
        )}
      </div>
    </m.div>
  )
}

// 格式化 EXIF 数据
const formatExifData = (exif: Exif | null) => {
  if (!exif) return null

  const photo = exif.Photo || {}
  const image = exif.Image || {}

  // 等效焦距 (35mm)
  const focalLength35mm =
    photo.FocalLengthIn35mmFilm ||
    (photo.FocalLength ? Math.round(photo.FocalLength) : null)

  // ISO
  const iso = photo.ISOSpeedRatings || image.ISOSpeedRatings

  // 快门速度
  const exposureTime = photo.ExposureTime
  const shutterSpeed = exposureTime
    ? exposureTime >= 1
      ? `${exposureTime}s`
      : `1/${Math.round(1 / exposureTime)}`
    : null

  // 光圈
  const aperture = photo.FNumber ? `f/${photo.FNumber}` : null

  // 相机信息
  const camera =
    image.Make && image.Model ? `${image.Make} ${image.Model}` : null

  // 拍摄时间
  const dateTime = photo.DateTimeOriginal || photo.DateTime

  return {
    focalLength35mm,
    iso,
    shutterSpeed,
    aperture,
    camera,
    dateTime,
  }
}
