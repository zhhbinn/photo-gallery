import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { defineConfig } from 'vite'
import { checker } from 'vite-plugin-checker'
import tsconfigPaths from 'vite-tsconfig-paths'

import { siteConfig } from './config/site.config'
import PKG from './package.json'
import { ogImagePlugin } from './plugins/og-image-plugin'

const ReactCompilerConfig = {
  /* ... */
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', ReactCompilerConfig]],
      },
    }),
    tsconfigPaths(),
    checker({
      typescript: true,
      enableBuild: true,
    }),
    codeInspectorPlugin({
      bundler: 'vite',
      hotKeys: ['altKey'],
    }),
    tailwindcss(),
    ogImagePlugin({
      title: siteConfig.title,
      description: siteConfig.description,
      siteName: siteConfig.name,
      siteUrl: siteConfig.url,
    }),
  ],
  define: {
    APP_DEV_CWD: JSON.stringify(process.cwd()),
    APP_NAME: JSON.stringify(PKG.name),
    BUILT_DATE: JSON.stringify(new Date().toLocaleDateString()),
  },
})
