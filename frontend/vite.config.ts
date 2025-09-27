import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['8209fa1fe93e.ngrok-free.app', 'dfef01c8947a.ngrok-free.app', '803e007ed8bb.ngrok-free.app', '132312d0d040.ngrok-free.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})