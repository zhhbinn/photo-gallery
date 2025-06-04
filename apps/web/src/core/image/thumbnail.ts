import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {Logger} from '../logger/index.js';
import type { S3Config } from '../storage/interfaces'
import type { ThumbnailResult } from '../types/photo.js'

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
export async function generateThumbnail(
  photoId: string,
  workerLogger?: {
    thumbnail: Logger['thumbnail']
  },
  s3Config?: S3Config | undefined,
  key?: string,
): Promise<ThumbnailResult> {
  const thumbnailLog = workerLogger?.thumbnail

  try {
    const thumbnailDir = path.join(__dirname, '../../../public/thumbnails')
    await fs.mkdir(thumbnailDir, { recursive: true })

    const thumbnailUrl = generateThumbnailUrl(photoId, s3Config, key)

    return {
      thumbnailUrl,
    }
  } catch (error) {
    thumbnailLog?.error(`生成失败：${photoId}`, error)
    return {
      thumbnailUrl: null,
    }
  }
}
