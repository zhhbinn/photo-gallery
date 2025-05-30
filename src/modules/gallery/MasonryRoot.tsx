import clsx from 'clsx'
import { useAtom, useAtomValue } from 'jotai'
import { m } from 'motion/react'
import { useCallback, useEffect, useMemo } from 'react'

import { gallerySettingAtom } from '~/atoms/app'
import { Button } from '~/components/ui/button'
import { photoLoader } from '~/data/photos'
import { usePhotos, usePhotoViewer } from '~/hooks/usePhotoViewer'
import type { PhotoManifest } from '~/types/photo'

import { Masonry } from './Masonic'
import { PhotoMasonryItem } from './PhotoMasonryItem'

const data = photoLoader.getPhotos()

class MasonryHeaderItem {
  static default = new MasonryHeaderItem()
}

type MasonryItemType = PhotoManifest | MasonryHeaderItem

// 全局动画状态管理器
class AnimationStateManager {
  private static instance: AnimationStateManager
  private animatedItems = new Set<string>()

  static getInstance() {
    if (!AnimationStateManager.instance) {
      AnimationStateManager.instance = new AnimationStateManager()
    }
    return AnimationStateManager.instance
  }

  hasAnimated(key: string): boolean {
    return this.animatedItems.has(key)
  }

  markAsAnimated(key: string): void {
    this.animatedItems.add(key)
  }

  reset(): void {
    this.animatedItems.clear()
  }
}

const animationManager = AnimationStateManager.getInstance()

export const MasonryRoot = () => {
  const { sortOrder } = useAtomValue(gallerySettingAtom)

  // 当排序改变时重置动画状态
  useEffect(() => {
    animationManager.reset()
  }, [sortOrder])

  const photos = usePhotos()

  const photoViewer = usePhotoViewer()

  return (
    <m.div
      key={sortOrder}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Masonry<MasonryItemType>
        key={sortOrder}
        items={useMemo(() => [MasonryHeaderItem.default, ...photos], [photos])}
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
    </m.div>
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
  // 为每个 item 生成唯一的 key 用于追踪动画状态
  const itemKey = useMemo(() => {
    if (data instanceof MasonryHeaderItem) {
      return 'header'
    }
    return (data as PhotoManifest).id
  }, [data])

  // 检查是否已经动画过
  const hasAnimated = animationManager.hasAnimated(itemKey)

  // 标记为已动画
  useEffect(() => {
    if (!hasAnimated) {
      animationManager.markAsAnimated(itemKey)
    }
  }, [hasAnimated, itemKey])

  // 计算动画延迟
  const delay =
    data instanceof MasonryHeaderItem ? 0 : Math.min(index * 0.05, 0.8)

  // Framer Motion 动画变体
  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 30,
      scale: 0.95,
      filter: 'blur(4px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1], // cubic-bezier(0.16, 1, 0.3, 1)
        delay,
      },
    },
  }

  if (data instanceof MasonryHeaderItem) {
    return <MasonryHeaderMasonryItem width={width} />
  } else {
    return (
      <m.div
        key={itemKey}
        variants={itemVariants}
        initial={hasAnimated ? 'visible' : 'hidden'}
        animate="visible"
        layout
        whileHover={{
          scale: 1.02,
          transition: { duration: 0.2 },
        }}
      >
        <PhotoMasonryItem
          data={data as PhotoManifest}
          width={width}
          index={index}
          onPhotoClick={onPhotoClick}
          photos={photos}
        />
      </m.div>
    )
  }
}

const numberFormatter = new Intl.NumberFormat('zh-CN')
const MasonryHeaderMasonryItem = ({ width }: { width: number }) => {
  const [gallerySetting, setGallerySetting] = useAtom(gallerySettingAtom)

  const toggleSortOrder = () => {
    setGallerySetting({
      ...gallerySetting,
      sortOrder: gallerySetting.sortOrder === 'asc' ? 'desc' : 'asc',
    })
  }

  return (
    <div
      className="w-full overflow-hidden rounded-2xl shadow-2xl backdrop-blur-xl border border-border bg-material-medium"
      style={{ width }}
    >
      <div className="relative">
        {/* Decorative gradient bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-accent" />

        {/* Decorative corner elements */}
        <div className="absolute -left-1 -top-1 block size-3 border-l-2 border-t-2 border-blue-500" />
        <div className="absolute -right-1 -top-1 block size-3 border-r-2 border-t-2 border-blue-500" />

        <div className="p-6 relative">
          {/* Main header section */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 shrink-0">
              <div className="size-12 rounded-full bg-gradient-to-br from-blue-500 to-accent flex items-center justify-center shadow-lg">
                <i className="i-mingcute-camera-2-line size-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-text-secondary mt-1">
                  {numberFormatter.format(data?.length || 0)} 张照片
                </p>
                <p className="text-sm text-text-secondary">Innei's Gallery</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="rounded-full px-4 py-2 bg-fill"
                onClick={toggleSortOrder}
              >
                <i
                  className={clsx(
                    'size-4 mr-2 transition-transform duration-200',
                    gallerySetting.sortOrder === 'asc'
                      ? 'i-mingcute-sort-ascending-line'
                      : 'i-mingcute-sort-descending-line',
                  )}
                />
                <span className="text-sm font-medium">
                  {gallerySetting.sortOrder === 'asc' ? '升序' : '降序'}
                </span>
              </Button>
            </div>
          </div>

          {/* Separator line */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-material-medium to-transparent mb-4" />

          {/* Bottom info section */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <i className="i-mingcute-calendar-line size-4 text-text-secondary" />
              <span className="text-text-secondary">构建于</span>
            </div>

            <div className="flex items-center gap-2 text-text-secondary">
              <i className="i-tabler-calendar size-4" />
              <span>
                {new Date(BUILT_DATE).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
