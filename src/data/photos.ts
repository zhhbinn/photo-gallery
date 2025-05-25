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
