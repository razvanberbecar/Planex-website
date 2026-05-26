import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchStatistics } from '../services/api'
import { useAuth } from '../context/AuthContext'

const FONT = '"Courier New", Courier, monospace'

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', color: '#e2e8f0', fontSize: '0.9rem', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent', fontFamily: FONT }}>
      <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{ backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 12, padding: '16px 20px', textAlign: 'center', flex: 1, minWidth: 120 }}>
      <div style={{ fontFamily: FONT, fontSize: '0.65rem', color: '#333', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111' }}>{value}</div>
    </div>
  )
}

function BarChart({ data, title }) {
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const BAR_HEIGHT = 160
  return (
    <div style={{ flex: 1 }}>
      <p style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#333', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 12px 0' }}>{title}</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: BAR_HEIGHT + 30 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 4 }}>
            <span style={{ fontFamily: FONT, fontSize: '0.7rem', color: '#333' }}>{d.value}</span>
            <div style={{ width: '100%', height: Math.max((d.value / maxVal) * BAR_HEIGHT, 4), backgroundColor: d.color || '#3a4558', borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' }} />
            <span style={{ fontFamily: FONT, fontSize: '0.6rem', color: '#333', textAlign: 'center', wordBreak: 'break-word', maxWidth: 50 }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DonutChart({ completed, active, total }) {
  const size = 120, r = 45, cx = 60, cy = 60
  const circumference = 2 * Math.PI * r
  const completedPct = total === 0 ? 0 : completed / total
  const completedDash = completedPct * circumference
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <p style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#333', letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Completion</p>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth={16} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3a4558" strokeWidth={16}
          strokeDasharray={`${completedDash} ${circumference}`}
          strokeDashoffset={circumference * 0.25}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={cx} y={cy + 6} textAnchor="middle" fontFamily={FONT} fontSize="16" fontWeight="bold" fill="#111">
          {total === 0 ? '0%' : `${Math.round(completedPct * 100)}%`}
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3a4558' }} />
          <span style={{ fontFamily: FONT, fontSize: '0.7rem', color: '#333' }}>Done ({completed})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.15)' }} />
          <span style={{ fontFamily: FONT, fontSize: '0.7rem', color: '#333' }}>Active ({active})</span>
        </div>
      </div>
    </div>
  )
}

export default function Statistics() {
  const navigate = useNavigate()
  const { user, isAdmin, logout } = useAuth()
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView]     = useState('table')

  useEffect(() => {
    fetchStatistics({
      userId: user?.UserId,
      userName: user?.Name,
      isAdmin,
    })
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user?.UserId, user?.Name, isAdmin])

  const priorityData = stats ? [
    { label: 'High',   value: stats.priority.high,   color: '#f8d7da' },
    { label: 'Medium', value: stats.priority.medium, color: '#fff3cd' },
    { label: 'Low',    value: stats.priority.low,    color: '#d1e7dd' },
  ] : []

  const monthData = stats
    ? stats.monthlyBreakdown.map(m => ({ label: m.month, value: m.tasks, color: '#3a4558' }))
    : []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FONT }}>

      <aside style={{ width: 210, minWidth: 210, backgroundColor: '#2d3748', color: '#e2e8f0', display: 'flex', flexDirection: 'column', padding: '20px 0', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#4a5568', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
            {user?.Name ? user.Name.charAt(0).toUpperCase() : '?'}
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{user?.Name || 'Unknown'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10, flex: 1 }}>
          <SidebarItem icon="☐"  label="Active"        onClick={() => navigate('/tasks')} />
          <SidebarItem icon="☑"  label="Completed"     onClick={() => navigate('/tasks')} />
          <SidebarItem icon="👥" label="Collaborative" onClick={() => navigate('/tasks')} />
          <SidebarItem icon="+"  label="Add Task"       onClick={() => navigate('/tasks/new')} />
          <SidebarItem icon="📊" label="Statistics"    active={true} onClick={() => navigate('/statistics')} />
        </div>
        <button onClick={async () => { await logout(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', color: '#e2e8f0', fontSize: '0.9rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', fontFamily: FONT }}>
          ⇥ Logout
        </button>
      </aside>

      <main style={{ flex: 1, backgroundColor: '#8a9e6e', padding: '40px 50px', position: 'relative', overflow: 'auto' }}>
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: '8rem', fontWeight: 900, color: 'rgba(0,0,0,0.06)', letterSpacing: 8, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>Planex</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30, position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: 0 }}>Statistics</h1>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.2)' }}>
            {['table', 'charts'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '8px 20px', fontFamily: FONT, fontSize: '0.85rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: view === v ? '#2d3748' : 'transparent', color: view === v ? '#e2e8f0' : '#333', transition: 'background-color 0.2s', textTransform: 'capitalize' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ fontFamily: FONT, color: '#111' }}>Loading statistics...</p>
        ) : !stats ? (
          <p style={{ fontFamily: FONT, color: '#7c1d24' }}>Could not load statistics. Is the backend running?</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              <StatCard label="Total Tasks"   value={stats.total} />
              <StatCard label="Completed"     value={stats.completed} />
              <StatCard label="Collaborative" value={stats.collaborative} />
              <StatCard label="Peak Month"    value={stats.peakMonth || '—'} />
            </div>

            {view === 'table' && (
              <div style={{ position: 'relative', zIndex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Month', 'Tasks', 'Collaborative', 'Solo', 'Collab %'].map(h => (
                        <th key={h} style={{ fontFamily: FONT, fontSize: '0.7rem', fontWeight: 'bold', color: '#555', textTransform: 'uppercase', letterSpacing: 1, padding: '6px 14px', borderBottom: '1px solid rgba(0,0,0,0.2)', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.monthlyBreakdown.map(m => (
                      <tr key={m.month}>
                        <td style={{ fontFamily: FONT, fontSize: '0.9rem', padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.1)', color: '#111' }}>{m.month}</td>
                        <td style={{ fontFamily: FONT, fontSize: '0.9rem', padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.1)', color: '#111' }}>{m.tasks}</td>
                        <td style={{ fontFamily: FONT, fontSize: '0.9rem', padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.1)', color: '#111' }}>{m.collaborative}</td>
                        <td style={{ fontFamily: FONT, fontSize: '0.9rem', padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.1)', color: '#111' }}>{m.solo}</td>
                        <td style={{ fontFamily: FONT, fontSize: '0.9rem', padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.1)', color: '#111' }}>{m.tasks === 0 ? '0%' : `${Math.round((m.collaborative / m.tasks) * 100)}%`}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 'bold' }}>
                      <td style={{ fontFamily: FONT, padding: '12px 14px', color: '#111', borderTop: '2px solid rgba(0,0,0,0.2)' }}>TOTAL</td>
                      <td style={{ fontFamily: FONT, padding: '12px 14px', color: '#111', borderTop: '2px solid rgba(0,0,0,0.2)' }}>{stats.total}</td>
                      <td style={{ fontFamily: FONT, padding: '12px 14px', color: '#111', borderTop: '2px solid rgba(0,0,0,0.2)' }}>{stats.collaborative}</td>
                      <td style={{ fontFamily: FONT, padding: '12px 14px', color: '#111', borderTop: '2px solid rgba(0,0,0,0.2)' }}>{stats.solo}</td>
                      <td style={{ fontFamily: FONT, padding: '12px 14px', color: '#111', borderTop: '2px solid rgba(0,0,0,0.2)' }}>{stats.collaborativeRate}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {view === 'charts' && (
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <DonutChart completed={stats.completed} active={stats.active} total={stats.total} />
                {monthData.length > 0 && <BarChart data={monthData} title="Tasks per Month" />}
                <BarChart data={priorityData} title="Tasks by Priority" />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}