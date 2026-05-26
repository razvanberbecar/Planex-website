# Planex — Cloud Deployment Guide

This guide covers deploying the Planex application to **free cloud hosting providers**.

> **⚠️ Database Migration:** The app has been migrated from **Microsoft SQL Server → PostgreSQL**.  
> You must have a PostgreSQL database available. All free providers listed below include PostgreSQL.

---

## Architecture Overview (Cloud)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Browser     │────▶│  Vercel /    │     │  Render /    │
│  (Anywhere)  │     │  Netlify     │     │  Railway     │
│              │     │  (Frontend)  │     │  (Backend)   │
│              │     │  Port 443    │     │  Port 3001   │
└─────────────┘     └──────┬───────┘     └──────┬───────┘
                           │ HTTPS               │
                           │ /api/*, /ws,        │
                           │ /graphql            │
                           └─────────────────────┘
                                        │
                               ┌────────┴────────┐
                               │  PostgreSQL      │
                               │  (Render DB /    │
                               │   Neon / Supabase)│
                               └─────────────────┘
                               ┌─────────────────┐
                               │  MongoDB Atlas   │
                               │  (Chat, optional)│
                               └─────────────────┘
```

---

## Option 1: Render.com (Recommended — Fully Free) ✅

| Service   | Free Tier                        |
|-----------|----------------------------------|
| Backend   | Web Service (sleeps after 15 min inactivity, wakes on request) |
| Frontend  | Static Site (always on)          |
| Database  | PostgreSQL (1 GB, always on)     |

### Step 1: Push to GitHub

```bash
# Create a repo on GitHub, then:
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/planex.git
git push -u origin main
```

### Step 2: Create PostgreSQL Database on Render

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New +** → **PostgreSQL**
2. Fill in:
   - **Name**: `planex-db`
   - **Database**: `planex_prod`
   - **User**: `planex_user`
3. Click **Create Database**
4. After creation, copy the **Internal Database URL** (looks like `postgres://planex_user:...@planex-db.internal:5432/planex_prod`)

### Step 3: Deploy Backend on Render

1. **New +** → **Web Service**
2. Connect your GitHub repo
3. Fill in:
   - **Name**: `planex-api`
   - **Root Directory**: `planex-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free**
4. Add Environment Variables:

| Variable         | Value                                                  |
|------------------|--------------------------------------------------------|
| `DATABASE_URL`   | *(paste the Internal Database URL from Step 2)*        |
| `NODE_ENV`       | `production`                                           |
| `JWT_SECRET`     | *(run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)* |
| `JWT_REFRESH_SECRET` | *(same command, generate a different key)*         |
| `MONGO_URI`      | *(optional — MongoDB Atlas connection string)*         |
| `HF_API_TOKEN`   | *(from your .env file)*                                |

5. Click **Create Web Service**

6. After deployment, run migrations in the **Shell** tab:
```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

7. Note your backend URL: `https://planex-api.onrender.com`

### Step 4: Deploy Frontend on Render

1. **New +** → **Static Site**
2. Connect your GitHub repo
3. Fill in:
   - **Name**: `planex-client`
   - **Root Directory**: `planex-frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add Environment Variable:

| Variable         | Value                                      |
|------------------|--------------------------------------------|
| `VITE_API_URL`   | `https://planex-api.onrender.com/api`      |

5. Click **Create Static Site**

6. Your app is live at `https://planex-client.onrender.com` 🎉

### ⚠️ Render Free Tier Limitations

- Backend **sleeps after 15 minutes** of inactivity (takes ~30s to wake up)
- 512 MB RAM, 0.1 CPU
- 100 GB outbound bandwidth/month
- PostgreSQL is **always on** and does NOT sleep

---

## Option 2: Railway.app (Free Credits)

| Service   | Free Tier                        |
|-----------|----------------------------------|
| Backend   | $5 free credit (no expiry)       |
| Database  | PostgreSQL (1 GB)                |

### Step 1: Deploy

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. Add a **PostgreSQL** plugin
5. Add a **MongoDB** plugin (optional)

### Step 2: Configure Backend

1. Click on your backend service → **Variables**
2. Add the same environment variables as Render (Step 3.4)
3. Railway auto-injects `DATABASE_URL` for PostgreSQL
4. **Start Command**: `cd planex-backend && npm start`

### Step 3: Run Migrations

In Railway dashboard, open a **Shell** and run:
```bash
cd planex-backend && npx sequelize-cli db:migrate && npx sequelize-cli db:seed:all
```

### Step 4: Deploy Frontend

1. **New Project** → **Deploy from GitHub** (select same repo)
2. In **Variables** → `VITE_API_URL` = your backend URL
3. **Root Directory**: `planex-frontend`
4. **Build Command**: `npm install && npm run build`
5. **Start Command**: `npm run preview`
6. Railway will give you a `.railway.app` URL

### ⚠️ Railway Limitations

- $5 free credit — costs ~$0.02/hr for a running service
- Backend sleeps after a period of inactivity
- Good for development/demo, but costs mount if always on

---

## Option 3: Fly.io (3 Free VMs)

| Service   | Free Tier                        |
|-----------|----------------------------------|
| Backend   | 3 shared VMs (256 MB each)       |
| Database  | PostgreSQL (1 GB, 1 connection)  |

### Step 1: Install Fly CLI & Login

```bash
# Install flyctl (on Windows via PowerShell):
iwr https://fly.io/install.ps1 -useb | iex

fly auth login
```

### Step 2: Launch Backend

```bash
# In planex-backend directory:
fly launch --name planex-api --region fra
# Follow prompts, select "Yes" to tweak settings

# Create PostgreSQL database:
fly postgres create --name planex-db
fly postgres attach planex-db

# Set environment variables:
fly secrets set JWT_SECRET=<your-secret>
fly secrets set JWT_REFRESH_SECRET=<your-refresh-secret>
fly secrets set NODE_ENV=production

# For MongoDB (optional):
fly secrets set MONGO_URI=<your-mongo-uri>

# Deploy:
fly deploy

# Run migrations:
fly ssh console -C "cd /app && npx sequelize-cli db:migrate"
fly ssh console -C "cd /app && npx sequelize-cli db:seed:all"
```

### Step 3: Deploy Frontend

```bash
# In planex-frontend directory:
fly launch --name planex-client --region fra

# Set API URL:
fly secrets set VITE_API_URL=https://planex-api.fly.dev/api

# Deploy:
fly deploy
```

### ⚠️ Fly.io Limitations

- Max 3 free VMs across all your apps
- 256 MB RAM per VM
- PostgreSQL limited to 1 GB with max 1 connection
- Requires CLI setup (but very reliable)

---

## Option 4: Vercel (Frontend) + Backend on Render

If you prefer Vercel for the frontend:

### Frontend on Vercel

1. Install Vercel CLI or use the GitHub integration
2. Import `planex-frontend/` as a project
3. Set `VITE_API_URL` to your Render backend URL
4. Deploy — Vercel auto-detects Vite

### ⚠️ Vercel Note

- Vercel serves static files only
- WebSocket proxy won't work (the Vite dev server proxy is for development)
- For WebSocket, the frontend must connect to the backend URL directly (which it already does via dynamic `window.location.hostname` resolution)

---

## Environment Variables Reference

### Backend (`planex-backend/`)

| Variable             | Required | Description                                          |
|----------------------|----------|------------------------------------------------------|
| `DATABASE_URL`       | ✅       | Full PostgreSQL connection string (Render/Railway auto-inject this) |
| `DB_HOST`            | ⬜       | PostgreSQL host (if not using DATABASE_URL)           |
| `DB_PORT`            | ⬜       | PostgreSQL port (default: 5432)                       |
| `DB_USERNAME`        | ⬜       | PostgreSQL username                                   |
| `DB_PASSWORD`        | ⬜       | PostgreSQL password                                   |
| `DB_DATABASE`        | ⬜       | PostgreSQL database name                              |
| `DB_SSL`             | ⬜       | Set to `true` for cloud databases (enabled by default in production) |
| `NODE_ENV`           | ✅       | Set to `production`                                   |
| `JWT_SECRET`         | ✅       | Secret for signing JWT tokens (generate with `crypto.randomBytes(32).toString('hex')`) |
| `JWT_REFRESH_SECRET` | ✅       | Secret for signing refresh tokens (different from JWT_SECRET) |
| `MONGO_URI`          | ⬜       | MongoDB connection string (chat feature, optional)     |
| `HF_API_TOKEN`       | ⬜       | Hugging Face Inference API token (LLM detection)       |
| `ENABLE_LLM_DETECTION` | ⬜     | Set to `true` to enable LLM-based detection            |
| `HTTP_PORT`          | ⬜       | HTTP port (default: 3001) — Render sets `PORT`        |

### Frontend (`planex-frontend/`)

| Variable       | Required | Description                                      |
|----------------|----------|--------------------------------------------------|
| `VITE_API_URL` | ✅ | Full URL to backend API (e.g., `https://planex-api.onrender.com/api`) |

---

## MongoDB for Chat (Optional)

The chat feature requires MongoDB. Free option:

**[MongoDB Atlas](https://www.mongodb.com/atlas)** — 512 MB free

1. Create a free cluster
2. Get connection string like: `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/planex_chat`
3. Set as `MONGO_URI` environment variable on your backend

If MongoDB is unavailable, the server starts without chat (warns with `[Server] MongoDB not available — chat will be disabled`).

---

## Post-Deployment Checklist

- [ ] Backend health check: `https://your-backend-url/api/health` → `{ "status": "ok" }`
- [ ] Frontend loads without errors
- [ ] Login works (try `admin@planex.com` / `admin123`)
- [ ] Tasks load and CRUD works
- [ ] WebSocket connects (real-time updates)
- [ ] Statistics page loads

---

## Troubleshooting

### "relation does not exist"
Run migrations: `npx sequelize-cli db:migrate`

### "ECONNREFUSED" on database
- Check that `DATABASE_URL` is correct
- On Render, use **Internal Database URL** (not external)
- Ensure database allows connections from the web service

### "Cannot find module 'pg'"
Run `npm install` — the package.json now includes `pg` and `pg-hstore`.

### WebSocket not connecting
- The frontend connects to the backend host on port 3001 (HTTP)
- On cloud providers, WebSocket typically works on the same port as the API
- Check that the hosting provider supports WebSocket
  - Render: ✅ Supported
  - Railway: ✅ Supported
  - Fly.io: ✅ Supported

### Rate limiting issues
- Rate limits reset on server restart
- For Render free tier, the server sleeps and restarts, which clears the in-memory rate limiter

---

## Comparison Matrix

| Feature               | Render.com            | Railway.app          | Fly.io                |
|-----------------------|-----------------------|----------------------|-----------------------|
| Backend free tier     | ✅ Web Service (sleeps)| $5 credit            | ✅ 3 VMs (256 MB)     |
| Frontend free         | ✅ Static Site        | $5 credit (shared)   | ✅ Uses 1 of 3 VMs    |
| PostgreSQL free       | ✅ 1 GB, always on    | ✅ 1 GB              | ✅ 1 GB, 1 connection |
| MongoDB free          | ❌ (use Atlas)        | ✅ Plugin             | ❌ (use Atlas)        |
| WebSocket support     | ✅                    | ✅                   | ✅                    |
| Sleep on inactivity   | ✅ (15 min)           | ✅                   | ❌ (always on)        |
| Custom domain (free)  | ✅                    | ❌ (paid)            | ✅                    |
| Ease of setup         | ⭐⭐⭐⭐⭐              | ⭐⭐⭐⭐              | ⭐⭐⭐                 |

**Recommendation:** Start with **Render.com** — it has the most generous free tier with separate free PostgreSQL, free static frontend hosting, and the easiest setup.
