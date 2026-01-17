import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react({
    // Configurar Fast Refresh correctamente
    fastRefresh: true,
    // Ignorar archivos que no deben ser parseados por React
    exclude: ['**/*.test.jsx', '**/*.spec.jsx']
  })],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true
      }
    },
    // Optimizar HMR
    hmr: {
      // host: 'localhost', // Commented out to allow external access
      // port: 5173,
      // protocol: 'ws'
    }
  }
})
