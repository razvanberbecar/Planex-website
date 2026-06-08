import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchTasks } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { saveFilterPreference, loadFilterPreference } from '../utils/cookies'

const FONT = '"Courier New", Courier, monospace'
const LIMIT = 5
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 }

const priorityColors = {
  High:   { bg: '#f8d7da', color: '#7c1d24', border: '#f5c2c7' },
  Medium: { bg: '#fff3cd', color: '#664d03', border: '#ffecb5' },
  Low:    { bg: '#d1e7dd', color: '#0a3622', border: '#badbcc' },
}

function PriorityBadge({ priority }) {
  const p = priority || 'Low'
  const colors = priorityColors[p] || priorityColors['Low']
  return (
    <span style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', padding: '3px 10px', borderRadius: 20, backgroundColor: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>
      {p}
    </span>
  )
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', color: '#e2e8f0', fontSize: '0.9rem', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent', fontFamily: FONT, transition: 'background-color 0.2s' }}>
      <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

export default function MasterView() {
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuth()

  const [filter, setFilter]       = useState(() => loadFilterPreference())
  const [search, setSearch]       = useState('')
  const [sortOrder, setSortOrder] = useState('none')
  const [page, setPage]           = useState(1)

  const [tasks, setTasks]         = useState([])
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(false)

  // ── FETCH CURRENT PAGE ─────────────────────────────────
  const loadPage = useCallback(async (pageNum) => {
    // Don't fetch until we know who the user is
    if (!user?.UserId) return
    setLoading(true)
    try {
      const data = await fetchTasks({
        page: pageNum,
        limit: LIMIT,
        filter,
        search,
        userId: user.UserId,
        userName: user.Name,
        isAdmin,
      })
      setTasks(data.data)
      setTotalPages(data.totalPages)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [filter, search, user?.UserId, user?.Name, isAdmin])

  // Reload whenever filter, search, or user changes — reset to page 1
  useEffect(() => {
    setPage(1)
    loadPage(1)
  }, [filter, search, user?.UserId])

  // Reload when page changes
  useEffect(() => {
    loadPage(page)
  }, [page, user?.UserId])

  // Live updates from other users via WebSocket
  useEffect(() => {
    const reload = () => loadPage(page)
    window.addEventListener('task:created', reload)
    window.addEventListener('task:updated', reload)
    window.addEventListener('task:deleted', reload)
    return () => {
      window.removeEventListener('task:created', reload)
      window.removeEventListener('task:updated', reload)
      window.removeEventListener('task:deleted', reload)
    }
  }, [page, loadPage])

  // ── SORT (client side, on current page) ───────────────
  const cycleSortOrder = () => setSortOrder(prev => prev === 'none' ? 'high' : prev === 'high' ? 'low' : 'none')
  const sortLabel = { none: '⇅ Priority', high: '↑ High→Low', low: '↓ Low→High' }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortOrder === 'none') return 0
    const aO = PRIORITY_ORDER[a.priority] ?? 1
    const bO = PRIORITY_ORDER[b.priority] ?? 1
    return sortOrder === 'high' ? aO - bO : bO - aO
  })

  const changeFilter = (f) => {
    setFilter(f)
    setSearch('')
    saveFilterPreference(f)
  }

  const goToPage = (p) => {
    const clamped = Math.max(1, Math.min(p, totalPages))
    setPage(clamped)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const filterLabel = { active: 'Active Tasks', completed: 'Completed Tasks', collaborative: 'Collaborative Tasks', all: 'All Tasks' }
  const thStyle = { fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#333', textAlign: 'left', padding: '6px 14px', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(0,0,0,0.2)' }
  const tdStyle = { fontFamily: FONT, fontSize: '0.9rem', color: '#111', padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.12)' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FONT }}>

      {/* SIDEBAR */}
      <aside style={{ width: 210, minWidth: 210, backgroundColor: '#2d3748', color: '#e2e8f0', display: 'flex', flexDirection: 'column', padding: '20px 0', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#4a5568', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
            {user?.Name ? user.Name.charAt(0).toUpperCase() : '?'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.Name || 'Unknown'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#8a9e6e', textTransform: 'uppercase', letterSpacing: 1 }}>
              {user?.role?.Name || 'user'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10, flex: 1 }}>
          {isAdmin && (
            <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>} label="All Tasks" active={filter === 'all'} onClick={() => changeFilter('all')} />
          )}
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>} label="Active" active={filter === 'active'} onClick={() => changeFilter('active')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>} label="Completed" active={filter === 'completed'} onClick={() => changeFilter('completed')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} label="Collaborative" active={filter === 'collaborative'} onClick={() => changeFilter('collaborative')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>} label="Add Task" onClick={() => navigate('/tasks/new')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>} label="Kanban" onClick={() => navigate('/kanban')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} label="Calendar" onClick={() => navigate('/calendar')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>} label="Statistics" onClick={() => navigate('/statistics')} />
          {isAdmin && (
            <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} label="Admin Panel" onClick={() => navigate('/admin')} />
          )}
        </div>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', color: '#e2e8f0', fontSize: '0.9rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', fontFamily: FONT }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, backgroundColor: '#8a9e6e', padding: '40px 50px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: '8rem', fontWeight: 900, color: 'rgba(0,0,0,0.08)', letterSpacing: 8, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>Planex</div>

        {/* Title + controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30, position: 'relative', zIndex: 1, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: 0 }}>
              {filterLabel[filter] || 'Tasks'}
            </h1>
            <span style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#333' }}>
              {total} task{total !== 1 ? 's' : ''} total
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

            {/* Sort button */}
            <button onClick={cycleSortOrder} style={{ fontFamily: FONT, fontSize: '0.8rem', fontWeight: 'bold', padding: '8px 14px', borderRadius: 30, cursor: 'pointer', border: '1px solid #333', backgroundColor: sortOrder !== 'none' ? '#3a4558' : 'transparent', color: sortOrder !== 'none' ? '#ddd' : '#333', transition: 'all 0.2s' }}>
              {sortLabel[sortOrder]}
            </button>

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f5f5d0', borderRadius: 30, padding: '8px 16px', gap: 8, width: 220 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: FONT, fontSize: '0.85rem', color: '#222', width: '100%' }} />
              {search && <span onClick={() => setSearch('')} style={{ cursor: 'pointer', color: '#888' }}>×</span>}
            </div>

          </div>
        </div>

        {/* TABLE */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Task</th>
                <th style={thStyle}>Due Date</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={cycleSortOrder}>
                  Priority {sortOrder === 'high' ? '↑' : sortOrder === 'low' ? '↓' : '⇅'}
                </th>
                <th style={thStyle}>Collaborative</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#444' }}>Loading...</td></tr>
              ) : sortedTasks.length === 0 ? (
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#444' }}>
                  {search ? `No tasks matching "${search}".` : 'No tasks found.'}
                </td></tr>
              ) : (
                sortedTasks.map(task => (
                  <tr key={task.id} onClick={() => navigate('/tasks/' + task.id)} style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={tdStyle}>{task.title}</td>
                    <td style={tdStyle}>{task.dueDate}</td>
                    <td style={tdStyle}><PriorityBadge priority={task.priority} /></td>
                    <td style={tdStyle}>{task.collaborators && task.collaborators.length > 0 ? 'Yes' : 'No'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 24, position: 'relative', zIndex: 1 }}>
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #333', backgroundColor: 'transparent', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: '1rem', color: '#111', opacity: page <= 1 ? 0.4 : 1 }}>
            {'<'}
          </button>
          <span style={{ fontFamily: FONT, fontSize: '1rem', fontWeight: 'bold', color: '#111' }}>
            {page} / {totalPages}
          </span>
          <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #333', backgroundColor: 'transparent', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '1rem', color: '#111', opacity: page >= totalPages ? 0.4 : 1 }}>
            {'>'}
          </button>
        </div>

      </main>
    </div>
  )
}
