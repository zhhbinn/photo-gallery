import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { _Object, S3ClientConfig } from '@aws-sdk/client-s3'
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { encode } from 'blurhash'
import sharp from 'sharp'

import { env } from '../env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 创建 S3 客户端
const s3ClientConfig: S3ClientConfig = {
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
}

// 如果提供了自定义端点，则使用它
if (env.S3_ENDPOINT) {
  s3ClientConfig.endpoint = env.S3_ENDPOINT
}

const s3Client = new S3Client(s3ClientConfig)

// 支持的图片格式
const SUPPORTED_FORMATS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
])

// 定义类型
interface PhotoInfo {
  title: string
  dateTaken: string
  views: number
  tags: string[]
  description: string
}

interface ImageMetadata {
  width: number
  height: number
  format: string
}

interface PhotoManifestItem {
  id: string
  title: string
  description: string
  dateTaken: string
  views: number
  tags: string[]
  originalUrl: string
  thumbnailUrl: string | null
  blurhash: string | null
  width: number
  height: number
  aspectRatio: number
  s3Key: string
  lastModified: string
  size: number
}

// 生成 blurhash
async function generateBlurhash(imageBuffer: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true })

    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4)
  } catch (error) {
    console.error('生成 blurhash 失败:', error)
    return null
  }
}

// 生成缩略图
async function generateThumbnail(
  imageBuffer: Buffer,
  photoId: string,
): Promise<string | null> {
  try {
    const thumbnailDir = path.join(__dirname, '../public/thumbnails')
    await fs.mkdir(thumbnailDir, { recursive: true })

    const thumbnailPath = path.join(thumbnailDir, `${photoId}.webp`)

    await sharp(imageBuffer)
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(thumbnailPath)

    return `/thumbnails/${photoId}.webp`
  } catch (error) {
    console.error('生成缩略图失败:', error)
    return null
  }
}

// 从 S3 获取图片
async function getImageFromS3(key: string): Promise<Buffer | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
    })

    const response = await s3Client.send(command)

    if (!response.Body) {
      console.error(`S3 响应中没有 Body: ${key}`)
      return null
    }

    // 处理不同类型的 Body
    if (response.Body instanceof Buffer) {
      return response.Body
    }

    // 如果是 Readable stream
    const chunks: Uint8Array[] = []
    const stream = response.Body as NodeJS.ReadableStream

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Uint8Array) => {
        chunks.push(chunk)
      })

      stream.on('end', () => {
        resolve(Buffer.concat(chunks))
      })

      stream.on('error', (error) => {
        console.error(`从 S3 获取图片失败 ${key}:`, error)
        reject(error)
      })
    })
  } catch (error) {
    console.error(`从 S3 获取图片失败 ${key}:`, error)
    return null
  }
}

// 获取图片元数据
async function getImageMetadata(
  imageBuffer: Buffer,
): Promise<ImageMetadata | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata()

    if (!metadata.width || !metadata.height || !metadata.format) {
      console.error('图片元数据不完整')
      return null
    }

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    }
  } catch (error) {
    console.error('获取图片元数据失败:', error)
    return null
  }
}

// 从文件名提取照片信息
function extractPhotoInfo(key: string): PhotoInfo {
  const fileName = path.basename(key, path.extname(key))

  // 尝试从文件名解析信息，格式示例: "2024-01-15_城市夜景_1250views"
  let title = fileName
  let dateTaken = new Date().toISOString()
  let views = 0
  const tags: string[] = []

  // 如果文件名包含日期
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/)
  if (dateMatch) {
    dateTaken = new Date(dateMatch[1]).toISOString()
  }

  // 如果文件名包含浏览次数
  const viewsMatch = fileName.match(/(\d+)views?/i)
  if (viewsMatch) {
    views = Number.parseInt(viewsMatch[1])
  }

  // 从文件名中提取标题（移除日期和浏览次数）
  title = fileName
    .replaceAll(/\d{4}-\d{2}-\d{2}[_-]?/g, '')
    .replaceAll(/[_-]?\d+views?/gi, '')
    .replaceAll(/[_-]+/g, ' ')
    .trim()

  // 如果标题为空，使用文件名
  if (!title) {
    title = path.basename(key, path.extname(key))
  }

  return {
    title,
    dateTaken,
    views,
    tags,
    description: '', // 可以从 EXIF 或其他元数据中获取
  }
}

// 生成 S3 公共 URL
function generateS3Url(key: string): string {
  const bucketName = env.S3_BUCKET_NAME

  // 如果没有自定义端点，使用标准 AWS S3 URL
  if (!env.S3_ENDPOINT) {
    return `https://${bucketName}.s3.${env.S3_REGION}.amazonaws.com/${key}`
  }

  // 如果使用自定义端点，构建相应的 URL
  const endpoint = env.S3_ENDPOINT

  // 检查是否是标准 AWS S3 端点
  if (endpoint.includes('amazonaws.com')) {
    return `https://${bucketName}.s3.${env.S3_REGION}.amazonaws.com/${key}`
  }

  // 对于自定义端点（如 MinIO 等）
  const baseUrl = endpoint.replace(/\/$/, '') // 移除末尾的斜杠
  return `${baseUrl}/${bucketName}/${key}`
}

// 主函数
async function buildManifest(): Promise<void> {
  try {
    console.info('开始从 S3 获取照片列表...')
    console.info(`使用端点: ${env.S3_ENDPOINT || '默认 AWS S3'}`)
    console.info(`存储桶: ${env.S3_BUCKET_NAME}`)
    console.info(`前缀: ${env.S3_PREFIX || '无前缀'}`)

    // 列出 S3 中的所有图片文件
    const listCommand = new ListObjectsV2Command({
      Bucket: env.S3_BUCKET_NAME,
      Prefix: env.S3_PREFIX,
      MaxKeys: 1000, // 最多获取 1000 张照片
    })

    const listResponse = await s3Client.send(listCommand)
    const objects = listResponse.Contents || []

    // 过滤出图片文件
    const imageObjects = objects.filter((obj: _Object) => {
      if (!obj.Key) return false
      const ext = path.extname(obj.Key).toLowerCase()
      return SUPPORTED_FORMATS.has(ext)
    })

    console.info(`找到 ${imageObjects.length} 张照片`)

    const manifest: PhotoManifestItem[] = []

    for (const [index, obj] of imageObjects.entries()) {
      const key = obj.Key
      if (!key) {
        console.warn(`跳过没有 Key 的对象`)
        continue
      }

      const photoId = path.basename(key, path.extname(key))

      console.info(`处理照片 ${index + 1}/${imageObjects.length}: ${key}`)

      // 获取图片数据
      const imageBuffer = await getImageFromS3(key)
      if (!imageBuffer) continue

      // 获取图片元数据
      const metadata = await getImageMetadata(imageBuffer)
      if (!metadata) continue

      // 提取照片信息
      const photoInfo = extractPhotoInfo(key)

      // 生成 blurhash 和缩略图
      const [blurhash, thumbnailUrl] = await Promise.all([
        generateBlurhash(imageBuffer),
        generateThumbnail(imageBuffer, photoId),
      ])

      const aspectRatio = metadata.width / metadata.height

      manifest.push({
        id: photoId,
        title: photoInfo.title,
        description: photoInfo.description,
        dateTaken: photoInfo.dateTaken,
        views: photoInfo.views,
        tags: photoInfo.tags,
        originalUrl: generateS3Url(key),
        thumbnailUrl,
        blurhash,
        width: metadata.width,
        height: metadata.height,
        aspectRatio,
        s3Key: key,
        lastModified:
          obj.LastModified?.toISOString() || new Date().toISOString(),
        size: obj.Size || 0,
      })

      // 添加延迟避免过快处理
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 按日期排序（最新的在前）
    manifest.sort(
      (a, b) =>
        new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime(),
    )

    // 保存 manifest
    const manifestPath = path.join(
      __dirname,
      '../src/data/photos-manifest.json',
    )
    await fs.mkdir(path.dirname(manifestPath), { recursive: true })
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

    console.info(`✅ 成功生成 manifest，包含 ${manifest.length} 张照片`)
    console.info(`📁 Manifest 保存至: ${manifestPath}`)
  } catch (error) {
    console.error('构建 manifest 失败:', error)
    throw error
  }
}

buildManifest()
