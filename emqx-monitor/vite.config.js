import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/v5': {
        target: 'http://localhost:18083',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    }
  }
})

