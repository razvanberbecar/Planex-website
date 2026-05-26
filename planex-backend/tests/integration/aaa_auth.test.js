// ──────────────────────────────────────────────────────────────
// Integration Tests — Authentication API Endpoints
// Tests register, login, logout, token refresh, /me, and
// edge cases like rate limiting, inactivity, etc.
// ──────────────────────────────────────────────────────────────

// Vitest globals (describe, it, expect, beforeAll) injected via globals:true
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const _require = createRequire(import.meta.url)

// The vitest.setup.js patches the CJS require cache with a mock auth
// middleware that always passes (bypasses JWT/Session checks). That's
// correct for task/subtask integration tests, but auth tests need the
// REAL auth middleware to test authentication properly.
//
// We restore the real module by:
//   1. Deleting the mock from the CJS require cache
//   2. Dynamically importing app.js (which will CJS-require the real auth)

let request, app
let dbAvailable = false

beforeAll(async () => {
  // Remove the mocked auth.js from require cache so require('./middleware/auth')
  // inside app.js loads the REAL auth.js from disk instead of our mock
  const authPath = path.resolve(__dirname, '../../src/middleware/auth.js')
  delete _require.cache[authPath]

  // Dynamically import the real modules after clearing the mock
  const supertestModule = await import('supertest')
  const appModule       = await import('../../src/app.js')
  request = supertestModule.default
  app     = appModule.default

  // Check DB availability
  try {
    const dbModule = await import('../../src/database/models/index.js')
    const sequelize = dbModule.default?.sequelize || dbModule.sequelize
    await sequelize.authenticate()
    dbAvailable = true
    console.log('[Auth-Tests] Connected to PlanexDB')
  } catch (err) {
    console.warn('[Auth-Tests] SQL Server not available:', err.message)
    console.warn('[Auth-Tests] Skipping tests that require database access')
  }
})

// Hook to skip tests when DB is unavailable — runs before each test
beforeEach(function () {
  if (!dbAvailable) {
    this.skip()
  }
})

function dummyCredentials(prefix = 'testuser') {
  const ts = Date.now()
  return {
    name:  `${prefix}_${ts}`,
    email: `${prefix}_${ts}@example.com`,
    password: 'TestPass123!',
  }
}

// ──────────────────────────────────────────────────────────────
// REGISTER
// ──────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('201 — registers a new user and returns tokens', async () => {
    const creds = dummyCredentials()
    const res = await request(app)
      .post('/api/auth/register')
      .send(creds)

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
    expect(res.body).toHaveProperty('user')
    expect(res.body.user).toHaveProperty('UserId')
    expect(res.body.user.Name).toBe(creds.name)
    expect(res.body.user.Email).toBe(creds.email)
    // Password must never be returned
    expect(res.body.user).not.toHaveProperty('Password')
  })

  it('400 — rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alone@test.com' })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('400 — rejects short password (< 8 chars)', async () => {
    const creds = dummyCredentials()
    creds.password = 'Ab1'
    const res = await request(app)
      .post('/api/auth/register')
      .send(creds)

    expect(res.status).toBe(400)
  })

  it('400 — rejects invalid email format', async () => {
    const creds = dummyCredentials()
    creds.email = 'not-an-email'
    const res = await request(app)
      .post('/api/auth/register')
      .send(creds)

    expect(res.status).toBe(400)
  })

  it('400 — rejects empty name', async () => {
    const creds = dummyCredentials()
    creds.name = ''
    const res = await request(app)
      .post('/api/auth/register')
      .send(creds)

    expect(res.status).toBe(400)
  })
})

// ──────────────────────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('200 — logs in with valid credentials and returns tokens', async () => {
    // First register a user
    const creds = dummyCredentials('login-test')
    await request(app).post('/api/auth/register').send(creds)

    // Now login
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
    expect(res.body).toHaveProperty('user')
    expect(res.body.user.Name).toBe(creds.name)
    expect(res.body.user).not.toHaveProperty('Password')
  })

  it('401 — rejects wrong password', async () => {
    const creds = dummyCredentials('wrongpw')
    await request(app).post('/api/auth/register').send(creds)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: 'WrongPassword999!' })

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  it('401 — rejects non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'doesnotexist_' + Date.now() + '@test.com', password: 'SomePass123!' })

    expect(res.status).toBe(401)
  })

  it('400 — rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'SomePass123!' })

    expect(res.status).toBe(400)
  })

  it('400 — rejects missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'anyone@test.com' })

    expect(res.status).toBe(400)
  })
})

// ──────────────────────────────────────────────────────────────
// GET /me  (authenticated)
// ──────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  async function registerAndLogin() {
    const creds = dummyCredentials('me-test')
    const regRes = await request(app).post('/api/auth/register').send(creds)
    return { creds, accessToken: regRes.body.accessToken }
  }

  it('200 — returns the current user profile', async () => {
    const { accessToken } = await registerAndLogin()

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('UserId')
    expect(res.body).toHaveProperty('Name')
    expect(res.body).toHaveProperty('Email')
    expect(res.body).toHaveProperty('RoleId')
    expect(res.body).not.toHaveProperty('Password')
  })

  it('401 — rejects request without token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('401 — rejects expired/invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken123')
    expect(res.status).toBe(401)
  })
})

// ──────────────────────────────────────────────────────────────
// LOGOUT
// ──────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('200 — logs out successfully and revokes token', async () => {
    const creds = dummyCredentials('logout-test')
    const regRes = await request(app).post('/api/auth/register').send(creds)
    const token = regRes.body.accessToken

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')

    // The same token should now be rejected
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(meRes.status).toBe(401)
  })

  it('401 — rejects logout without token', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(401)
  })
})

// ──────────────────────────────────────────────────────────────
// TOKEN REFRESH
// ──────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('200 — issues new tokens from valid refresh token', async () => {
    const creds = dummyCredentials('refresh-test')
    const regRes = await request(app).post('/api/auth/register').send(creds)
    const refreshToken = regRes.body.refreshToken

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
    // New tokens should differ from old ones
    expect(res.body.accessToken).not.toBe(regRes.body.accessToken)
  })

  it('401 — rejects invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid_refresh_token' })

    expect(res.status).toBe(401)
  })

  it('400 — rejects missing refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({})

    expect(res.status).toBe(400)
  })
})

// ──────────────────────────────────────────────────────────────
// PASSWORD HASHING VERIFICATION
// ──────────────────────────────────────────────────────────────

describe('Password security', () => {
  it('passwords are stored hashed (not plaintext)', async () => {
    const creds = dummyCredentials('hash-test')
    const regRes = await request(app).post('/api/auth/register').send(creds)

    // Fetch user directly from the model to check stored password
    const { default: db } = await import('../../src/database/models/index.js')
    const user = await db.User.findByPk(regRes.body.user.UserId)

    expect(user).toBeTruthy()
    // The password in DB should NOT equal the plaintext password
    expect(user.Password).not.toBe(creds.password)
    // It should look like a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    expect(user.Password).toMatch(/^\$2[aby]\$\d{2}\$/)
  })
})
