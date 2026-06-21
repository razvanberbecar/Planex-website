import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FONT = '"Courier New", Courier, monospace'

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

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
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
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
          <span style={styles.headerTitle}>Set New Password</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.body}>
          <p style={styles.subtitle}>Enter your email and new password</p>

          <div style={styles.fieldGroup}>
            <label htmlFor="reset-email" style={styles.label}>Email Address</label>
            <input
              id="reset-email"
              style={styles.input}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); setMessage('') }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="reset-new-pw" style={styles.label}>New Password</label>
            <div style={styles.passwordWrapper}>
              <input
                id="reset-new-pw"
                style={{ ...styles.input, paddingRight: 48 }}
                type={showNew ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError(''); setMessage('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button type="button" aria-label={showNew ? 'Hide password' : 'Show password'} onClick={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                <EyeIcon open={showNew} />
              </button>
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="reset-confirm-pw" style={styles.label}>Confirm Password</label>
            <div style={styles.passwordWrapper}>
              <input
                id="reset-confirm-pw"
                style={{ ...styles.input, paddingRight: 48 }}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(''); setMessage('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button type="button" aria-label={showConfirm ? 'Hide password' : 'Show password'} onClick={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>

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
  fieldGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontFamily: FONT,
    fontSize: '0.72rem',
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginLeft: 14,
  },
  passwordWrapper: {
    position: 'relative',
    width: '100%',
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    padding: 4,
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
