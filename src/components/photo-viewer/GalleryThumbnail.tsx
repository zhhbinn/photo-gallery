import { m } from 'motion/react'
import type { FC } from 'react'
import { useEffect, useRef } from 'react'

import { clsxm } from '~/lib/cn'
import type { PhotoManifest } from '~/types/photo'

export const GalleryThumbnail: FC<{
  currentIndex: number
  photos: PhotoManifest[]
  onIndexChange: (index: number) => void
}> = ({ currentIndex, photos, onIndexChange }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    const currentThumbnail = thumbnailRefs.current[currentIndex]

    if (scrollContainer && currentThumbnail) {
      const containerWidth = scrollContainer.clientWidth
      const thumbnailLeft = currentThumbnail.offsetLeft
      const thumbnailWidth = currentThumbnail.clientWidth

      const scrollLeft = thumbnailLeft - containerWidth / 2 + thumbnailWidth / 2

      scrollContainer.scrollTo({
        left: scrollLeft,
        behavior: 'smooth',
      })
    }
  }, [currentIndex])

  return (
    <m.div
      className="z-10 shrink-0 backdrop-blur-3xl bg-material-medium"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-material-medium backdrop-blur-[70px]">
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto p-4 scrollbar-none"
        >
          {photos.map((photo, index) => (
            <button
              type="button"
              key={photo.id}
              ref={(el) => {
                thumbnailRefs.current[index] = el
              }}
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
