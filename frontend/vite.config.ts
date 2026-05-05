import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    devSourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // `npm run dev` 시 기본 브라우저(외부 창)로 자동 오픈 — 에디터 Simple Browser 말고 크롬/엣지 등
    open: true,
    // HMR(WebSocket)이 localhost에서 안정적으로 붙도록
    host: 'localhost',
    strictPort: false,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
    // Upstage AI API CORS 우회 — /api/upstage/* → https://api.upstage.ai/*
    proxy: {
      '/api/upstage': {
        target: 'https://api.upstage.ai',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/upstage/, ''),
        secure: true,
      },
    },
    // .tsx뿐 아니라 .css 변경도 즉시 HMR (Windows/동기화 폴더 대비)
    watch: {
      usePolling: true,
      interval: 100,
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 20,
      },
    },
  },
})
