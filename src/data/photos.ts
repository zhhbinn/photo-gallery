import type { PhotoManifest } from '~/types/photo'

import PhotosManifest from './photos-manifest.json'

class PhotoLoader {
  private photos: PhotoManifest[] = []
  private photoMap: Record<string, PhotoManifest> = {}

  constructor() {
    if (import.meta.env.DEV) {
      this.photos = PhotosManifest.map((photo) => ({
        ...photo,
        originalUrl: photo.originalUrl.replace(
          'https://s3-private.innei.in',
          'http://10.0.0.33:18888',
        ),
      })) as unknown as PhotoManifest[]

      this.photos.unshift({
        id: 'thomas-x2d-xcd-25v-1',
        title: 'thomas x2d xcd 25v 1',
        description: '',

        views: 0,
        tags: [],
        originalUrl: '/thomas-x2d-xcd-25v-1.jpg',
        thumbnailUrl: '/thomas-x2d-xcd-25v-1.webp',
        blurhash: 'U56lJSD%Y-T[49+_QXySRLE9$lY3=Ww4J%Xh',
        width: 11657,
        height: 8741,
        aspectRatio: 1.3336002745681272,
        s3Key: 'thomas-x2d-xcd-25v-1.jpg',
        lastModified: '2025-05-27T05:24:23.918Z',
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

  getPhotos() {
    return this.photos
  }

  getPhoto(id: string) {
    return this.photoMap[id]
  }
}
export const photoLoader = new PhotoLoader()
