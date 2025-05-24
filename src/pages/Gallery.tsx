import { motion } from 'motion/react'

import { Header } from '../components/Header'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { MasonryGrid } from '../components/MasonryGrid'
import { usePhotos } from '../hooks/usePhotos'

export function Gallery() {
  const { photos, loading, error, refetch } = usePhotos()

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <LoadingSpinner size="lg" text="正在加载照片..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-white text-xl mb-2">加载失败</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              type="button"
              onClick={refetch}
              className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors"
            >
              重试
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Header photoCount={photos.length} />

      <main className="max-w-7xl mx-auto">
        {photos.length > 0 ? (
          <MasonryGrid photos={photos} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-6xl mb-4">📷</div>
              <h2 className="text-white text-xl mb-2">暂无照片</h2>
              <p className="text-gray-400">
                还没有上传任何照片，请稍后再来查看。
              </p>
            </motion.div>
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="mt-16 py-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            © 2024 摄影作品集. 用心记录每一个美好瞬间.
          </p>
        </div>
      </footer>
    </div>
  )
}
