import { defineConfig } from 'nbump'

export default defineConfig({
  publish: true,
  tag: false,
  commit: true,
  commitMessage: 'chore(webgl-viewer): bump version ${NEW_VERSION}',
})
