export interface Photo {
  id: string
  title: string
  description: string
  dateTaken: string
  views: number
  tags: string[]
  originalUrl: string
  thumbnailUrl: string
  blurhash: string | null
  width: number
  height: number
  aspectRatio: number
  s3Key?: string
  lastModified?: string
  size?: number
}

export interface PhotoManifest {
  photos: Photo[]
  lastUpdated: string
}
