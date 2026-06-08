const express       = require('express')
const cors          = require('cors')
const { createHandler } = require('graphql-http/lib/use/express')
const schema        = require('./graphql/schema')
const root          = require('./graphql/resolvers')
const taskRoutes    = require('./routes/taskRoutes')
const statsRoutes   = require('./routes/statistics')
const subtaskRoutes = require('./routes/subtasks')
const authRoutes    = require('./routes/auth')
const adminRoutes   = require('./routes/admin')
const { authenticate, updateLastActivity } = require('./middleware/auth')

const app = express()

// ── Trust Render's proxy (required for express-rate-limit behind reverse proxy) ──
app.set('trust proxy', 1);

// ── CORS (allow frontend from any origin in dev) ────────────
app.use(cors({
  origin: true,
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

// ── AUTH ENDPOINTS (public: register/login/forgot/reset/oauth, protected: logout/me/refresh/sessions/api-key) ──
app.use('/api/auth', authRoutes)

// ── PROTECTED REST ENDPOINTS ─────────────────────────────────
// taskRoutes and subtaskRoutes have their own auth.internalMiddleware now
app.use('/api/tasks/:taskId/subtasks', authenticate, updateLastActivity, subtaskRoutes)
app.use('/api/tasks',                 taskRoutes)
app.use('/api/statistics',            statsRoutes)

// ── ADMIN ENDPOINTS (auth + admin role checked inside admin routes) ──
app.use('/api/admin', adminRoutes)

// ── GRAPHQL (requires authentication) ────────────────────────
app.use('/graphql', authenticate, updateLastActivity, createHandler({ schema, rootValue: root }))

// ── HEALTH CHECK (public) ────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Planex API is running.' })
})

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` })
})

module.exports = app
