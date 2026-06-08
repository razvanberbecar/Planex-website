import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FONT = '"Courier New", Courier, monospace'

export default function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
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
}
