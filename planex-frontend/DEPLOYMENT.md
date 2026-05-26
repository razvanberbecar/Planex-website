# Planex — Cross-Machine LAN Deployment Guide

This guide explains how to run the Planex application with the client and
server on **different machines** on the same local network (LAN).

---

## Architecture Overview

```
┌─────────────────────┐        ┌──────────────────────┐
│   Machine A         │        │   Machine B           │
│   (Server)          │        │   (Client)            │
│                     │        │                       │
│   Express HTTPS ────┼────────┼──► React (Vite)       │
│   Port 3443         │  LAN   │   Port 5173           │
│                     │        │                       │
│   WebSocket HTTP    │        │   Browser accesses    │
│   Port 3001         │        │   https://A_IP:5173   │
└─────────────────────┘        └──────────────────────┘
```

- **Server machine (A)**: Runs the Express backend (HTTPS on 3443, WS on 3001)
- **Client machine (B)**: Runs the React dev server (Vite on 5173)
- Both machines must be on the **same LAN** (same subnet)
- The client's browser accesses `https://A_IP:5173`

---

## Prerequisites

- Node.js 18+ on both machines
- npm on both machines
- Git (optional, for cloning)
- MSSQL server accessible from the **server machine** (Machine A)

---

## Step 1: Prepare the Server Machine (Machine A)

### 1.1 Copy the project

```bash
git clone <repo-url> planex
cd planex/planex-backend
npm install
```

### 1.2 Configure the database

Edit `src/database/config.js` to point to your MSSQL instance:

```js
development: {
  username: "your_db_user",
  password: "your_db_password",
  database: "planex_db",
  host: "localhost",
  dialect: "mssql",
  // ...
}
```

### 1.3 Install backend dependencies

```bash
npm install
```

### 1.4 Generate SSL certificates

```bash
npm run ssl:generate
```

This creates `ssl/server.key` and `ssl/server.cert` in the `planex-backend/`
directory. These are **self-signed certificates** — the browser will show a
warning, which is expected in a development/LAN setup.

### 1.5 Run database migrations and seed

```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

### 1.6 Start the backend server

```bash
npm start
```

The server will output something like:

```
✅ Database connected
🌐 HTTP  server on http://0.0.0.0:3001
🔒 HTTPS server on https://0.0.0.0:3443
🌍 Local network: https://192.168.1.100:3443
```

Note the **local IP address** (e.g., `192.168.1.100`). You'll need this for
the client machine.

---

## Step 2: Prepare the Client Machine (Machine B)

### 2.1 Copy the project (or just the frontend)

```bash
git clone <repo-url> planex
cd planex/planex-frontend
npm install
```

### 2.2 Configure the API URL

The frontend builds its `BASE_URL` dynamically using `window.location.hostname`,
so if you access the Vite dev server via `https://A_IP:5173`, the frontend will
correctly point to `https://A_IP:3443/api`.

No hardcoded IP changes are needed.

### 2.3 Install frontend dependencies

```bash
npm install
```

### 2.4 Copy SSL certificates (client machine)

The Vite dev server can also use HTTPS. Copy the certificates from the server
machine:

```bash
# On Machine B, after copying the project:
# Make sure the SSL certs exist at:
# ../planex-backend/ssl/server.key
# ../planex-backend/ssl/server.cert
```

If they are missing, the Vite dev server will still start but without HTTPS.
You can still access it via `http://A_IP:5173`, but the API calls must go
over HTTPS (port 3443), which may cause mixed-content issues.

### 2.5 Start the frontend dev server

```bash
npm run dev
```

The Vite server will start on `https://0.0.0.0:5173`.

---

## Step 3: Access the Application

On **Machine B's browser**, navigate to:

```
https://A_IP:5173
```

Replace `A_IP` with the actual IP address of Machine A (e.g., `https://192.168.1.100:5173`).

**Important**: Since the SSL certificates are self-signed, browsers will show a
warning like "Your connection is not private". Click **Advanced** → **Proceed
to [IP] (unsafe)** to continue.

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Eavesdropping | ✅ HTTPS encrypts all API traffic |
| Credential sniffing | ✅ Passwords hashed with bcrypt (12 rounds) |
| Session hijacking | ✅ JWT tokens with 15min expiry + refresh tokens (7d) |
| Brute force attacks | ✅ Rate limiting (20 login attempts / 15 min) |
| Registration abuse | ✅ Rate limiting (5 registrations / hour per IP) |
| Inactivity hijacking | ✅ Auto-logout after 30 minutes of inactivity |
| Token replay | ✅ Token revocation on logout (server-side blacklist) |
| Self-signed cert warning | ⚠️ Accept in browser for dev; use Let's Encrypt for production |

---

## Production Deployment Notes

For a production setup:

1. **Use proper SSL certificates** from Let's Encrypt or a CA instead of
   self-signed certificates.
2. **Set up a reverse proxy** (nginx, Caddy) in front of the Express server.
3. **Use a production-grade database** — the MSSQL setup is already configured.
4. **Build the frontend** (`npm run build`) and serve it via the reverse proxy,
   eliminating the need for a separate Vite dev server.

---

## Troubleshooting

### "Cannot connect to the server"

- Ensure both machines are on the same network
- Check firewall settings on Machine A (allow ports 3443, 3001, 5173)
- Verify the server is running: `curl -k https://localhost:3443/api/health`

### "CORS errors"

- The backend is configured with `cors({ origin: true, credentials: true })`
  which allows any origin. This is fine for LAN dev but should be restricted
  in production.

### "WebSocket connection failed"

- WebSocket runs on HTTP (port 3001), not HTTPS. Ensure port 3001 is
  accessible on Machine A.
- The WebSocket URL is dynamically set to `ws://A_IP:3001` in the browser.

### "Mixed content warnings"

- The API uses HTTPS (3443) and the dev server uses HTTP or HTTPS (5173).
  If you see mixed content warnings, ensure both are using HTTPS, or access
  the dev server via HTTPS.

### "Rate limit errors"

- If you get "Too many requests", wait 15 minutes before trying again, or
  restart the server to clear the in-memory rate limiter.

---

## Environment Variables

Backend (`planex-backend/`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port (WebSocket) |
| `HTTPS_PORT` | `3443` | HTTPS port (API) |
| `JWT_SECRET` | (autogenerated) | Secret for signing JWT tokens |
| `JWT_REFRESH_SECRET` | (autogenerated) | Secret for signing refresh tokens |
| `SSL_KEY_PATH` | `./ssl/server.key` | Path to SSL private key |
| `SSL_CERT_PATH` | `./ssl/server.cert` | Path to SSL certificate |
| `DB_HOST` | (from config.js) | MSSQL host |
| `DB_PORT` | `1433` | MSSQL port |

Frontend (`planex-frontend/`):

The frontend automatically detects the server IP from `window.location.hostname`
and uses port 3443 for HTTPS API calls. No environment variables are needed.
