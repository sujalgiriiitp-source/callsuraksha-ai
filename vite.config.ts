import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Dev only: /api calls go to the local Express server (server/index.js,
    // default port 3001). Production deployment is out of scope for Phase 4.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
