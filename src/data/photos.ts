import type { PhotoManifest } from '~/types/photo'

import PhotosManifest from './photos-manifest.json'

class PhotoLoader {
  private photos: PhotoManifest[] = []
  private photoMap: Record<string, PhotoManifest> = {}

  constructor() {
    this.photos = PhotosManifest as unknown as PhotoManifest[]
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
