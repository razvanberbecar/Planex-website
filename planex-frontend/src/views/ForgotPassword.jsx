import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FONT = '"Courier New", Courier, monospace'

export default function ForgotPassword() {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!email) {
      setError('Please enter your email address.')
      return
    }
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const result = await forgotPassword(email)
      setMessage(result.message || 'If that email exists, a password reset link has been sent.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>Reset Password</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.body}>
          <p style={styles.subtitle}>Enter your email to receive a reset link</p>

          <input
            style={styles.input}
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); setMessage('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />

          {error && <p style={styles.error}>{error}</p>}
          {message && <p style={styles.success}>{message}</p>}

          <button
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <Link to="/" style={styles.link}>Back to Login</Link>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    backgroundColor: '#2d3445',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONT,
    padding: '20px',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: '#8a9e6e',
    borderRadius: 24,
    width: '100%',
    maxWidth: 520,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '28px 40px',
  },
  headerIcon: { fontSize: '1.8rem' },
  headerTitle: {
    fontFamily: FONT,
    fontSize: '1.6rem',
    fontWeight: 'bold',
    color: '#111',
    letterSpacing: 2,
  },
  divider: { height: 1, backgroundColor: '#111' },
  body: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '36px 40px 40px',
    gap: 16,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: '1rem',
    color: '#111',
    margin: '0 0 8px 0',
    letterSpacing: '0.05em',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 30,
    border: 'none',
    backgroundColor: '#f5f5d8',
    fontFamily: FONT,
    fontSize: '0.9rem',
    color: '#222',
    outline: 'none',
    boxSizing: 'border-box',
  },
  error: {
    fontFamily: FONT,
    fontSize: '0.8rem',
    color: '#7c1d24',
    margin: 0,
  },
  success: {
    fontFamily: FONT,
    fontSize: '0.8rem',
    color: '#1d7c24',
    margin: 0,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    padding: '16px',
    borderRadius: 30,
    border: 'none',
    backgroundColor: '#2d3445',
    color: '#ddd',
    fontFamily: FONT,
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    letterSpacing: 2,
    marginTop: 8,
  },
  link: {
    fontFamily: FONT,
    fontSize: '0.8rem',
    color: '#111',
    textDecoration: 'none',
    letterSpacing: '0.03em',
    marginTop: 8,
  },
}
