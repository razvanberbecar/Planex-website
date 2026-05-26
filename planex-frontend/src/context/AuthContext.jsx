// ──────────────────────────────────────────────────────────────
// AuthContext  —  Three-way authentication support
// Handles local (email/password), OAuth, and API key auth.
// Includes session management, inactivity tracking, and
// role-based utilities (isAdmin, isManager, isEditor, etc.)
// ──────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import {
  loginUser, registerUser, fetchUser, logoutUser, checkInactivity,
  oauthLogin, forgotPassword, resetPassword, verifyResetToken,
  generateApiKey, getApiKeyStatus, revokeApiKey,
  getSessions, revokeSession, revokeAllOtherSessions,
  changePassword, updateProfile,
  threeWayInit, threeWayVerify,
} from '../services/api'
import { getCookie, removeCookie } from '../utils/cookies'

export const AuthContext = createContext(null)

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000
const INACTIVITY_CHECK_INTERVAL = 60 * 1000

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const lastActivityRef       = useRef(Date.now())
  const inactivityTimerRef    = useRef(null)

  // ── Auth state utilities ──────────────────────────────────
  const roleName = user?.role?.Name || null
  const isAdmin   = roleName === 'admin'
  const isManager = roleName === 'manager'
  const isEditor  = roleName === 'editor'
  const isViewer  = roleName === 'viewer'
  const isUser    = roleName === 'user'

  const hasRole = useCallback((...roles) => {
    return roles.includes(roleName)
  }, [roleName])

  // ── Listen for forced logout events ─────────────────────
  useEffect(() => {
    const handleForceLogout = () => {
      removeCookie('planex_accessToken')
      removeCookie('planex_refreshToken')
      removeCookie('planex_userId')
      setUser(null)
      setIsAuthenticated(false)
    }

    const handleInactivityLogout = () => {
      handleForceLogout()
    }

    window.addEventListener('auth:logout', handleForceLogout)
    window.addEventListener('auth:inactivity-logout', handleInactivityLogout)

    return () => {
      window.removeEventListener('auth:logout', handleForceLogout)
      window.removeEventListener('auth:inactivity-logout', handleInactivityLogout)
    }
  }, [])

  // ── On mount, check stored token ──────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = getCookie('planex_accessToken')
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const userData = await fetchUser()
        setUser(userData)
        setIsAuthenticated(true)
        lastActivityRef.current = Date.now()
      } catch (err) {
        removeCookie('planex_accessToken')
        removeCookie('planex_refreshToken')
        removeCookie('planex_userId')
        setUser(null)
        setIsAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  // ── Inactivity tracking ───────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
      return
    }

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']

    const handleActivity = () => {
      lastActivityRef.current = Date.now()
    }

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    inactivityTimerRef.current = setInterval(async () => {
      const inactiveDuration = Date.now() - lastActivityRef.current

      if (inactiveDuration > INACTIVITY_TIMEOUT_MS) {
        try {
          await logoutUser()
        } catch { /* ignore */ }
        setUser(null)
        setIsAuthenticated(false)
        return
      }

      try {
        const result = await checkInactivity()
        if (result.inactive) {
          setUser(null)
          setIsAuthenticated(false)
        }
      } catch { /* API service handles token refresh/redirect */ }
    }, INACTIVITY_CHECK_INTERVAL)

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
    }
  }, [isAuthenticated])

  // ── Local Auth ─────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const data = await loginUser(email, password)
    if (data.user) {
      setUser(data.user)
      setIsAuthenticated(true)
      lastActivityRef.current = Date.now()
    }
    return data
  }, [])

  const register = useCallback(async (name, email, password) => {
    const data = await registerUser(name, email, password)
    if (data.user) {
      setUser(data.user)
      setIsAuthenticated(true)
      lastActivityRef.current = Date.now()
    }
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutUser()
    } catch { /* ignore */ }
    setUser(null)
    setIsAuthenticated(false)
  }, [])

  // ── OAuth Auth ─────────────────────────────────────────
  const oauthLoginHandler = useCallback(async (provider, email, name, oauthId) => {
    const data = await oauthLogin(provider, email, name, oauthId)
    if (data.user) {
      setUser(data.user)
      setIsAuthenticated(true)
      lastActivityRef.current = Date.now()
    }
    return data
  }, [])

  // ── Three-Way Auth (Email Verification) ──────────────
  const threeWayAuthInit = useCallback(async (email, password) => {
    return threeWayInit(email, password)
  }, [])

  const threeWayAuthVerify = useCallback(async (email, code) => {
    const data = await threeWayVerify(email, code)
    if (data.user) {
      setUser(data.user)
      setIsAuthenticated(true)
      lastActivityRef.current = Date.now()
    }
    return data
  }, [])

  // ── Password Recovery ──────────────────────────────────
  const forgotPasswordHandler = useCallback(async (email) => {
    return forgotPassword(email)
  }, [])

  const resetPasswordHandler = useCallback(async (token, email, newPassword) => {
    return resetPassword(token, email, newPassword)
  }, [])

  const verifyResetTokenHandler = useCallback(async (token, email) => {
    return verifyResetToken(token, email)
  }, [])

  // ── API Key Management ────────────────────────────────
  const createApiKey = useCallback(async () => {
    return generateApiKey()
  }, [])

  const checkApiKeyStatus = useCallback(async () => {
    return getApiKeyStatus()
  }, [])

  const removeApiKey = useCallback(async () => {
    return revokeApiKey()
  }, [])

  // ── Session Management ────────────────────────────────
  const listSessions = useCallback(async () => {
    return getSessions()
  }, [])

  const removeSession = useCallback(async (sessionId) => {
    return revokeSession(sessionId)
  }, [])

  const removeAllOtherSessions = useCallback(async () => {
    return revokeAllOtherSessions()
  }, [])

  // ── Account Management ────────────────────────────────
  const changeUserPassword = useCallback(async (currentPassword, newPassword) => {
    return changePassword(currentPassword, newPassword)
  }, [])

  const updateUserProfile = useCallback(async (name) => {
    const data = await updateProfile(name)
    if (data.user) {
      setUser(data.user)
    }
    return data
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated,
      roleName,
      isAdmin,
      isManager,
      isEditor,
      isViewer,
      isUser,
      hasRole,

      // Local auth
      login,
      register,
      logout,

      // OAuth auth
      oauthLogin: oauthLoginHandler,

      // Three-Way auth (email verification)
      threeWayAuthInit,
      threeWayAuthVerify,

      // Password recovery
      forgotPassword: forgotPasswordHandler,
      resetPassword: resetPasswordHandler,
      verifyResetToken: verifyResetTokenHandler,

      // API Key management
      createApiKey,
      checkApiKeyStatus,
      removeApiKey,

      // Session management
      listSessions,
      removeSession,
      removeAllOtherSessions,

      // Account management
      changeUserPassword,
      updateUserProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
