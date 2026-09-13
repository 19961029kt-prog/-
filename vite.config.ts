import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages（プロジェクトページ）ではリポジトリ名がパスに含まれるため、
  // ビルド時に環境変数で base を切り替える
  base: process.env.GITHUB_PAGES_BASE ?? '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        sasebo: resolve(__dirname, 'sasebo.html'),
        gmap: resolve(__dirname, 'gmap.html'),
      },
    },
  },
})
