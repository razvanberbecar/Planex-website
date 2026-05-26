import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FONT = '"Courier New", Courier, monospace'

export default function ResetPassword() {
  const { token: pathToken } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { resetPassword, verifyResetToken } = useAuth()

  // Read token from path (/reset-password/TOKEN) or query (/reset-password?token=TOKEN)
  const token = pathToken || searchParams.get('token')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState(true)
  const [checkingToken, setCheckingToken] = useState(true)

  // Verify the token is valid when the component mounts
  useEffect(() => {
    const checkToken = async () => {
      try {
        await verifyResetToken(token, email)
        setTokenValid(true)
      } catch {
        setTokenValid(false)
        setError('This reset link is invalid or has expired.')
      } finally {
        setCheckingToken(false)
      }
    }
    if (token) checkToken()
  }, [token, email, verifyResetToken])

  const handleSubmit = async () => {
    if (!email) {
      setError('Please enter your email address.')
      return
    }
    if (!newPassword) {
      setError('Please enter a new password.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setMessage('')
    setLoading(true)
    try {
      const result = await resetPassword(token, email, newPassword)
      setMessage(result.message || 'Password has been reset successfully!')
      // Redirect to login after 2 seconds
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingToken) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.body}>
            <p style={styles.subtitle}>Verifying reset link...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.header}>
            <span style={styles.headerIcon}>⚠️</span>
            <span style={styles.headerTitle}>Invalid Link</span>
          </div>
          <div style={styles.divider} />
          <div style={styles.body}>
            <p style={styles.subtitle}>
              This password reset link is invalid or has expired.
            </p>
            <Link to="/forgot-password" style={styles.link}>
              Request a new reset link
            </Link>
            <Link to="/" style={styles.link}>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.headerIcon}>🔐</span>
          <span style={styles.headerTitle}>Set New Password</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.body}>
          <p style={styles.subtitle}>Enter your email and new password</p>

          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); setMessage('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />

          <input
            style={styles.input}
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setError(''); setMessage('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setError(''); setMessage('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />

          {error && <p style={styles.error}>{error}</p>}
          {message && <p style={styles.success}>{message}</p>}

          <button
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
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
