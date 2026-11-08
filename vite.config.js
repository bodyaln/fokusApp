import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // /api/media (ссылки на файлы в R2) работает на Vercel — при локальной разработке ходим туда
    proxy: {
      '/api': { target: 'https://fokus-app-two.vercel.app', changeOrigin: true },
    },
  },
})
