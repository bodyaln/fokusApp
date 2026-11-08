import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // запросы к API и файлам музыки уходят на наш сервер (npm run server)
    proxy: {
      '/api': 'http://localhost:8787',
      '/media': 'http://localhost:8787',
    },
  },
})
