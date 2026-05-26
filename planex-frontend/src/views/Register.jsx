import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FONT = '"Courier New", Courier, monospace'

export default function Register() {
  const navigate = useNavigate()
  const { register, isAuthenticated, loading: authLoading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
          <span style={styles.headerIcon}>📋</span>
          <span style={styles.headerTitle}>Planex</span>
        </div>

        <div style={styles.divider} />

        <div style={styles.body}>
          <p style={styles.subtitle}>Please register below</p>

          <input
            style={styles.input}
            type="text"
            placeholder="Enter Name"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            autoComplete="name"
          />

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
            placeholder="Enter password (min 8 characters)"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            autoComplete="new-password"
          />

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
