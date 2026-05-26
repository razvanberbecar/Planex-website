// ──────────────────────────────────────────────────────────────
// InactivityWarning Component
// Displays a visible countdown warning when the user is about to
// be logged out due to inactivity.
// ──────────────────────────────────────────────────────────────

import React from 'react'
import { useInactivityLogout } from '../hooks/useInactivityLogout'

const FONT = '"Courier New", Courier, monospace'

export default function InactivityWarning() {
  const { isWarning, remainingSeconds, resetActivity } = useInactivityLogout()

  if (!isWarning) return null

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const timeStr = minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.icon}>⏰</div>
        <h3 style={styles.title}>Session Expiring Soon</h3>
        <p style={styles.message}>
          Your session will expire in <strong>{timeStr}</strong> due to inactivity.
        </p>
        <p style={styles.submessage}>
          Move your mouse or press a key to stay logged in.
        </p>
        <button style={styles.button} onClick={resetActivity}>
          I'm still here
        </button>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'fadeIn 0.3s ease',
  },
  modal: {
    backgroundColor: '#8a9e6e',
    borderRadius: 24,
    padding: '40px',
    maxWidth: 420,
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    fontFamily: FONT,
  },
  icon: {
    fontSize: '3rem',
    marginBottom: 16,
  },
  title: {
    fontFamily: FONT,
    fontSize: '1.4rem',
    color: '#111',
    margin: '0 0 12px 0',
    letterSpacing: '0.05em',
  },
  message: {
    fontFamily: FONT,
    fontSize: '1rem',
    color: '#222',
    margin: '0 0 8px 0',
    lineHeight: 1.5,
  },
  submessage: {
    fontFamily: FONT,
    fontSize: '0.85rem',
    color: '#444',
    margin: '0 0 24px 0',
  },
  button: {
    padding: '12px 32px',
    borderRadius: 30,
    border: 'none',
    backgroundColor: '#2d3445',
    color: '#ddd',
    fontFamily: FONT,
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    letterSpacing: 1,
    transition: 'opacity 0.2s',
  },
}
