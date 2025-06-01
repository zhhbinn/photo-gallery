import type { S3ClientConfig } from '@aws-sdk/client-s3'
import { S3Client } from '@aws-sdk/client-s3'

import { env } from '../../../env.js'

// 创建 S3 客户端
function createS3Client(): S3Client {
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

  return new S3Client(s3ClientConfig)
}

export const s3Client = createS3Client()

// 支持的图片格式
export const SUPPORTED_FORMATS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
  '.heic',
  '.heif',
  '.hif',
])

// HEIC/HEIF 格式
export const HEIC_FORMATS = new Set(['.heic', '.heif', '.hif'])
