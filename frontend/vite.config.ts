import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['3e50dd2d6e3f.ngrok-free.app', 'f009f1c84696.ngrok-free.app', '2a414ac96803.ngrok-free.app', 'f36735fe96e6.ngrok-free.app', '3df2c5a5d8eb.ngrok-free.app', '5377f5d18eba.ngrok-free.app', '4ffee68268c6.ngrok-free.app', '0f1589edfd1e.ngrok-free.app', '5f8099455dbb.ngrok-free.app', 'f19e45b6279c.ngrok-free.app', '8209fa1fe93e.ngrok-free.app', 'dfef01c8947a.ngrok-free.app', '803e007ed8bb.ngrok-free.app', '132312d0d040.ngrok-free.app', '3a0055fcdca0.ngrok-free.app', '4379fa3dd651.ngrok-free.app'],
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