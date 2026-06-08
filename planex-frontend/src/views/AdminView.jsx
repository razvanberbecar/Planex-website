import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchAdminUsers, fetchRoles, updateUserRole } from '../services/api'

const FONT = '"Courier New", Courier, monospace'

const ROLE_COLORS = {
  admin:   { bg: '#f8d7da', color: '#7c1d24', border: '#f5c2c7' },
  manager: { bg: '#fce4d6', color: '#8a4b0a', border: '#f5cba0' },
  editor:  { bg: '#fff3cd', color: '#664d03', border: '#ffecb5' },
  viewer:  { bg: '#d1e7dd', color: '#0a3622', border: '#badbcc' },
  user:    { bg: '#e2e8f0', color: '#2d3748', border: '#cbd5e0' },
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

export default function AdminView() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [changing, setChanging] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [usersData, rolesData] = await Promise.all([fetchAdminUsers(), fetchRoles()])
      setUsers(usersData)
      setRoles(Array.isArray(rolesData) ? rolesData : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
    } catch (err) {
      setError(err.message)
    } finally {
      setChanging(null)
    }
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
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FONT }}>

      {/* SIDEBAR */}
      <aside style={{
        width: 210, minWidth: 210, backgroundColor: '#2d3748', color: '#e2e8f0',
        display: 'flex', flexDirection: 'column', padding: '20px 0', boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', backgroundColor: '#4a5568',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0,
          }}>
            {currentUser?.Name ? currentUser.Name.charAt(0).toUpperCase() : '?'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: '0.85rem', fontWeight: 'bold',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {currentUser?.Name || 'Unknown'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#8a9e6e', textTransform: 'uppercase', letterSpacing: 1 }}>
              admin
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
            color: '#e2e8f0', fontSize: '0.9rem',
            backgroundColor: 'rgba(255,255,255,0.12)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Users</span>
          </div>
        </div>

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
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          fontSize: '8rem', fontWeight: 900, color: 'rgba(0,0,0,0.08)',
          letterSpacing: 8, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
        }}>
          Planex
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontFamily: FONT, fontSize: '2rem', fontWeight: 900,
            color: '#111', textDecoration: 'underline', margin: '0 0 24px',
          }}>
            Admin — Users
          </h1>

          {toast && (
            <div style={{
              fontFamily: FONT, fontSize: '0.85rem', color: '#0a3622',
              backgroundColor: '#d1e7dd', padding: '8px 16px', borderRadius: 8, marginBottom: 16,
            }}>
              {toast}
            </div>
          )}

          {error && (
            <div style={{
              fontFamily: FONT, fontSize: '0.85rem', color: '#7c1d24',
              backgroundColor: '#f8d7da', padding: '8px 16px', borderRadius: 8, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <p style={{ fontFamily: FONT, color: '#444' }}>Loading...</p>
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
                      <td style={tdStyle}>
                        <RoleBadge name={u.role?.Name || 'user'} />
                      </td>
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
              {users.length === 0 && (
                <p style={{ fontFamily: FONT, color: '#444', marginTop: 16 }}>No users found.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
