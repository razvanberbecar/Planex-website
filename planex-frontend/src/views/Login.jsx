import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FONT = '"Courier New", Courier, monospace'

export default function Login() {
  const navigate = useNavigate()
  const { login, threeWayAuthInit, threeWayAuthVerify, isAuthenticated, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Three-way auth state
  const [showThreeWay, setShowThreeWay] = useState(false)
  const [threeWayEmail, setThreeWayEmail] = useState('')
  const [threeWayPassword, setThreeWayPassword] = useState('')
  const [threeWayCode, setThreeWayCode] = useState('')
  const [threeWayStep, setThreeWayStep] = useState('credentials') // 'credentials' | 'code'
  const [threeWayMaskedEmail, setThreeWayMaskedEmail] = useState('')
  const [threeWayTimer, setThreeWayTimer] = useState(0)

  // Countdown timer for code expiry
  useEffect(() => {
    if (threeWayTimer <= 0) return
    const interval = setInterval(() => {
      setThreeWayTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [threeWayTimer])

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/tasks', { replace: true })
    }
  }, [authLoading, isAuthenticated, navigate])

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result?.user) {
        navigate('/tasks')
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  // ── Three-Way Auth Handlers ─────────────────────────────

  const handleThreeWayInit = async () => {
    if (!threeWayEmail || !threeWayPassword) {
      setError('Please fill in email and password.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await threeWayAuthInit(threeWayEmail, threeWayPassword)
      if (result?.maskedEmail) {
        setThreeWayMaskedEmail(result.maskedEmail)
        setThreeWayStep('code')
        setThreeWayCode('')
        setThreeWayTimer(result.expiresIn || 600)
      } else {
        setError('Failed to send verification code.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleThreeWayVerify = async () => {
    if (!threeWayCode || threeWayCode.length < 6) {
      setError('Please enter the 6-digit verification code.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await threeWayAuthVerify(threeWayEmail, threeWayCode)
      if (result?.user) {
        navigate('/tasks')
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleThreeWayReset = () => {
    setThreeWayStep('credentials')
    setThreeWayCode('')
    setThreeWayMaskedEmail('')
    setThreeWayTimer(0)
    setError('')
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <span style={styles.headerIcon}>📋</span>
          <span style={styles.headerTitle}>Planex</span>
        </div>

        <div style={styles.divider} />

        {/* Body */}
        <div style={styles.body}>
          <p style={styles.subtitle}>Please login below</p>

          {/* ── Local Login ── */}
          <input
            style={styles.input}
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            autoComplete="email"
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoComplete="current-password"
          />

          {error && <p style={styles.error}>{error}</p>}

          <button
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Entering...' : 'Enter Planex'}
          </button>

          {/* ── Links ── */}
          <div style={styles.links}>
            <Link to="/register" style={styles.link}>Don't have an account? Click here</Link>
            <Link to="/forgot-password" style={styles.link}>Forgot password?</Link>
          </div>

          {/* ── Three-Way Auth Section ── */}
          <div style={styles.section}>
            <button
              style={styles.toggleButton}
              onClick={() => { setShowThreeWay(!showThreeWay); handleThreeWayReset() }}
            >
              {showThreeWay ? '−' : '🔐'} 3-Way Authentication (Email Code)
            </button>

            {showThreeWay && (
              <div style={styles.formContainer}>
                {threeWayStep === 'credentials' ? (
                  <>
                    <p style={styles.threeWayHint}>
                      Enter your credentials. A verification code will be sent to your email.
                    </p>

                    <input
                      style={styles.input}
                      type="email"
                      placeholder="Email address"
                      value={threeWayEmail}
                      onChange={e => { setThreeWayEmail(e.target.value); setError('') }}
                      autoComplete="email"
                    />

                    <input
                      style={styles.input}
                      type="password"
                      placeholder="Password"
                      value={threeWayPassword}
                      onChange={e => { setThreeWayPassword(e.target.value); setError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleThreeWayInit()}
                      autoComplete="current-password"
                    />

                    <button
                      style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
                      onClick={handleThreeWayInit}
                      disabled={loading}
                    >
                      {loading ? 'Sending...' : 'Send Verification Code'}
                    </button>
                  </>
                ) : (
                  <>
                    <p style={styles.threeWaySuccess}>
                      ✓ Code sent to <strong>{threeWayMaskedEmail}</strong>
                    </p>

                    <p style={styles.threeWayHint}>
                      Enter the 6-digit verification code from your email.
                    </p>

                    <input
                      style={styles.codeInput}
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      maxLength={6}
                      value={threeWayCode}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                        setThreeWayCode(val)
                        setError('')
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleThreeWayVerify()}
                      autoComplete="one-time-code"
                    />

                    {threeWayTimer > 0 && (
                      <p style={styles.timerText}>
                        Code expires in {formatTime(threeWayTimer)}
                      </p>
                    )}

                    {threeWayTimer === 0 && (
                      <p style={styles.timerExpired}>
                        Code expired. Please request a new one.
                      </p>
                    )}

                    <button
                      style={{
                        ...styles.button,
                        opacity: loading || threeWayTimer === 0 ? 0.7 : 1,
                      }}
                      onClick={handleThreeWayVerify}
                      disabled={loading || threeWayTimer === 0}
                    >
                      {loading ? 'Verifying...' : 'Verify & Login'}
                    </button>

                    <button
                      style={styles.backButton}
                      onClick={handleThreeWayReset}
                      disabled={loading}
                    >
                      ← Use a different email
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

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
    animation: 'fadeSlideIn 0.4s ease',
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
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#111',
    letterSpacing: 2,
  },
  divider: { height: 1, backgroundColor: '#111', margin: '0 0 0 0' },
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
    transition: 'box-shadow 0.2s',
  },
  codeInput: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 30,
    border: '2px solid #2d3445',
    backgroundColor: '#f5f5d8',
    fontFamily: FONT,
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#222',
    outline: 'none',
    boxSizing: 'border-box',
    textAlign: 'center',
    letterSpacing: 12,
    transition: 'box-shadow 0.2s',
  },
  error: {
    fontFamily: FONT,
    fontSize: '0.8rem',
    color: '#7c1d24',
    margin: 0,
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
    transition: 'opacity 0.2s, transform 0.1s',
  },
  links: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  link: {
    fontFamily: FONT,
    fontSize: '0.8rem',
    color: '#111',
    textDecoration: 'none',
    letterSpacing: '0.03em',
  },
  section: {
    width: '100%',
    marginTop: 8,
  },
  toggleButton: {
    width: '100%',
    padding: '10px',
    borderRadius: 30,
    border: '1px solid #111',
    backgroundColor: 'transparent',
    color: '#111',
    fontFamily: FONT,
    fontSize: '0.85rem',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
    width: '100%',
  },
  threeWayHint: {
    fontFamily: FONT,
    fontSize: '0.8rem',
    color: '#333',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.4,
  },
  threeWaySuccess: {
    fontFamily: FONT,
    fontSize: '0.85rem',
    color: '#1d5a2e',
    margin: 0,
    textAlign: 'center',
  },
  timerText: {
    fontFamily: FONT,
    fontSize: '0.8rem',
    color: '#333',
    margin: 0,
    textAlign: 'center',
  },
  timerExpired: {
    fontFamily: FONT,
    fontSize: '0.8rem',
    color: '#7c1d24',
    margin: 0,
    textAlign: 'center',
  },
  backButton: {
    width: '100%',
    padding: '12px',
    borderRadius: 30,
    border: '1px solid #111',
    backgroundColor: 'transparent',
    color: '#111',
    fontFamily: FONT,
    fontSize: '0.85rem',
    cursor: 'pointer',
    letterSpacing: '0.03em',
    transition: 'opacity 0.2s',
  },
}
