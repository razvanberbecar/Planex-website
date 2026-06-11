// ──────────────────────────────────────────────────────────────
// API Service  —  All fetch calls to the backend live here.
// Supports three authentication methods:
//   1. JWT (Bearer token) — primary method
//   2. API Key (X-API-Key header)
//   3. OAuth2 (via provider)
// Includes automatic token refresh, password recovery, and
// session management.
// ──────────────────────────────────────────────────────────────

import { getCookie, setCookie, removeCookie } from '../utils/cookies'

// ══════════════════════════════════════════════════════════════
// Base URL Configuration
// ══════════════════════════════════════════════════════════════

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// ── Token Management (cookies) ──────────────────────────────

const ACCESS_TOKEN_COOKIE  = 'planex_accessToken'
const REFRESH_TOKEN_COOKIE = 'planex_refreshToken'

function getAccessToken() {
  return getCookie(ACCESS_TOKEN_COOKIE)
}

function getRefreshToken() {
  return getCookie(REFRESH_TOKEN_COOKIE)
}

function setTokens(accessToken, refreshToken) {
  setCookie(ACCESS_TOKEN_COOKIE, accessToken, 7)
  if (refreshToken) {
    setCookie(REFRESH_TOKEN_COOKIE, refreshToken, 7)
  }
}

function clearTokens() {
  removeCookie(ACCESS_TOKEN_COOKIE)
  removeCookie(REFRESH_TOKEN_COOKIE)
  removeCookie('planex_userId')
}

// ── Token Refresh ───────────────────────────────────────────

let refreshPromise = null

async function attemptTokenRefresh() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    throw new Error('No refresh token available.')
  }

  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!res.ok) {
        clearTokens()
        throw new Error('Refresh token expired.')
      }

      const data = await res.json()
      setTokens(data.accessToken, data.refreshToken)
      return data.accessToken
    } catch (err) {
      clearTokens()
      throw err
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

// ── Core Request Function ──────────────────────────────────

async function request(path, options = {}) {
  const accessToken = getAccessToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    headers,
    ...options,
  })

  // ── Automatic token refresh on 401 ───────────────────────
  if (res.status === 401 && getRefreshToken()) {
    const data = await res.json().catch(() => ({}))

    if (data.code === 'INACTIVITY_TIMEOUT') {
      clearTokens()
      window.dispatchEvent(new CustomEvent('auth:inactivity-logout'))
      throw new Error('Session expired due to inactivity. Please login again.')
    }

    if (data.code === 'ACCOUNT_LOCKED') {
      throw new Error(data.error || 'Account is locked. Please try again later.')
    }

    // TOKEN_EXPIRED or any other 401 — attempt a silent refresh
    try {
      const newToken = await attemptTokenRefresh()
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`
        res = await fetch(`${BASE_URL}${path}`, {
          headers,
          ...options,
        })
      }
    } catch (refreshErr) {
      clearTokens()
      window.dispatchEvent(new CustomEvent('auth:logout'))
      throw new Error('Session expired. Please login again.')
    }
  }

  if (res.status === 204) return null

  const responseData = await res.json()

  if (res.status === 423) {
    throw new Error(responseData.error || 'Account is locked.')
  }

  if (!res.ok) {
    const message = responseData.errors
      ? responseData.errors.map(e => e.msg).join(', ')
      : responseData.error || 'Something went wrong.'
    throw new Error(message)
  }

  return responseData
}

// ══════════════════════════════════════════════════════════════
// 1. LOCAL AUTHENTICATION
// ══════════════════════════════════════════════════════════════

export async function loginUser(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (data.accessToken) {
    setTokens(data.accessToken, data.refreshToken)
  }
  return data
}

export async function registerUser(name, email, password) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
  if (data.accessToken) {
    setTokens(data.accessToken, data.refreshToken)
  }
  return data
}

export async function fetchUser() {
  return request('/auth/me')
}

export async function logoutUser() {
  try {
    await request('/auth/logout', { method: 'POST' })
  } finally {
    clearTokens()
  }
}

export async function checkInactivity() {
  return request('/auth/check-inactivity', { method: 'POST' })
}

// ══════════════════════════════════════════════════════════════
// 2. PASSWORD RECOVERY
// ══════════════════════════════════════════════════════════════

export async function forgotPassword(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token, email, newPassword) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, email, newPassword }),
  })
}

export async function verifyResetToken(token, email) {
  return request(`/auth/verify-reset-token?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`)
}

// ══════════════════════════════════════════════════════════════
// 3. OAUTH2 AUTHENTICATION
// ══════════════════════════════════════════════════════════════

export async function oauthLogin(provider, email, name, oauthId) {
  const data = await request(`/auth/oauth/${provider}`, {
    method: 'POST',
    body: JSON.stringify({ email, name, oauthId }),
  })
  if (data.accessToken) {
    setTokens(data.accessToken, data.refreshToken)
  }
  return data
}

// ══════════════════════════════════════════════════════════════
// 4. THREE-WAY AUTHENTICATION (Email Verification Code)
// ══════════════════════════════════════════════════════════════

/**
 * Step 1: Initiate 3-way authentication.
 * Sends email + password, gets a verification code sent to the email.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{message: string, maskedEmail: string, expiresIn: number}>}
 */
export async function threeWayInit(email, password) {
  return request('/auth/three-way/init', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

/**
 * Step 2: Verify the code received via email.
 * @param {string} email
 * @param {string} code - The 6-digit verification code
 * @returns {Promise<{message: string, user: object, accessToken: string, refreshToken: string}>}
 */
export async function threeWayVerify(email, code) {
  const data = await request('/auth/three-way/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
  if (data.accessToken) {
    setTokens(data.accessToken, data.refreshToken)
  }
  return data
}

export async function getOAuthUrl(provider, redirectUri) {
  const params = redirectUri ? `?redirectUri=${encodeURIComponent(redirectUri)}` : ''
  return request(`/auth/oauth/${provider}/url${params}`)
}

// ══════════════════════════════════════════════════════════════
// 4. API KEY MANAGEMENT
// ══════════════════════════════════════════════════════════════

export async function generateApiKey() {
  return request('/auth/api-key', { method: 'POST' })
}

export async function getApiKeyStatus() {
  return request('/auth/api-key')
}

export async function revokeApiKey() {
  return request('/auth/api-key', { method: 'DELETE' })
}

// ══════════════════════════════════════════════════════════════
// 5. SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════

export async function getSessions() {
  return request('/auth/sessions')
}

export async function revokeSession(sessionId) {
  return request(`/auth/sessions/${sessionId}`, { method: 'DELETE' })
}

export async function revokeAllOtherSessions() {
  return request('/auth/sessions', { method: 'DELETE' })
}

// ══════════════════════════════════════════════════════════════
// 6. ACCOUNT MANAGEMENT
// ══════════════════════════════════════════════════════════════

export async function changePassword(currentPassword, newPassword) {
  return request('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function updateProfile(name) {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

// ══════════════════════════════════════════════════════════════
// 7. TASKS
// ══════════════════════════════════════════════════════════════

// ── AI Chat Filter ────────────────────────────────────────────
export async function filterChatMessages(messages, query) {
  return request('/api/ai/chat-filter', {
    method: 'POST',
    body: JSON.stringify({ messages, query }),
  })
}

export async function fetchTasks(params = {}) {
  const query = new URLSearchParams()
  if (params.page)     query.set('page',     params.page)
  if (params.limit)    query.set('limit',    params.limit)
  if (params.filter && params.filter !== 'all') query.set('filter', params.filter)
  if (params.priority) query.set('priority', params.priority)
  if (params.search)   query.set('search',   params.search)
  if (params.userId)   query.set('userId',   params.userId)
  if (params.userName) query.set('userName', params.userName)
  if (params.isAdmin)  query.set('isAdmin',  params.isAdmin)

  return request(`/tasks?${query.toString()}`)
}

export async function fetchTask(id) {
  return request(`/tasks/${id}`)
}

export async function createTask(data) {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateTask(id, data) {
  return request(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteTask(id) {
  return request(`/tasks/${id}`, { method: 'DELETE' })
}

export async function updateTaskStatus(id, status) {
  return request(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function suggestAiSubtasks(taskId) {
  return request(`/tasks/${taskId}/ai-subtasks`, { method: 'POST' })
}

export async function fetchSubtasks(taskId) {
  return request(`/tasks/${taskId}/subtasks`)
}

export async function createSubtask(taskId, title) {
  return request(`/tasks/${taskId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export async function updateSubtask(taskId, subtaskId, data) {
  return request(`/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteSubtask(taskId, subtaskId) {
  return request(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' })
}

// ══════════════════════════════════════════════════════════════
// 8. STATISTICS
// ══════════════════════════════════════════════════════════════

export async function fetchStatistics(params = {}) {
  const query = new URLSearchParams()
  if (params.userId)   query.set('userId',   params.userId)
  if (params.userName) query.set('userName', params.userName)
  if (params.isAdmin)  query.set('isAdmin',  params.isAdmin)
  const qs = query.toString()
  return request(`/statistics${qs ? `?${qs}` : ''}`)
}

// ══════════════════════════════════════════════════════════════
// 9. USER SEARCH
// ══════════════════════════════════════════════════════════════

export async function searchUsers(query) {
  if (!query || query.length < 1) return []
  return request(`/tasks/users/search?q=${encodeURIComponent(query)}`)
}

// ══════════════════════════════════════════════════════════════
// 10. ADMIN
// ══════════════════════════════════════════════════════════════

export async function fetchAdminUsers() {
  return request('/admin/users')
}

export async function fetchRoles() {
  return request('/admin/roles')
}

export async function updateUserRole(userId, roleId) {
  return request(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ roleId }),
  })
}
