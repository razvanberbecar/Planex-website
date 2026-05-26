const fs     = require('fs');
const path   = require('path');
const http   = require('http');
const https  = require('https');
const app    = require('./app');
const { attachWebSocket } = require('./websocket/wsServer');
const { initDatabase }    = require('./database/init');
const { connectMongo }    = require('./database/mongodb');

const HTTP_PORT  = process.env.HTTP_PORT  || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// ── SSL Certificate Paths ───────────────────────────────────
// Use environment variables or default to self-signed certs
const SSL_KEY_PATH  = process.env.SSL_KEY_PATH  || path.join(__dirname, '..', 'ssl', 'server.key');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, '..', 'ssl', 'server.cert');

function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

async function start() {
  // Connect to SQL Server database
  await initDatabase();

  // Connect to MongoDB for chat
  try {
    await connectMongo();
  } catch (err) {
    console.warn('[Server] MongoDB not available — chat will be disabled:', err.message);
  }

  // Create HTTP server from Express app so WebSocket can share the same port
  const httpServer = http.createServer(app);

  // Attach WebSocket server to HTTP (WebSocket doesn't work over HTTPS with self-signed in all browsers)
  attachWebSocket(httpServer);

  const localIP = getLocalIP();

  // ── Start HTTP server (for WebSocket and optional fallback) ──
  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`\n  ┌──────────────────────────────────────────────────────┐`);
    console.log(`  │  🔓 HTTP  (API)     → http://localhost:${HTTP_PORT}/api        │`);
    console.log(`  │  🔓 HTTP  (GraphQL) → http://localhost:${HTTP_PORT}/graphql    │`);
    console.log(`  │  🔓 HTTP  (WS)      → ws://localhost:${HTTP_PORT}              │`);
    console.log(`  │  🔓 HTTP  LAN       → http://${localIP}:${HTTP_PORT}/api       │`);
    console.log(`  └──────────────────────────────────────────────────────┘`);
  });

  // ── Start HTTPS server (for secure API calls) ──────────────
  try {
    if (fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
      const sslOptions = {
        key:  fs.readFileSync(SSL_KEY_PATH, 'utf8'),
        cert: fs.readFileSync(SSL_CERT_PATH, 'utf8'),
      };

      const httpsServer = https.createServer(sslOptions, app);

      httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`  ┌──────────────────────────────────────────────────────┐`);
        console.log(`  │  🔒 HTTPS (API)     → https://localhost:${HTTPS_PORT}/api     │`);
        console.log(`  │  🔒 HTTPS (GraphQL) → https://localhost:${HTTPS_PORT}/graphql │`);
        console.log(`  │  🔒 HTTPS LAN       → https://${localIP}:${HTTPS_PORT}/api    │`);
        console.log(`  └──────────────────────────────────────────────────────┘`);
        console.log(`\n  🌐  Server is running on both HTTP (WS) and HTTPS (API)`);
        console.log(`  📡  Local network IP: ${localIP}\n`);
      });
    } else {
      console.log(`\n  ⚠️  SSL certificates not found at:`);
      console.log(`      Key:  ${SSL_KEY_PATH}`);
      console.log(`      Cert: ${SSL_CERT_PATH}`);
      console.log(`      HTTPS server will NOT start.`);
      console.log(`      Run: npm run ssl:generate  or  node src/scripts/generate-ssl.js\n`);
    }
  } catch (err) {
    console.warn('[Server] Failed to start HTTPS:', err.message);
    console.log('  HTTP server is running. HTTPS is optional for development.\n');
  }
}

start().catch(err => {
  console.error('[Server] Failed to start:', err.message);
  process.exit(1);
});
