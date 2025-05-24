import { useEffect, useMemo, useState } from 'react'

import type { Photo } from '../types/photo'
import { PhotoCard } from './PhotoCard'
import { PhotoModal } from './PhotoModal'

interface MasonryGridProps {
  photos: Photo[]
  columns?: number
}

export function MasonryGrid({ photos, columns = 4 }: MasonryGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentColumns, setCurrentColumns] = useState(columns)

  // 响应式列数
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth
      if (width < 640) {
        setCurrentColumns(1)
      } else if (width < 768) {
        setCurrentColumns(2)
      } else if (width < 1024) {
        setCurrentColumns(3)
      } else if (width < 1280) {
        setCurrentColumns(4)
      } else {
        setCurrentColumns(5)
      }
    }

    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [])

  // 将照片分配到不同的列
  const photoColumns = useMemo(() => {
    const cols: Photo[][] = Array.from({ length: currentColumns }, () => [])
    const colHeights = Array.from({ length: currentColumns }, () => 0)

    photos.forEach((photo) => {
      // 找到高度最小的列
      const minHeightIndex = colHeights.indexOf(Math.min(...colHeights))
      cols[minHeightIndex].push(photo)
      // 估算照片高度（基于宽高比）
      colHeights[minHeightIndex] += 300 / photo.aspectRatio
    })

    return cols
  }, [photos, currentColumns])

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setTimeout(() => setSelectedPhoto(null), 300)
  }

  const handleNextPhoto = () => {
    if (!selectedPhoto) return
    const currentIndex = photos.findIndex((p) => p.id === selectedPhoto.id)
    const nextIndex = (currentIndex + 1) % photos.length
    setSelectedPhoto(photos[nextIndex])
  }

  const handlePrevPhoto = () => {
    if (!selectedPhoto) return
    const currentIndex = photos.findIndex((p) => p.id === selectedPhoto.id)
    const prevIndex = (currentIndex - 1 + photos.length) % photos.length
    setSelectedPhoto(photos[prevIndex])
  }

  return (
    <>
      <div
        className="grid gap-4 p-4"
        style={{
          gridTemplateColumns: `repeat(${currentColumns}, 1fr)`,
        }}
      >
        {photoColumns.map((columnPhotos, columnIndex) => (
          <div key={`column-${columnIndex}`} className="flex flex-col gap-4">
            {columnPhotos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onClick={handlePhotoClick}
              />
            ))}
          </div>
        ))}
      </div>

      <PhotoModal
        photo={selectedPhoto}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onNext={handleNextPhoto}
        onPrev={handlePrevPhoto}
      />
    </>
  )
}
