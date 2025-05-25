import { useCallback, useState } from 'react'

import type { PhotoManifest } from '~/types/photo'

export const usePhotoViewer = (photos: PhotoManifest[]) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null)

  const openViewer = useCallback((index: number, element?: HTMLElement) => {
    setCurrentIndex(index)
    setTriggerElement(element || null)
    setIsOpen(true)
    // 防止背景滚动
    document.body.style.overflow = 'hidden'
  }, [])

  const closeViewer = useCallback(() => {
    setIsOpen(false)
    setTriggerElement(null)
    // 恢复背景滚动
    document.body.style.overflow = ''
  }, [])

  const goToNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [currentIndex, photos.length])

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }, [currentIndex])

  const goToIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < photos.length) {
        setCurrentIndex(index)
      }
    },
    [photos.length],
  )

  return {
    isOpen,
    currentIndex,
    triggerElement,
    openViewer,
    closeViewer,
    goToNext,
    goToPrevious,
    goToIndex,
  }
}
