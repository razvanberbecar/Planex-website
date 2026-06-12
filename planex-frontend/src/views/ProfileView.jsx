import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchStatistics, changePassword } from '../services/api'
import { useAuth } from '../context/AuthContext'

const FONT = '"Courier New", Courier, monospace'

const priorityColors = {
  High:   { bg: '#f8d7da', color: '#7c1d24' },
  Medium: { bg: '#fff3cd', color: '#664d03' },
  Low:    { bg: '#d1e7dd', color: '#0a3622' },
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', color: '#e2e8f0', fontSize: '0.9rem', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent', fontFamily: FONT, transition: 'background-color 0.2s' }}>
      <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ backgroundColor: '#f5f5d0', borderRadius: 16, padding: '20px 24px', flex: 1, minWidth: 110 }}>
      <div style={{ fontFamily: FONT, fontSize: '0.65rem', color: '#555', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontFamily: FONT, fontSize: '0.7rem', color: '#777', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function ProfileView() {
  const navigate = useNavigate()
  const { user, isAdmin, logout, updateUserProfile } = useAuth()

  // ── Profile form ──────────────────────────────────────
  const [name, setName]           = useState(user?.Name || '')
  const [nameSuccess, setNameSuccess] = useState('')
  const [nameError, setNameError] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // ── Password form ─────────────────────────────────────
  const [pwCurrent, setPwCurrent]   = useState('')
  const [pwNew, setPwNew]           = useState('')
  const [pwConfirm, setPwConfirm]   = useState('')
  const [pwError, setPwError]       = useState('')
  const [pwSuccess, setPwSuccess]   = useState('')
  const [pwSaving, setPwSaving]     = useState(false)

  // ── Stats ─────────────────────────────────────────────
  const [stats, setStats]       = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setName(user.Name || '')
    setStatsLoading(true)
    fetchStatistics({ userId: user.UserId, userName: user.Name, isAdmin: false })
      .then(data => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false))
  }, [user?.UserId])

  const handleSaveName = async () => {
    if (!name.trim()) { setNameError('Name cannot be empty.'); return }
    setNameSaving(true); setNameError(''); setNameSuccess('')
    try {
      await updateUserProfile(name.trim())
      setNameSuccess('Name updated!')
      setTimeout(() => setNameSuccess(''), 3000)
    } catch (err) {
      setNameError(err.message)
    }
    setNameSaving(false)
  }

  const handleChangePassword = async () => {
    setPwError(''); setPwSuccess('')
    if (!pwCurrent) { setPwError('Enter your current password.'); return }
    if (pwNew.length < 6) { setPwError('New password must be at least 6 characters.'); return }
    if (pwNew !== pwConfirm) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    try {
      await changePassword(pwCurrent, pwNew)
      setPwSuccess('Password changed successfully!')
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setTimeout(() => setPwSuccess(''), 4000)
    } catch (err) {
      setPwError(err.message)
    }
    setPwSaving(false)
  }

  const handleLogout = async () => { await logout(); navigate('/') }

  const inputStyle = { width: '100%', padding: '12px 18px', borderRadius: 30, border: 'none', backgroundColor: '#f5f5d0', fontFamily: FONT, fontSize: '0.95rem', color: '#222', boxSizing: 'border-box', outline: 'none' }
  const btnStyle   = { padding: '12px 28px', borderRadius: 30, border: 'none', backgroundColor: '#3a4558', color: '#ddd', fontFamily: FONT, fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', letterSpacing: 1 }

  const completionRate = stats ? (stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0) : null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FONT }}>

      {/* SIDEBAR */}
      <aside style={{ width: 210, minWidth: 210, backgroundColor: '#2d3748', color: '#e2e8f0', display: 'flex', flexDirection: 'column', padding: '20px 0', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#4a5568', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
            {user?.Name ? user.Name.charAt(0).toUpperCase() : '?'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.Name || 'Unknown'}</div>
            <div style={{ fontSize: '0.65rem', color: '#8a9e6e', textTransform: 'uppercase', letterSpacing: 1 }}>{user?.role?.Name || 'user'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10, flex: 1 }}>
          {isAdmin && <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>} label="All Tasks" onClick={() => navigate('/tasks')} />}
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>} label="Active" onClick={() => navigate('/tasks')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>} label="Add Task" onClick={() => navigate('/tasks/new')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>} label="Kanban" onClick={() => navigate('/kanban')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} label="Calendar" onClick={() => navigate('/calendar')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>} label="Statistics" onClick={() => navigate('/statistics')} />
          {isAdmin && <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} label="Admin Panel" onClick={() => navigate('/admin')} />}
          <SidebarItem active icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} label="Profile" onClick={() => navigate('/profile')} />
        </div>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', color: '#e2e8f0', fontSize: '0.9rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', fontFamily: FONT }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, backgroundColor: '#8a9e6e', padding: '40px 50px', position: 'relative', overflow: 'auto' }}>
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: '8rem', fontWeight: 900, color: 'rgba(0,0,0,0.08)', letterSpacing: 8, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>Planex</div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 860 }}>
          <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: '0 0 30px 0' }}>Profile</h1>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

            {/* Left column */}
            <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Avatar + name */}
              <div style={{ backgroundColor: '#f5f5d0', borderRadius: 18, padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#3a4558', color: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold', flexShrink: 0 }}>
                    {user?.Name ? user.Name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: '1rem', fontWeight: 'bold', color: '#111' }}>{user?.Name}</div>
                    <div style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#666' }}>{user?.Email}</div>
                    <div style={{ fontFamily: FONT, fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{user?.role?.Name || 'user'}</div>
                  </div>
                </div>

                <p style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#555', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px 4px' }}>Display name</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={name}
                    onChange={e => { setName(e.target.value); setNameError(''); setNameSuccess('') }}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    placeholder="Your name"
                  />
                  <button onClick={handleSaveName} disabled={nameSaving} style={{ ...btnStyle, padding: '12px 20px', whiteSpace: 'nowrap' }}>
                    {nameSaving ? '...' : 'Save'}
                  </button>
                </div>
                {nameError   && <p style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#7c1d24', marginTop: 6, marginLeft: 4 }}>{nameError}</p>}
                {nameSuccess && <p style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#0a3622', marginTop: 6, marginLeft: 4 }}>{nameSuccess}</p>}

                <p style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#888', margin: '12px 0 0 4px' }}>Email: <strong>{user?.Email}</strong> (read-only)</p>
              </div>

              {/* Change password */}
              <div style={{ backgroundColor: '#f5f5d0', borderRadius: 18, padding: '24px 28px' }}>
                <p style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#555', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 14px 0' }}>Change password</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input style={inputStyle} type="password" placeholder="Current password" value={pwCurrent} onChange={e => { setPwCurrent(e.target.value); setPwError('') }} />
                  <input style={inputStyle} type="password" placeholder="New password (min 6 chars)" value={pwNew} onChange={e => { setPwNew(e.target.value); setPwError('') }} />
                  <input style={inputStyle} type="password" placeholder="Confirm new password" value={pwConfirm} onChange={e => { setPwConfirm(e.target.value); setPwError('') }} />
                  {pwError   && <p style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#7c1d24', margin: '0 0 0 4px' }}>{pwError}</p>}
                  {pwSuccess && <p style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#0a3622', margin: '0 0 0 4px' }}>{pwSuccess}</p>}
                  <button onClick={handleChangePassword} disabled={pwSaving} style={{ ...btnStyle, alignSelf: 'flex-end' }}>
                    {pwSaving ? 'Saving...' : 'Update password'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right column — stats */}
            <div style={{ width: 240, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ backgroundColor: '#f5f5d0', borderRadius: 18, padding: '20px 24px' }}>
                <p style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#555', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 16px 0' }}>Your stats</p>
                {statsLoading ? (
                  <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#888' }}>Loading...</p>
                ) : !stats ? (
                  <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#888' }}>Could not load stats.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Total tasks',  value: stats.total },
                      { label: 'Completed',    value: stats.completed },
                      { label: 'Active',       value: stats.active ?? (stats.total - stats.completed) },
                      { label: 'Completion',   value: `${completionRate}%` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                        <span style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#555' }}>{label}</span>
                        <span style={{ fontFamily: FONT, fontSize: '1rem', fontWeight: 'bold', color: '#111' }}>{value}</span>
                      </div>
                    ))}

                    {/* Completion bar */}
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 8, backgroundColor: '#ddd', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${completionRate}%`, backgroundColor: '#3a4558', borderRadius: 4, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>

                    {/* Priority breakdown */}
                    {stats.byPriority && (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontFamily: FONT, fontSize: '0.7rem', color: '#555', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px 0' }}>By priority</p>
                        {['High', 'Medium', 'Low'].map(p => {
                          const count = stats.byPriority?.[p] ?? 0
                          const pc = priorityColors[p]
                          return (
                            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontFamily: FONT, fontSize: '0.75rem', padding: '2px 10px', borderRadius: 20, backgroundColor: pc.bg, color: pc.color }}>{p}</span>
                              <span style={{ fontFamily: FONT, fontSize: '0.85rem', fontWeight: 'bold', color: '#111' }}>{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button onClick={() => navigate('/statistics')} style={{ ...btnStyle, width: '100%', textAlign: 'center' }}>
                Full statistics →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
