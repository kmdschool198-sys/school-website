import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Triggering new deployment to ensure latest code is used.
export default defineConfig({
  plugins: [react()],
})
