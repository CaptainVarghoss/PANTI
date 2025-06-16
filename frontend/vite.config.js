import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // Configure the proxy for API requests
    proxy: {
      '/api': { // Any request starting with /api
        target: 'http://localhost:8000', // Forward it to your FastAPI backend
        changeOrigin: true, // Needed for virtual hosted sites
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Rewrite path (optional, but good for clarity)
      },
      // You might also need to proxy /static_assets if your images are served via FastAPI's static mount
      '/static_assets': { // Any request starting with /static_assets
        target: 'http://localhost:8000', // Forward it to your FastAPI backend
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/static_assets/, '/static_assets'),
      },
    },
    // Optional: Specify the port for the React dev server if you want it to be explicitly 5173
    // port: 5173,
  },
})
