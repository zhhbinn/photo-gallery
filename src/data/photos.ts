import type { PhotoManifest } from '~/types/photo'

import PhotosManifest from './photos-manifest.json'

class PhotoLoader {
  private photos: PhotoManifest[] = []
  private photoMap: Record<string, PhotoManifest> = {}

  constructor() {
    this.getAllTags = this.getAllTags.bind(this)
    this.getPhotos = this.getPhotos.bind(this)
    this.getPhoto = this.getPhoto.bind(this)

    if (import.meta.env.DEV) {
      this.photos = PhotosManifest.map((photo, index) => ({
        ...photo,
        originalUrl: photo.originalUrl.replace(
          'https://s3-private.innei.in',
          'http://10.0.0.33:18888',
        ),
        // 为演示目的添加一些示例标签
        tags: this.generateSampleTags(index, photo.id),
      })) as unknown as PhotoManifest[]

      this.photos.unshift({
        id: 'thomas-x2d-xcd-25v-1',
        title: 'thomas x2d xcd 25v 1',
        description: '',

        views: 0,
        tags: ['人像', '室内', '哈苏'],
        originalUrl: '/thomas-x2d-xcd-25v-1.jpg',
        thumbnailUrl: '/thomas-x2d-xcd-25v-1.webp',
        blurhash: 'U56lJSD%Y-T[49+_QXySRLE9$lY3=Ww4J%Xh',
        width: 11657,
        height: 8741,
        aspectRatio: 1.3336002745681272,
        s3Key: 'thomas-x2d-xcd-25v-1.jpg',
        lastModified: new Date().toISOString(),
        size: 67527869,
        exif: {
          bigEndian: false,
          Image: {
            Make: 'Hasselblad',
            Model: 'X2D 100C',
            Orientation: 1,
            XResolution: 300,
            YResolution: 300,
            ResolutionUnit: 2,
            Software: '3.1.0',
            ExifTag: 192,
          },
          Photo: {
            ExposureTime: 0.1,
            FNumber: 2.5,
            ExposureProgram: 3,
            ISOSpeedRatings: 800,

            ShutterSpeedValue: 3.321928,
            ApertureValue: 2.643856,
            ExposureBiasValue: -6,
            MaxApertureValue: 2.64,
            MeteringMode: 2,
            Flash: 0,
            FocalLength: 25,
            SubSecTimeOriginal: '1',
            ColorSpace: 1,
            PixelXDimension: 11657,
            PixelYDimension: 8741,
            FocalPlaneXResolution: 2659.574462890625,
            FocalPlaneYResolution: 2659.574462890625,
            FocalPlaneResolutionUnit: 3,
            FocalLengthIn35mmFilm: 19,
            ImageUniqueID: '00000000000058540140AE5800000C38',
          },
        },
      })
    } else {
      this.photos = PhotosManifest as unknown as PhotoManifest[]
    }
    this.photos.forEach((photo) => {
      this.photoMap[photo.id] = photo
    })
  }

  // 为演示目的生成示例标签
  private generateSampleTags(index: number, photoId: string): string[] {
    const tags: string[] = []

    // 根据索引和照片ID生成一些标签
    if (index % 5 === 0) tags.push('风景')
    if (index % 7 === 0) tags.push('人像')
    if (index % 3 === 0) tags.push('街拍')
    if (index % 11 === 0) tags.push('建筑')
    if (index % 4 === 0) tags.push('自然')
    if (index % 13 === 0) tags.push('夜景')
    if (index % 17 === 0) tags.push('微距')
    if (index % 19 === 0) tags.push('黑白')

    // 所有富士相机的照片都添加"富士"标签
    if (photoId.startsWith('DSCF')) tags.push('富士')

    // 随机添加室内/室外标签
    if (index % 2 === 0) {
      tags.push('室外')
    } else {
      tags.push('室内')
    }

    return [...new Set(tags)] // 去重
  }

  getPhotos() {
    return this.photos
  }

  getPhoto(id: string) {
    return this.photoMap[id]
  }

  getAllTags() {
    const tagSet = new Set<string>()
    this.photos.forEach((photo) => {
      photo.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }
}
export const photoLoader = new PhotoLoader()
