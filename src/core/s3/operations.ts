import path from 'node:path'

import type { _Object } from '@aws-sdk/client-s3'
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

import { env } from '../../../env.js'
import type { Logger } from '../logger/index.js'
import { s3Client, SUPPORTED_FORMATS } from './client.js'

// 从 S3 获取图片
export async function getImageFromS3(
  key: string,
  s3Logger?: Logger['s3'],
): Promise<Buffer | null> {
  const log = s3Logger

  try {
    log?.info(`下载图片：${key}`)
    const startTime = Date.now()

    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
    })

    const response = await s3Client.send(command)

    if (!response.Body) {
      log?.error(`S3 响应中没有 Body: ${key}`)
      return null
    }

    // 处理不同类型的 Body
    if (response.Body instanceof Buffer) {
      const duration = Date.now() - startTime
      const sizeKB = Math.round(response.Body.length / 1024)
      log?.success(`下载完成：${key} (${sizeKB}KB, ${duration}ms)`)
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
        const buffer = Buffer.concat(chunks)
        const duration = Date.now() - startTime
        const sizeKB = Math.round(buffer.length / 1024)
        log?.success(`下载完成：${key} (${sizeKB}KB, ${duration}ms)`)
        resolve(buffer)
      })

      stream.on('error', (error) => {
        log?.error(`下载失败：${key}`, error)
        reject(error)
      })
    })
  } catch (error) {
    log?.error(`下载失败：${key}`, error)
    return null
  }
}

// 列出 S3 中的所有图片文件
export async function listImagesFromS3(): Promise<_Object[]> {
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

  return imageObjects
}

// 生成 S3 公共 URL
export function generateS3Url(key: string): string {
  const bucketName = env.S3_BUCKET_NAME

  // 如果设置了自定义域名，直接使用自定义域名
  if (env.S3_CUSTOM_DOMAIN) {
    const customDomain = env.S3_CUSTOM_DOMAIN.replace(/\/$/, '') // 移除末尾的斜杠
    return `${customDomain}/${bucketName}/${key}`
  }

  // 如果使用自定义端点，构建相应的 URL
  const endpoint = env.S3_ENDPOINT

  // 检查是否是标准 AWS S3 端点
  if (endpoint.includes('amazonaws.com')) {
    return `https://${bucketName}.s3.${env.S3_REGION}.amazonaws.com/${bucketName}/${key}`
  }

  // 对于自定义端点（如 MinIO 等）
  const baseUrl = endpoint.replace(/\/$/, '') // 移除末尾的斜杠
  return `${baseUrl}/${bucketName}/${key}`
}
