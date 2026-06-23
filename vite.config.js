import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT ?? '5173'),
    proxy: {
      '/omie-api': {
        target: 'https://app.omie.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/omie-api/, '/api/v1'),
        secure: true,
      },
    },
  },
})
