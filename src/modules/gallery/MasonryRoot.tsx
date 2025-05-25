import clsx from 'clsx'
import { useAtom, useAtomValue } from 'jotai'
import { Masonry } from 'masonic'
import { m } from 'motion/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Blurhash } from 'react-blurhash'
import { useInView } from 'react-intersection-observer'

import { gallerySettingAtom } from '~/atoms/app'
import { PhotoViewer } from '~/components/photo-viewer'
import { Button } from '~/components/ui/button'
import { photoLoader } from '~/data/photos'
import { usePhotoViewer } from '~/hooks/usePhotoViewer'
import {
  CarbonIsoOutline,
  MaterialSymbolsShutterSpeed,
  StreamlineImageAccessoriesLensesPhotosCameraShutterPicturePhotographyPicturesPhotoLens,
  TablerAperture,
} from '~/icons'
import { clsxm } from '~/lib/cn'
import type { PhotoManifest } from '~/types/photo'

const data = photoLoader.getPhotos()

class MasonryHeaderItem {
  static default = new MasonryHeaderItem()
}

type MasonryItemType = PhotoManifest | MasonryHeaderItem

export const MasonryRoot = () => {
  const { sortOrder } = useAtomValue(gallerySettingAtom)
  const masonryItems = useMemo(() => {
    const sortedPhotos = data.sort((a, b) => {
      const aComparedDate =
        (a.exif.Photo?.DateTimeOriginal as unknown as string) || a.lastModified
      const bComparedDate =
        (b.exif.Photo?.DateTimeOriginal as unknown as string) || b.lastModified
      if (sortOrder === 'asc') {
        return aComparedDate.localeCompare(bComparedDate)
      }
      return bComparedDate.localeCompare(aComparedDate)
    })

    return [MasonryHeaderItem.default, ...sortedPhotos] as MasonryItemType[]
  }, [sortOrder])

  // 获取纯图片数据（不包含 header）
  const photos = useMemo(() => {
    return masonryItems.filter(
      (item): item is PhotoManifest => !(item instanceof MasonryHeaderItem),
    )
  }, [masonryItems])

  const photoViewer = usePhotoViewer(photos)

  return (
    <>
      <Masonry<MasonryItemType>
        key={sortOrder}
        items={masonryItems}
        render={useCallback(
          (props) => (
            <MasonryItem
              {...props}
              onPhotoClick={photoViewer.openViewer}
              photos={photos}
            />
          ),
          [photoViewer.openViewer, photos],
        )}
        columnWidth={300}
        columnGutter={16}
        rowGutter={16}
        itemHeightEstimate={400}
        itemKey={(data, _index) => {
          if (data instanceof MasonryHeaderItem) {
            return 'header'
          }
          return (data as PhotoManifest).id
        }}
      />

      <PhotoViewer
        photos={photos}
        currentIndex={photoViewer.currentIndex}
        isOpen={photoViewer.isOpen}
        onClose={photoViewer.closeViewer}
        onIndexChange={photoViewer.goToIndex}
      />
    </>
  )
}

export const MasonryItem = ({
  data,
  width,
  index,
  onPhotoClick,
  photos,
}: {
  data: MasonryItemType
  width: number
  index: number
  onPhotoClick: (index: number, element?: HTMLElement) => void
  photos: PhotoManifest[]
}) => {
  if (data instanceof MasonryHeaderItem) {
    return <MasonryHeaderMasonryItem width={width} />
  } else {
    return (
      <PhotoMasonryItem
        data={data as PhotoManifest}
        width={width}
        index={index}
        onPhotoClick={onPhotoClick}
        photos={photos}
      />
    )
  }
}

const PhotoMasonryItem = ({
  data,
  width,
  index,
  onPhotoClick,
  photos,
}: {
  data: PhotoManifest
  width: number
  index: number
  onPhotoClick: (index: number, element?: HTMLElement) => void
  photos: PhotoManifest[]
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)

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
    // 找到当前图片在 photos 数组中的索引
    const photoIndex = photos.findIndex((photo) => photo.id === data.id)
    if (photoIndex !== -1 && imageRef.current) {
      onPhotoClick(photoIndex, imageRef.current)
    }
  }

  // 计算基于宽度的高度
  const calculatedHeight = width / data.aspectRatio

  // 根据 index 计算延迟，模拟行级动画
  const animationDelay = Math.floor(index / 3) * 0.1 // 假设每行3个item，每行延迟0.1秒

  // 格式化 EXIF 数据
  const formatExifData = () => {
    const { exif } = data
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

    return {
      focalLength35mm,
      iso,
      shutterSpeed,
      aperture,
    }
  }

  const exifData = formatExifData()

  return (
    <m.div
      ref={ref}
      className="relative w-full overflow-hidden rounded-lg bg-fill-quaternary group cursor-pointer"
      style={{
        width,
        height: calculatedHeight,
      }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.6,
          delay: animationDelay,
          ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuart
        },
      }}
      viewport={{ once: true, amount: 0.1 }}
      onClick={handleClick}
    >
      {/* Blurhash 占位符 */}
      {data.blurhash && !imageLoaded && !imageError && (
        <Blurhash
          hash={data.blurhash}
          width="100%"
          height="100%"
          resolutionX={32}
          resolutionY={32}
          punch={1}
          className="absolute inset-0"
        />
      )}

      {/* 懒加载图片 */}
      {inView && !imageError && (
        <m.img
          ref={imageRef}
          src={data.thumbnailUrl}
          alt={data.title}
          className={clsxm(
            'absolute inset-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-105',
            imageLoaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={handleImageLoad}
          onError={handleImageError}
          initial={{ opacity: 0 }}
          animate={{ opacity: imageLoaded ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* 错误状态 */}
      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-fill-quaternary text-text-tertiary">
          <div className="text-center">
            <i className="i-mingcute-image-line text-2xl" />
            <p className="mt-2 text-sm">Loaded error</p>
          </div>
        </div>
      )}

      {/* 图片信息和 EXIF 覆盖层 */}
      {imageLoaded && (
        <div className="pointer-events-none">
          {/* 渐变背景 - 独立的层 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* 内容层 - 独立的层以支持 backdrop-filter */}
          <div className="absolute inset-x-0 bottom-0 p-4 text-white ">
            <h3 className="text-sm font-medium truncate mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {data.title}
            </h3>
            {data.description && (
              <p className="text-xs text-white/80 mb-3 line-clamp-2">
                {data.description}
              </p>
            )}

            {/* EXIF 信息网格 */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {exifData.focalLength35mm && (
                <div className="flex items-center gap-1.5 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-md rounded-md px-2 py-1">
                  <StreamlineImageAccessoriesLensesPhotosCameraShutterPicturePhotographyPicturesPhotoLens className="text-white/70" />
                  <span className="text-white/90">
                    {exifData.focalLength35mm}mm
                  </span>
                </div>
              )}

              {exifData.aperture && (
                <div className="flex items-center gap-1.5 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-md rounded-md px-2 py-1">
                  <TablerAperture className="text-white/70" />
                  <span className="text-white/90">{exifData.aperture}</span>
                </div>
              )}

              {exifData.shutterSpeed && (
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/10 backdrop-blur-md rounded-md px-2 py-1">
                  <MaterialSymbolsShutterSpeed className="text-white/70" />
                  <span className="text-white/90">{exifData.shutterSpeed}</span>
                </div>
              )}

              {exifData.iso && (
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/10 backdrop-blur-md rounded-md px-2 py-1">
                  <CarbonIsoOutline className="text-white/70" />
                  <span className="text-white/90">ISO {exifData.iso}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </m.div>
  )
}

const MasonryHeaderMasonryItem = ({ width }: { width: number }) => {
  const [gallerySetting, setGallerySetting] = useAtom(gallerySettingAtom)
  return (
    <div
      className="text-2xl flex items-center justify-between whitespace-nowrap w-full bg-material-opaque py-4 px-6 rounded-2xl backdrop-blur-[70px]"
      style={{ width }}
    >
      Photo Gallery
      <Button
        variant="ghost"
        type="button"
        className="ml-2 flex items-center justify-center size-8 p-0 rounded-full -mr-2"
        onClick={() =>
          setGallerySetting({
            ...gallerySetting,
            sortOrder: gallerySetting.sortOrder === 'asc' ? 'desc' : 'asc',
          })
        }
      >
        <i
          className={clsx(
            'i-mingcute-arrow-down-line size-5 transition-transform ease-in-out duration-200',
            gallerySetting.sortOrder === 'asc' && 'rotate-180',
          )}
        />
      </Button>
    </div>
  )
}
