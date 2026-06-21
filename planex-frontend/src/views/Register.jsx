import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FONT = '"Courier New", Courier, monospace'

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const { register, isAuthenticated, loading: authLoading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect if already authenticated (e.g., restored session from localStorage)
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/tasks', { replace: true })
    }
  }, [authLoading, isAuthenticated, navigate])

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Please fill in all fields.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (name.length < 2 || name.length > 100) {
      setError('Name must be between 2 and 100 characters.')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await register(name, email, password)
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

        <div style={styles.header}>
          <span style={styles.headerTitle}>Planex</span>
        </div>

        <div style={styles.divider} />

        <div style={styles.body}>
          <p style={styles.subtitle}>Please register below</p>

          <div style={styles.fieldGroup}>
            <label htmlFor="reg-name" style={styles.label}>Full Name</label>
            <input
              id="reg-name"
              style={styles.input}
              type="text"
              placeholder="Enter Name"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              autoComplete="name"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="reg-email" style={styles.label}>Email Address</label>
            <input
              id="reg-email"
              style={styles.input}
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              autoComplete="email"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="reg-password" style={styles.label}>Password</label>
            <div style={styles.passwordWrapper}>
              <input
                id="reg-password"
                style={{ ...styles.input, paddingRight: 48 }}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 6 characters"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(v => !v)}
                style={styles.eyeBtn}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Enter Planex'}
          </button>

          <Link to="/" style={styles.link}>
            Already have an account? Login here
          </Link>
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
  header: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '28px 40px' },
  headerIcon: { fontSize: '1.8rem' },
  headerTitle: {
    fontFamily: FONT, fontSize: '2rem', fontWeight: 'bold', color: '#111', letterSpacing: 2,
  },
  divider: { height: 1, backgroundColor: '#111' },
  body: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '36px 40px 40px', gap: 16,
  },
  subtitle: {
    fontFamily: FONT, fontSize: '1rem', color: '#111',
    margin: '0 0 8px 0', letterSpacing: '0.05em',
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
    width: '100%', padding: '14px 20px', borderRadius: 30, border: 'none',
    backgroundColor: '#f5f5d8', fontFamily: FONT, fontSize: '0.9rem',
    color: '#222', outline: 'none', boxSizing: 'border-box',
  },
  error: { fontFamily: FONT, fontSize: '0.8rem', color: '#7c1d24', margin: 0 },
  button: {
    width: '100%', padding: '16px', borderRadius: 30, border: 'none',
    backgroundColor: '#2d3445', color: '#ddd', fontFamily: FONT,
    fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
    letterSpacing: 2, marginTop: 8, transition: 'opacity 0.2s',
  },
  link: { fontFamily: FONT, fontSize: '0.8rem', color: '#111', marginTop: 8, textDecoration: 'none' },
}
