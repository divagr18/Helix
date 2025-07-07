import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'; // Import the 'path' module

import react from '@vitejs/plugin-react-swc';
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Alias for the src directory
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      // You can add more aliases here
      // e.g., '@pages': path.resolve(__dirname, './src/pages'),
    },
  },
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'woodcock-wondrous-infinitely.ngrok-free.app' // 👈 add this
    ],
    watch: {
      usePolling: true,
      interval: 1000, // or 500 for faster dev
    },
    proxy: {
      // Proxy all `/api/...` requests to Django
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      // Proxy the Allauth OAuth endpoints too:
      '/accounts': {
        target: 'http://backend:8000',
        changeOrigin: false,
        secure: false,
        // we leave the path untouched so `/accounts/github/login/` → same on Django
      },
    },
  },
});