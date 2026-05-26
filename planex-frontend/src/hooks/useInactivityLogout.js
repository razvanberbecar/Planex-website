// ──────────────────────────────────────────────────────────────
// useInactivityLogout Hook
// Tracks user activity and logs out after a period of inactivity.
// This hook provides a component-level inactivity warning.
// The core inactivity handling is in AuthContext — this hook
// adds a visible countdown/notification for the user.
// ──────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { checkInactivity } from '../services/api'

const WARNING_BEFORE_MS   = 60 * 1000        // Show warning 1 minute before timeout
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const CHECK_INTERVAL_MS   = 10 * 1000         // Check every 10 seconds

/**
 * Hook that tracks inactivity and exposes warning state.
 * 
 * @returns {object} { isWarning, remainingSeconds, resetActivity }
 */
export function useInactivityLogout() {
  const { isAuthenticated, logout } = useAuth()
  const [isWarning, setIsWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const lastActivityRef = useRef(Date.now())
  const intervalRef = useRef(null)

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    setIsWarning(false)
    setRemainingSeconds(0)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setIsWarning(false)
      setRemainingSeconds(0)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    const handleActivity = () => {
      lastActivityRef.current = Date.now()
      if (isWarning) {
        setIsWarning(false)
        setRemainingSeconds(0)
      }
    }

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Periodic check
    intervalRef.current = setInterval(async () => {
      const elapsed = Date.now() - lastActivityRef.current
      const remaining = INACTIVITY_TIMEOUT_MS - elapsed

      if (remaining <= 0) {
        // Timeout reached — logout
        setIsWarning(false)
        setRemainingSeconds(0)
        await logout()
        return
      }

      // Show warning when less than WARNING_BEFORE_MS remaining
      if (remaining <= WARNING_BEFORE_MS) {
        setIsWarning(true)
        setRemainingSeconds(Math.ceil(remaining / 1000))
      } else {
        setIsWarning(false)
        setRemainingSeconds(0)
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isAuthenticated, logout, isWarning])

  return { isWarning, remainingSeconds, resetActivity }
}
