import { useMemo, useState } from 'react'

import { Button } from '~/components/ui/button'
import { WebGLImageViewer } from '~/components/ui/WebGLImageViewer'

export const Component = () => {
  const [file, setFile] = useState<File | null>(null)
  const blobUrl = useMemo(() => {
    if (!file) return null
    return URL.createObjectURL(file)
  }, [file])
  return (
    <div className="relative flex h-svh w-full flex-col gap-4">
      <div>
        <Button
          className="shrink-0"
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) {
                setFile(file)
              }
            }
            input.click()
          }}
        >
          Upload
        </Button>
      </div>
      {blobUrl && (
        <div className="relative grow">
          <WebGLImageViewer debug src={blobUrl} />
        </div>
      )}
    </div>
  )
}
