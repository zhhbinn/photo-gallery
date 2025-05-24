import { useEffect, useState } from 'react'

import type { Photo } from '../types/photo'

interface UsePhotosReturn {
  photos: Photo[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePhotos(): UsePhotosReturn {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPhotos = async () => {
    try {
      setLoading(true)
      setError(null)

      // 动态导入 manifest 文件
      const manifestModule = await import('../data/photos-manifest.json')
      const manifest = manifestModule.default

      if (Array.isArray(manifest)) {
        setPhotos(manifest)
      } else {
        throw new TypeError('Invalid manifest format')
      }
    } catch (err) {
      console.error('Failed to load photos:', err)
      setError('加载照片失败，请稍后重试')

      // 如果加载失败，使用示例数据
      setPhotos(generateMockPhotos())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPhotos()
  }, [])

  const refetch = () => {
    loadPhotos()
  }

  return {
    photos,
    loading,
    error,
    refetch,
  }
}

// 生成示例数据用于开发和测试
function generateMockPhotos(): Photo[] {
  const mockPhotos: Photo[] = []

  for (let i = 1; i <= 20; i++) {
    const width = 800 + Math.random() * 400
    const height = 600 + Math.random() * 600
    const aspectRatio = width / height

    mockPhotos.push({
      id: `mock-${i}`,
      title: `示例照片 ${i}`,
      description: `这是第 ${i} 张示例照片的描述。展示了美丽的风景和精彩的瞬间。`,
      dateTaken: new Date(
        Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      views: Math.floor(Math.random() * 1000),
      tags: ['风景', '摄影', '自然'].slice(
        0,
        Math.floor(Math.random() * 3) + 1,
      ),
      originalUrl: `https://picsum.photos/${Math.floor(width)}/${Math.floor(height)}?random=${i}`,
      thumbnailUrl: `https://picsum.photos/400/${Math.floor(400 / aspectRatio)}?random=${i}`,
      blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH', // 示例 blurhash
      width: Math.floor(width),
      height: Math.floor(height),
      aspectRatio,
    })
  }

  return mockPhotos
}
