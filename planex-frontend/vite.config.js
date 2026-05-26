import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════
//  HTTPS mode — toggle as needed.
//    true  → HTTPS + WSS (secure WebSocket)
//    false → HTTP + WS  (avoids self-signed cert warnings)
//
//  The WebSocket code now auto-detects ws:/wss: based on the page
//  protocol, so switching this flag is all you need.
//
//  Before enabling, regenerate the SSL cert with your device IP:
//    cd planex-backend && node src/scripts/generate-ssl.js YOUR_IP
// ═══════════════════════════════════════════════════════════════
const USE_HTTPS = true

let httpsConfig = undefined
if (USE_HTTPS) {
  const sslKeyPath  = path.resolve(__dirname, '../planex-backend/ssl/server.key')
  const sslCertPath = path.resolve(__dirname, '../planex-backend/ssl/server.cert')
  try {
    if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
      httpsConfig = {
        key:  fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      }
      console.log('[Vite] HTTPS enabled using SSL certificates from ../planex-backend/ssl/')
    } else {
      console.warn('[Vite] SSL certificates not found — run `cd planex-backend && npm run ssl:generate`')
    }
  } catch (err) {
    console.warn('[Vite] Failed to load SSL certs:', err.message)
  }
} else {
  console.log('[Vite] HTTP mode — LAN access works without SSL issues.')
  console.log('[Vite] To enable HTTPS, set USE_HTTPS = true at the top of vite.config.js')
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})