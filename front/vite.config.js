import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Разрешить доступ из локальной сети
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://192.168.2.116:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://192.168.2.116:8000',
        ws: true,
      }
    }
  }
})
