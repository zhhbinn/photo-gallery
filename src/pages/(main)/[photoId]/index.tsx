import { RemoveScroll } from 'react-remove-scroll'

import { PhotoViewer } from '~/components/ui/photo-viewer'
import { usePhotos, usePhotoViewer } from '~/hooks/usePhotoViewer'

export const Component = () => {
  const photoViewer = usePhotoViewer()
  const photos = usePhotos()
  return (
    <RemoveScroll>
      <PhotoViewer
        photos={photos}
        currentIndex={photoViewer.currentIndex}
        isOpen={photoViewer.isOpen}
        onClose={photoViewer.closeViewer}
        onIndexChange={photoViewer.goToIndex}
      />
    </RemoveScroll>
  )
}
