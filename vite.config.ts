import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    host: true, // Listen on all local IP addresses
  },
  optimizeDeps: {
    // public/ 폴더 내 게임들이 CDN importmap을 통해 three를 로드하므로
    // Vite의 pre-bundling 대상에서 제외
    exclude: ['three'],
  },
})

