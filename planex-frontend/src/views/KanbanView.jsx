import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchTasks, updateTaskStatus } from '../services/api'

const FONT = '"Courier New", Courier, monospace'

const COLUMNS = [
  { key: 'todo',        label: 'To Do',       headerBg: '#2d3748', headerColor: '#e2e8f0' },
  { key: 'in_progress', label: 'In Progress',  headerBg: '#744210', headerColor: '#fefce8' },
  { key: 'done',        label: 'Done',         headerBg: '#14532d', headerColor: '#f0fdf4' },
]

const PRIORITY_COLORS = {
  High:   { bg: '#f8d7da', color: '#7c1d24', border: '#f5c2c7' },
  Medium: { bg: '#fff3cd', color: '#664d03', border: '#ffecb5' },
  Low:    { bg: '#d1e7dd', color: '#0a3622', border: '#badbcc' },
}

function PriorityBadge({ priority }) {
  const c = PRIORITY_COLORS[priority] || PRIORITY_COLORS.Low
  return (
    <span style={{
      fontFamily: FONT, fontSize: '0.65rem', fontWeight: 'bold',
      padding: '2px 8px', borderRadius: 20,
      backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {priority}
    </span>
  )
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
      color: '#e2e8f0', fontSize: '0.9rem', border: 'none', cursor: 'pointer',
      textAlign: 'left', width: '100%', fontFamily: FONT,
      backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
      transition: 'background-color 0.2s',
    }}>
      <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

export default function KanbanView() {
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuth()

  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const draggedIdRef = useRef(null)

  const load = useCallback(async () => {
    if (!user?.UserId) return
    setLoading(true)
    try {
      const data = await fetchTasks({
        page: 1, limit: 100,
        filter: isAdmin ? 'all' : 'active',
        userId: user.UserId,
        userName: user.Name,
        isAdmin,
      })
      // Include completed tasks too when admin; for non-admin, fetch all
      const allData = await fetchTasks({
        page: 1, limit: 100,
        userId: user.UserId,
        userName: user.Name,
        isAdmin,
      })
      setTasks(allData.data || [])
    } catch (err) {
      console.error('Kanban load error:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.UserId, user?.Name, isAdmin])

  useEffect(() => { load() }, [load])

  // Live updates via WebSocket events
  useEffect(() => {
    const onCreated = (e) => {
      setTasks(prev => {
        if (prev.find(t => t.id === e.detail.id)) return prev
        return [...prev, e.detail]
      })
    }
    const onUpdated = (e) => {
      setTasks(prev => prev.map(t => t.id === e.detail.id ? { ...t, ...e.detail } : t))
    }
    const onDeleted = (e) => {
      setTasks(prev => prev.filter(t => t.id !== e.detail.id))
    }
    window.addEventListener('task:created', onCreated)
    window.addEventListener('task:updated', onUpdated)
    window.addEventListener('task:deleted', onDeleted)
    return () => {
      window.removeEventListener('task:created', onCreated)
      window.removeEventListener('task:updated', onUpdated)
      window.removeEventListener('task:deleted', onDeleted)
    }
  }, [])

  const tasksByStatus = {
    todo:        tasks.filter(t => (t.status || 'todo') === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done:        tasks.filter(t => t.status === 'done'),
  }

  // ── Drag handlers ──────────────────────────────────────────
  const handleDragStart = (e, taskId) => {
    draggedIdRef.current = taskId
    setDraggedId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverCol(null)
    draggedIdRef.current = null
  }

  const handleDragOver = (e, colKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colKey)
  }

  const handleDragLeave = () => setDragOverCol(null)

  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    setDragOverCol(null)
    const id = draggedIdRef.current
    if (!id) return
    const task = tasks.find(t => t.id === id)
    if (!task || task.status === newStatus) return

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: newStatus, isCompleted: newStatus === 'done' } : t
    ))
    setDraggedId(null)
    draggedIdRef.current = null

    try {
      await updateTaskStatus(id, newStatus)
    } catch (err) {
      console.error('Status update failed:', err)
      load()
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FONT }}>

      {/* SIDEBAR */}
      <aside style={{
        width: 210, minWidth: 210, backgroundColor: '#2d3748', color: '#e2e8f0',
        display: 'flex', flexDirection: 'column', padding: '20px 0', boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', backgroundColor: '#4a5568',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0,
          }}>
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
            <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>} label="All Tasks" onClick={() => navigate('/tasks')} />
          )}
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>} label="Active" onClick={() => navigate('/tasks')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>} label="Completed" onClick={() => navigate('/tasks')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} label="Collaborative" onClick={() => navigate('/tasks')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>} label="Add Task" onClick={() => navigate('/tasks/new')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>} label="Kanban" active onClick={() => {}} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} label="Calendar" onClick={() => navigate('/calendar')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>} label="Statistics" onClick={() => navigate('/statistics')} />
          {isAdmin && (
            <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} label="Admin Panel" onClick={() => navigate('/admin')} />
          )}
        </div>

        <button onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
          color: '#e2e8f0', fontSize: '0.9rem', border: 'none', backgroundColor: 'transparent',
          cursor: 'pointer', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', fontFamily: FONT,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <main style={{
        flex: 1, backgroundColor: '#8a9e6e', padding: '30px 30px',
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Watermark */}
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          fontSize: '8rem', fontWeight: 900, color: 'rgba(0,0,0,0.08)',
          letterSpacing: 8, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
        }}>Planex</div>

        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24 }}>
            <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: 0 }}>
              Kanban Board
            </h1>
            <span style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#333' }}>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </span>
            {loading && <span style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#555' }}>Loading...</span>}
          </div>

          {/* COLUMNS */}
          <div style={{ display: 'flex', gap: 20, flex: 1, alignItems: 'flex-start' }}>
            {COLUMNS.map(col => {
              const colTasks = tasksByStatus[col.key] || []
              const isOver = dragOverCol === col.key
              return (
                <div
                  key={col.key}
                  onDragOver={e => handleDragOver(e, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, col.key)}
                  style={{
                    flex: 1, minWidth: 0, borderRadius: 16,
                    backgroundColor: isOver ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
                    border: isOver ? '2px dashed #2d3748' : '2px solid transparent',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column',
                    maxHeight: 'calc(100vh - 160px)',
                  }}
                >
                  {/* Column header */}
                  <div style={{
                    backgroundColor: col.headerBg, color: col.headerColor,
                    padding: '10px 16px', borderRadius: '14px 14px 0 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontFamily: FONT, fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: 1 }}>
                      {col.label}
                    </span>
                    <span style={{
                      fontFamily: FONT, fontSize: '0.75rem',
                      backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
                      padding: '2px 10px',
                    }}>
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div style={{
                    padding: '12px 10px', display: 'flex', flexDirection: 'column',
                    gap: 10, overflowY: 'auto', flex: 1,
                  }}>
                    {colTasks.length === 0 && (
                      <div style={{
                        fontFamily: FONT, fontSize: '0.75rem', color: '#555',
                        textAlign: 'center', padding: '20px 0', fontStyle: 'italic',
                      }}>
                        Drop tasks here
                      </div>
                    )}
                    {colTasks.map(task => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={e => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        style={{
                          backgroundColor: draggedId === task.id ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)',
                          borderRadius: 12, padding: '12px 14px',
                          cursor: 'grab', boxShadow: draggedId === task.id ? 'none' : '0 2px 8px rgba(0,0,0,0.12)',
                          opacity: draggedId === task.id ? 0.5 : 1,
                          transition: 'opacity 0.15s, box-shadow 0.15s',
                          userSelect: 'none',
                        }}
                        onMouseEnter={e => { if (draggedId !== task.id) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)' }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = draggedId === task.id ? 'none' : '0 2px 8px rgba(0,0,0,0.12)' }}
                      >
                        <div style={{ fontFamily: FONT, fontSize: '0.85rem', fontWeight: 'bold', color: '#111', marginBottom: 8, lineHeight: 1.3 }}>
                          {task.isBlocked && <span title="Blocked by incomplete dependencies" style={{ marginRight: 5 }}>🔒</span>}
                          {task.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <PriorityBadge priority={task.priority} />
                          <span style={{ fontFamily: FONT, fontSize: '0.65rem', color: '#666' }}>
                            {task.dueDate}
                          </span>
                        </div>
                        {task.collaborators && task.collaborators.length > 0 && (
                          <div style={{ fontFamily: FONT, fontSize: '0.65rem', color: '#555', marginTop: 6 }}>
                            {task.collaborators.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
