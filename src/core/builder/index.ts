import { env } from '../../../env.js'
import { logger } from '../logger/index.js'
import {
  handleDeletedPhotos,
  loadExistingManifest,
  saveManifest,
} from '../manifest/manager.js'
import type { PhotoProcessorOptions } from '../photo/processor.js'
import { processPhoto } from '../photo/processor.js'
import { listImagesFromS3 } from '../s3/operations.js'
import type { PhotoManifestItem, ProcessPhotoResult } from '../types/photo.js'
import { WorkerPool } from '../worker/pool.js'

export interface BuilderOptions {
  isForceMode: boolean
  isForceManifest: boolean
  isForceThumbnails: boolean
  concurrencyLimit: number
}

// 主构建函数
export async function buildManifest(options: BuilderOptions): Promise<void> {
  const startTime = Date.now()

  try {
    logger.main.info('🚀 开始从 S3 获取照片列表...')
    logger.main.info(`🔗 使用端点：${env.S3_ENDPOINT || '默认 AWS S3'}`)
    logger.main.info(`🌐 自定义域名：${env.S3_CUSTOM_DOMAIN || '未设置'}`)
    logger.main.info(`🪣 存储桶：${env.S3_BUCKET_NAME}`)
    logger.main.info(`📂 前缀：${env.S3_PREFIX || '无前缀'}`)

    // 读取现有的 manifest（如果存在）
    const existingManifest =
      options.isForceMode || options.isForceManifest
        ? []
        : await loadExistingManifest()
    const existingManifestMap = new Map(
      existingManifest.map((item) => [item.s3Key, item]),
    )

    logger.main.info(`现有 manifest 包含 ${existingManifest.length} 张照片`)

    // 列出 S3 中的所有图片文件
    const imageObjects = await listImagesFromS3()
    logger.main.info(`S3 中找到 ${imageObjects.length} 张照片`)

    // 创建 S3 中存在的图片 key 集合，用于检测已删除的图片
    const validKeys = imageObjects.map((obj) => obj.Key).filter(Boolean)
    const s3ImageKeys = new Set(validKeys)

    const manifest: PhotoManifestItem[] = []
    let processedCount = 0
    let skippedCount = 0
    let newCount = 0
    let deletedCount = 0

    if (imageObjects.length > 0) {
      // 创建 Worker 池
      const workerPool = new WorkerPool<ProcessPhotoResult>(
        {
          concurrency: options.concurrencyLimit,
          totalTasks: imageObjects.length,
        },
        logger,
      )

      const processorOptions: PhotoProcessorOptions = {
        isForceMode: options.isForceMode,
        isForceManifest: options.isForceManifest,
        isForceThumbnails: options.isForceThumbnails,
      }

      // 执行并发处理
      const results = await workerPool.execute(async (taskIndex, workerId) => {
        const obj = imageObjects[taskIndex]
        return await processPhoto(
          obj,
          taskIndex,
          workerId,
          imageObjects.length,
          existingManifestMap,
          processorOptions,
          logger,
        )
      })

      // 统计结果并添加到 manifest
      for (const result of results) {
        if (result.item) {
          manifest.push(result.item)

          switch (result.type) {
            case 'new': {
              newCount++
              processedCount++
              break
            }
            case 'processed': {
              processedCount++
              break
            }
            case 'skipped': {
              skippedCount++
              break
            }
          }
        }
      }
    }

    // 检测并处理已删除的图片
    if (
      !options.isForceMode &&
      !options.isForceManifest &&
      existingManifest.length > 0
    ) {
      deletedCount = await handleDeletedPhotos(
        existingManifest,
        s3ImageKeys,
        logger.main,
        logger.fs,
      )
    }

    // 保存 manifest
    await saveManifest(manifest, logger.fs)

    // 计算总处理时间
    const totalDuration = Date.now() - startTime
    const durationSeconds = Math.round(totalDuration / 1000)
    const durationMinutes = Math.floor(durationSeconds / 60)
    const remainingSeconds = durationSeconds % 60

    logger.main.success(`🎉 Manifest 构建完成!`)
    logger.main.info(`📊 处理统计:`)
    logger.main.info(`   📸 总照片数：${manifest.length}`)
    logger.main.info(`   🆕 新增照片：${newCount}`)
    logger.main.info(`   🔄 处理照片：${processedCount}`)
    logger.main.info(`   ⏭️ 跳过照片：${skippedCount}`)
    logger.main.info(`   🗑️ 删除照片：${deletedCount}`)
    logger.main.info(
      `   ⏱️ 总耗时：${durationMinutes > 0 ? `${durationMinutes}分${remainingSeconds}秒` : `${durationSeconds}秒`}`,
    )
  } catch (error) {
    logger.main.error('❌ 构建 manifest 失败：', error)
    throw error
  }
}
