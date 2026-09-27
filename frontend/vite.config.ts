import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API_TARGET lets a second dev server point at a test backend.
const target = process.env.API_TARGET ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API and image requests to the FastAPI backend (backend/main.py).
    proxy: {
      '/api': target,
      '/media': target,
    },
  },
})
