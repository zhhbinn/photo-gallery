import path from 'node:path'

import type { _Object } from '@aws-sdk/client-s3'
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

import { SUPPORTED_FORMATS } from '../../constants/index.js'
import type { Logger } from '../../logger/index.js'
import { s3Client } from '../../s3/client.js'
import type { S3Config, StorageObject, StorageProvider } from '../interfaces'

// 将 AWS S3 对象转换为通用存储对象
function convertS3ObjectToStorageObject(s3Object: _Object): StorageObject {
  return {
    key: s3Object.Key || '',
    size: s3Object.Size,
    lastModified: s3Object.LastModified,
    etag: s3Object.ETag,
  }
}

export class S3StorageProvider implements StorageProvider {
  private config: S3Config

  constructor(config: S3Config) {
    this.config = config
  }

  async getFile(key: string, logger?: Logger['s3']): Promise<Buffer | null> {
    const log = logger

    try {
      log?.info(`下载文件：${key}`)
      const startTime = Date.now()

      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
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

  async listImages(): Promise<StorageObject[]> {
    const listCommand = new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: this.config.prefix,
      MaxKeys: 1000, // 最多获取 1000 张照片
    })

    const listResponse = await s3Client.send(listCommand)
    const objects = listResponse.Contents || []

    // 过滤出图片文件并转换为通用格式
    const imageObjects = objects
      .filter((obj: _Object) => {
        if (!obj.Key) return false
        const ext = path.extname(obj.Key).toLowerCase()
        return SUPPORTED_FORMATS.has(ext)
      })
      .map((obj) => convertS3ObjectToStorageObject(obj))

    return imageObjects
  }

  async listAllFiles(): Promise<StorageObject[]> {
    const listCommand = new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: this.config.prefix,
      MaxKeys: 1000,
    })

    const listResponse = await s3Client.send(listCommand)
    const objects = listResponse.Contents || []

    return objects.map((obj) => convertS3ObjectToStorageObject(obj))
  }

  generatePublicUrl(key: string): string {
    // 如果设置了自定义域名，直接使用自定义域名
    if (this.config.customDomain) {
      const customDomain = this.config.customDomain.replace(/\/$/, '') // 移除末尾的斜杠
      return `${customDomain}/${key}`
    }

    // 如果使用自定义端点，构建相应的 URL
    const { endpoint } = this.config

    if (!endpoint) {
      // 默认 AWS S3 端点
      return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`
    }

    // 检查是否是标准 AWS S3 端点
    if (endpoint.includes('amazonaws.com')) {
      return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`
    }

    // 对于自定义端点（如 MinIO 等）
    const baseUrl = endpoint.replace(/\/$/, '') // 移除末尾的斜杠
    return `${baseUrl}/${this.config.bucket}/${key}`
  }

  detectLivePhotos(allObjects: StorageObject[]): Map<string, StorageObject> {
    const livePhotoMap = new Map<string, StorageObject>() // image key -> video object

    // 按目录和基础文件名分组所有文件
    const fileGroups = new Map<string, StorageObject[]>()

    for (const obj of allObjects) {
      if (!obj.key) continue

      const dir = path.dirname(obj.key)
      const basename = path.basename(obj.key, path.extname(obj.key))
      const groupKey = `${dir}/${basename}`

      if (!fileGroups.has(groupKey)) {
        fileGroups.set(groupKey, [])
      }
      fileGroups.get(groupKey)!.push(obj)
    }

    // 在每个分组中寻找图片 + 视频配对
    for (const files of fileGroups.values()) {
      let imageFile: StorageObject | null = null
      let videoFile: StorageObject | null = null

      for (const file of files) {
        if (!file.key) continue

        const ext = path.extname(file.key).toLowerCase()

        // 检查是否为支持的图片格式
        if (SUPPORTED_FORMATS.has(ext)) {
          imageFile = file
        }
        // 检查是否为 .mov 视频文件
        else if (ext === '.mov') {
          videoFile = file
        }
      }

      // 如果找到配对，记录为 live photo
      if (imageFile && videoFile && imageFile.key) {
        livePhotoMap.set(imageFile.key, videoFile)
      }
    }

    return livePhotoMap
  }
}
