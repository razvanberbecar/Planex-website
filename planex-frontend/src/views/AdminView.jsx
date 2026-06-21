import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  fetchAdminUsers, fetchRoles, updateUserRole,
  fetchFlaggedUsers, clearUserFlags,
} from '../services/api'

const FONT = '"Courier New", Courier, monospace'

const ROLE_COLORS = {
  admin:   { bg: '#f8d7da', color: '#7c1d24', border: '#f5c2c7' },
  manager: { bg: '#fce4d6', color: '#8a4b0a', border: '#f5cba0' },
  editor:  { bg: '#fff3cd', color: '#664d03', border: '#ffecb5' },
  viewer:  { bg: '#d1e7dd', color: '#0a3622', border: '#badbcc' },
  user:    { bg: '#e2e8f0', color: '#2d3748', border: '#cbd5e0' },
}

const FLAG_STYLES = {
  toxic_chat:   { bg: '#f8d7da', color: '#7c1d24', label: 'Toxic chat' },
  brute_force:  { bg: '#fff3cd', color: '#664d03', label: 'Brute force' },
}

function RoleBadge({ name }) {
  const c = ROLE_COLORS[name] || ROLE_COLORS['user']
  return (
    <span style={{
      fontFamily: FONT, fontSize: '0.7rem', fontWeight: 'bold',
      padding: '3px 10px', borderRadius: 20,
      backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  )
}

function FlagBadge({ reason }) {
  const s = FLAG_STYLES[reason] || { bg: '#e2e8f0', color: '#2d3748', label: reason }
  return (
    <span style={{
      fontFamily: FONT, fontSize: '0.68rem', fontWeight: 'bold',
      padding: '2px 8px', borderRadius: 20,
      backgroundColor: s.bg, color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ── Users tab ──────────────────────────────────────────────────
function UsersTab({ currentUser }) {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [changing, setChanging] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [usersData, rolesData] = await Promise.all([fetchAdminUsers(), fetchRoles()])
      setUsers(usersData)
      setRoles(Array.isArray(rolesData) ? rolesData : [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleRoleChange = async (userId, roleId) => {
    setChanging(userId)
    try {
      await updateUserRole(userId, Number(roleId))
      setToast('Role updated.')
      load()
    } catch (err) { setError(err.message) }
    finally { setChanging(null) }
  }

  const thStyle = {
    fontFamily: FONT, fontSize: '0.7rem', fontWeight: 'bold', color: '#333',
    textAlign: 'left', padding: '8px 12px', textTransform: 'uppercase',
    letterSpacing: 1, borderBottom: '2px solid rgba(0,0,0,0.2)',
  }
  const tdStyle = {
    fontFamily: FONT, fontSize: '0.82rem', color: '#111',
    padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,0.1)',
    verticalAlign: 'middle',
  }

  return (
    <>
      <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: '0 0 24px' }}>
        Admin — Users
      </h1>

      {toast && <div style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#0a3622', backgroundColor: '#d1e7dd', padding: '8px 16px', borderRadius: 8, marginBottom: 16 }}>{toast}</div>}
      {error && <div style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#7c1d24', backgroundColor: '#f8d7da', padding: '8px 16px', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 18, height: 18, border: '2px solid #ccc', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} aria-label="Loading" />
          <span style={{ fontFamily: FONT, color: '#444', fontSize: '0.9rem' }}>Loading users...</span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Current Role</th>
                <th style={thStyle}>Change Role</th>
                <th style={thStyle}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr
                  key={u.UserId}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  style={{ transition: 'background-color 0.15s' }}
                >
                  <td style={tdStyle}>
                    <strong>{u.Name}</strong>
                    {u.UserId === currentUser?.UserId && (
                      <span style={{ fontSize: '0.65rem', color: '#666', marginLeft: 6 }}>(you)</span>
                    )}
                  </td>
                  <td style={tdStyle}>{u.Email}</td>
                  <td style={tdStyle}><RoleBadge name={u.role?.Name || 'user'} /></td>
                  <td style={tdStyle}>
                    <select
                      disabled={changing === u.UserId || u.UserId === currentUser?.UserId}
                      value={u.role?.RoleId || ''}
                      onChange={e => handleRoleChange(u.UserId, e.target.value)}
                      style={{
                        fontFamily: FONT, fontSize: '0.78rem', padding: '5px 10px',
                        borderRadius: 8, border: '1px solid #555',
                        backgroundColor: '#f5f5d0', color: '#111',
                        cursor: u.UserId === currentUser?.UserId ? 'not-allowed' : 'pointer',
                        opacity: changing === u.UserId ? 0.6 : 1,
                      }}
                    >
                      {roles.map(r => (
                        <option key={r.RoleId} value={r.RoleId}>{r.Name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '0.75rem', color: '#444' }}>
                      {new Date(u.CreatedAt).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p style={{ fontFamily: FONT, color: '#444', marginTop: 16 }}>No users found.</p>}
        </div>
      )}
    </>
  )
}

// ── Flagged Users tab ──────────────────────────────────────────
function FlaggedTab() {
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [clearing, setClearing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await fetchFlaggedUsers()
      setFlags(Array.isArray(data) ? data : [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleClear = async (userId) => {
    setClearing(userId)
    try {
      await clearUserFlags(userId)
      setToast('Flags cleared.')
      load()
    } catch (err) { setError(err.message) }
    finally { setClearing(null) }
  }

  // Group by user for display
  const grouped = flags.reduce((acc, f) => {
    if (!acc[f.userId]) acc[f.userId] = { userId: f.userId, userName: f.userName, userEmail: f.userEmail, userRole: f.userRole, flags: [] }
    acc[f.userId].flags.push(f)
    return acc
  }, {})
  const users = Object.values(grouped)

  const thStyle = {
    fontFamily: FONT, fontSize: '0.7rem', fontWeight: 'bold', color: '#333',
    textAlign: 'left', padding: '8px 12px', textTransform: 'uppercase',
    letterSpacing: 1, borderBottom: '2px solid rgba(0,0,0,0.2)',
  }
  const tdStyle = {
    fontFamily: FONT, fontSize: '0.82rem', color: '#111',
    padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,0.1)',
    verticalAlign: 'top',
  }

  return (
    <>
      <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: '0 0 8px' }}>
        Admin — Flagged Users
      </h1>
      <p style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#333', marginBottom: 24 }}>
        Users automatically flagged for toxic chat messages or repeated failed login attempts.
      </p>

      {toast && <div style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#0a3622', backgroundColor: '#d1e7dd', padding: '8px 16px', borderRadius: 8, marginBottom: 16 }}>{toast}</div>}
      {error && <div style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#7c1d24', backgroundColor: '#f8d7da', padding: '8px 16px', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 18, height: 18, border: '2px solid #ccc', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} aria-label="Loading" />
          <span style={{ fontFamily: FONT, color: '#444', fontSize: '0.9rem' }}>Loading flags...</span>
        </div>
      ) : users.length === 0 ? (
        <div style={{
          fontFamily: FONT, color: '#444', fontSize: '0.9rem',
          backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 12,
          padding: '40px 24px', textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a3622" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          No flagged users — everything looks clean.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
            <thead>
              <tr>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Flags ({flags.length})</th>
                <th style={thStyle}>Latest</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr
                  key={u.userId}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  style={{ transition: 'background-color 0.15s' }}
                >
                  <td style={tdStyle}>
                    <strong>{u.userName}</strong>
                    <br />
                    <span style={{ fontSize: '0.72rem', color: '#555' }}>{u.userEmail}</span>
                  </td>
                  <td style={tdStyle}><RoleBadge name={u.userRole} /></td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {u.flags.map(f => (
                        <div key={f.flagId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <FlagBadge reason={f.reason} />
                          {f.detail && (
                            <span style={{
                              fontSize: '0.7rem', color: '#555', fontFamily: FONT,
                              maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }} title={f.detail}>
                              {f.detail}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.72rem', color: '#444', whiteSpace: 'nowrap' }}>
                    {new Date(u.flags[0].createdAt).toLocaleString()}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => handleClear(u.userId)}
                      disabled={clearing === u.userId}
                      style={{
                        fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold',
                        padding: '5px 14px', borderRadius: 8,
                        border: '1px solid #b91c1c',
                        backgroundColor: clearing === u.userId ? '#f5c2c7' : '#fee2e2',
                        color: '#7c1d24', cursor: 'pointer',
                        opacity: clearing === u.userId ? 0.6 : 1,
                      }}
                    >
                      {clearing === u.userId ? 'Clearing…' : 'Clear flags'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ── Root view ──────────────────────────────────────────────────
export default function AdminView() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState('users')

  const navItems = [
    {
      id: 'users',
      label: 'Users',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      id: 'flags',
      label: 'Flagged Users',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
    },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FONT }}>

      {/* SIDEBAR */}
      <aside style={{
        width: 210, minWidth: 210, backgroundColor: '#2d3748', color: '#e2e8f0',
        display: 'flex', flexDirection: 'column', padding: '20px 0', boxSizing: 'border-box',
      }}>
        {/* User info */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <button onClick={() => navigate('/tasks')} aria-label="Back to tasks" style={{
            width: 36, height: 36, borderRadius: '50%', backgroundColor: '#4a5568',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0,
            border: 'none', color: '#e2e8f0', cursor: 'pointer',
          }}>
            {currentUser?.Name ? currentUser.Name.charAt(0).toUpperCase() : '?'}
          </button>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.Name || 'Unknown'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#8a9e6e', textTransform: 'uppercase', letterSpacing: 1 }}>admin</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 10 }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                color: '#e2e8f0', fontSize: '0.9rem', border: 'none', cursor: 'pointer',
                textAlign: 'left', fontFamily: FONT, width: '100%',
                backgroundColor: activeTab === item.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                borderLeft: activeTab === item.id ? '3px solid #8a9e6e' : '3px solid transparent',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => { if (activeTab !== item.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (activeTab !== item.id) e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Back link */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 20px' }}>
          <button onClick={() => navigate('/tasks')} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
            color: '#e2e8f0', fontSize: '0.85rem', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', fontFamily: FONT, width: '100%',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Tasks
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{
        flex: 1, backgroundColor: '#8a9e6e', padding: '30px 40px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Watermark */}
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          fontSize: '8rem', fontWeight: 900, color: 'rgba(0,0,0,0.08)',
          letterSpacing: 8, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
        }}>
          Planex
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {activeTab === 'users'
            ? <UsersTab currentUser={currentUser} />
            : <FlaggedTab />
          }
        </div>
      </main>
    </div>
  )
}
