import { heicTo, isHeic } from 'heic-to'

export interface HeicConversionOptions {
  quality?: number
  format?: 'image/jpeg' | 'image/png'
}

export interface ConversionResult {
  blob: Blob
  url: string
  originalSize: number
  convertedSize: number
  format: string
}

/**
 * 检测文件是否为 HEIC/HEIF 格式
 */
export async function detectHeicFormat(file: File | Blob): Promise<boolean> {
  try {
    return await isHeic(file as File)
  } catch (error) {
    console.warn('Failed to detect HEIC format:', error)
    return false
  }
}

/**
 * 将 HEIC/HEIF 图片转换为 JPEG 或 PNG
 */
export async function convertHeicImage(
  file: File | Blob,
  options: HeicConversionOptions = {},
): Promise<ConversionResult> {
  const { quality = 0.8, format = 'image/jpeg' } = options

  try {
    // 检查是否为 HEIC 格式
    const isHeicFormat = await detectHeicFormat(file)
    if (!isHeicFormat) {
      throw new Error('File is not in HEIC/HEIF format')
    }

    // 转换图片
    const convertedBlob = await heicTo({
      blob: file,
      type: format,
      quality,
    })

    // 创建 URL
    const url = URL.createObjectURL(convertedBlob)

    return {
      blob: convertedBlob,
      url,
      originalSize: file.size,
      convertedSize: convertedBlob.size,
      format,
    }
  } catch (error) {
    console.error('HEIC conversion failed:', error)
    throw new Error(
      `Failed to convert HEIC image: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * 清理转换后的 URL
 */
export function revokeConvertedUrl(url: string): void {
  try {
    URL.revokeObjectURL(url)
  } catch (error) {
    console.warn('Failed to revoke URL:', error)
  }
}

/**
 * 获取文件的 MIME 类型
 */
export function getFileMimeType(file: File): string {
  return file.type || 'application/octet-stream'
}

/**
 * 检查文件是否可能是 HEIC 格式（基于扩展名）
 */
export function isPotentialHeicFile(file: File): boolean {
  const fileName = file.name.toLowerCase()
  return fileName.endsWith('.heic') || fileName.endsWith('.heif')
}

/**
 * 批量转换 HEIC 图片
 */
export async function convertMultipleHeicImages(
  files: (File | Blob)[],
  options: HeicConversionOptions = {},
  onProgress?: (completed: number, total: number) => void,
): Promise<ConversionResult[]> {
  const results: ConversionResult[] = []

  for (let i = 0; i < files.length; i++) {
    try {
      const result = await convertHeicImage(files[i], options)
      results.push(result)
    } catch (error) {
      console.error(`Failed to convert file ${i}:`, error)
      // 继续处理其他文件，不中断整个流程
    }

    onProgress?.(i + 1, files.length)
  }

  return results
}
