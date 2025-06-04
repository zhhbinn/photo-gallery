import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import type { Logger } from '../logger/index.js'
import type { S3Config } from '../storage/interfaces'
import type { ThumbnailResult } from '../types/photo.js'
import { generateBlurhash } from './blurhash.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 生成缩略图 URL
function generateThumbnailUrl(
  photoId: string,
  s3Config?: S3Config,
  key?: string,
): string {
  // 如果设置了自定义域名，直接使用自定义域名
  if (s3Config?.customDomain) {
    const customDomain = s3Config.customDomain.replace(/\/$/, '') // 移除末尾的斜杠
    return `${customDomain}/${key}?width=316`
  }

  // 如果没有自定义域名，使用相对路径
  return `/thumbnails/${photoId}.webp?width=316`
}

// 检查缩略图是否存在
export async function thumbnailExists(photoId: string): Promise<boolean> {
  try {
    const thumbnailPath = path.join(
      __dirname,
      '../../../public/thumbnails',
      `${photoId}.webp`,
    )
    await fs.access(thumbnailPath)
    return true
  } catch {
    return false
  }
}

// 生成缩略图和 blurhash（复用 Sharp 实例）
export async function generateThumbnailAndBlurhash(
  imageBuffer: Buffer,
  photoId: string,
  originalWidth: number,
  originalHeight: number,
  forceRegenerate = false,
  workerLogger?: {
    thumbnail: Logger['thumbnail']
    blurhash: Logger['blurhash']
  },
  s3Config?: S3Config | undefined,
  key?: string,
): Promise<ThumbnailResult> {
  const thumbnailLog = workerLogger?.thumbnail
  const blurhashLog = workerLogger?.blurhash

  try {
    const thumbnailDir = path.join(__dirname, '../../../public/thumbnails')
    await fs.mkdir(thumbnailDir, { recursive: true })

    const thumbnailPath = path.join(thumbnailDir, `${photoId}.webp`)
    const thumbnailUrl = generateThumbnailUrl(photoId, s3Config, key)

    // 如果不是强制模式且缩略图已存在，读取现有文件
    if (!forceRegenerate && (await thumbnailExists(photoId))) {
      thumbnailLog?.info(`复用现有缩略图：${photoId}`)
      try {
        const existingBuffer = await fs.readFile(thumbnailPath)

        // 基于现有缩略图生成 blurhash
        const blurhash = await generateBlurhash(
          existingBuffer,
          originalWidth,
          originalHeight,
          blurhashLog,
        )

        return {
          thumbnailUrl,
          thumbnailBuffer: existingBuffer,
          blurhash,
        }
      } catch (error) {
        thumbnailLog?.warn(`读取现有缩略图失败，重新生成：${photoId}`, error)
        // 继续执行生成逻辑
      }
    }

    thumbnailLog?.info(`生成缩略图：${photoId}`)
    const startTime = Date.now()

    // 创建 Sharp 实例，复用于缩略图和 blurhash 生成
    const sharpInstance = sharp(imageBuffer).rotate() // 自动根据 EXIF 旋转

    // 生成缩略图
    const thumbnailBuffer = await sharpInstance
      .clone() // 克隆实例用于缩略图生成
      .resize(600, null, {
        withoutEnlargement: true,
      })
      .webp({
        quality: 100,
      })
      .toBuffer()

    // 保存到文件
    await fs.writeFile(thumbnailPath, thumbnailBuffer)

    const duration = Date.now() - startTime
    const sizeKB = Math.round(thumbnailBuffer.length / 1024)
    thumbnailLog?.success(`生成完成：${photoId} (${sizeKB}KB, ${duration}ms)`)

    // 基于生成的缩略图生成 blurhash
    const blurhash = await generateBlurhash(
      thumbnailBuffer,
      originalWidth,
      originalHeight,
      blurhashLog,
    )

    return {
      thumbnailUrl,
      thumbnailBuffer,
      blurhash,
    }
  } catch (error) {
    thumbnailLog?.error(`生成失败：${photoId}`, error)
    return {
      thumbnailUrl: null,
      thumbnailBuffer: null,
      blurhash: null,
    }
  }
}
