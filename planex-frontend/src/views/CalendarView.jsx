import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchTasks } from '../services/api'

const FONT = '"Courier New", Courier, monospace'
const DAY_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const PRIORITY_COLORS = {
  High:   { bg: '#f8d7da', color: '#7c1d24' },
  Medium: { bg: '#fff3cd', color: '#664d03' },
  Low:    { bg: '#d1e7dd', color: '#0a3622' },
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

// ── Due-date urgency helpers ──────────────────────────────
function isDueSoon(task) {
  if (task.isCompleted || !task.dueDate) return false
  const due  = new Date(task.dueDate + 'T23:59:59')
  const diff = due - new Date()
  return diff >= 0 && diff <= 48 * 60 * 60 * 1000
}
function isOverdue(task) {
  if (task.isCompleted || !task.dueDate) return false
  return new Date(task.dueDate + 'T23:59:59') < new Date()
}

// Returns true if a recurring task falls on the given dateStr (YYYY-MM-DD)
function isRecurringOnDay(task, dateStr) {
  if (!task.recurrenceType || task.recurrenceType === 'none') return false
  if (!task.recurrenceStart || !task.recurrenceEnd) return false

  const date  = new Date(dateStr + 'T00:00:00')
  const start = new Date(task.recurrenceStart + 'T00:00:00')
  const end   = new Date(task.recurrenceEnd   + 'T00:00:00')

  if (date < start || date > end) return false

  if (task.recurrenceType === 'daily')   return true
  if (task.recurrenceType === 'weekly')  return date.getDay()  === start.getDay()
  if (task.recurrenceType === 'monthly') return date.getDate() === start.getDate()
  return false
}

function buildCells(year, month) {
  const firstDow     = new Date(year, month, 1).getDay()
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const daysInPrev   = new Date(year, month, 0).getDate()

  const cells = []

  for (let i = firstDow - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, current: false })

  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, current: true })

  const totalCells = cells.length <= 35 ? 35 : 42
  let next = 1
  while (cells.length < totalCells)
    cells.push({ day: next++, current: false })

  return cells
}

export default function CalendarView() {
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuth()

  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user?.UserId) return
    setLoading(true)
    try {
      const data = await fetchTasks({ page: 1, limit: 500, userId: user.UserId, userName: user.Name, isAdmin })
      setTasks(data.data || [])
    } catch (err) {
      console.error('Calendar load error:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.UserId, user?.Name, isAdmin])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onCreated = (e) => setTasks(prev => prev.find(t => t.id === e.detail.id) ? prev : [...prev, e.detail])
    const onUpdated = (e) => setTasks(prev => prev.map(t => t.id === e.detail.id ? { ...t, ...e.detail } : t))
    const onDeleted = (e) => setTasks(prev => prev.filter(t => t.id !== e.detail.id))
    window.addEventListener('task:created', onCreated)
    window.addEventListener('task:updated', onUpdated)
    window.addEventListener('task:deleted', onDeleted)
    return () => {
      window.removeEventListener('task:created', onCreated)
      window.removeEventListener('task:updated', onUpdated)
      window.removeEventListener('task:deleted', onDeleted)
    }
  }, [])

  const cells = buildCells(viewYear, viewMonth)

  const dateStr = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const tasksForDay = (cell) => {
    if (!cell.current) return []
    const d = dateStr(viewYear, viewMonth, cell.day)
    return tasks.filter(t => t.dueDate === d || isRecurringOnDay(t, d))
  }

  const selectedDateStr = selectedDay !== null ? dateStr(viewYear, viewMonth, selectedDay) : null
  const selectedTasks   = selectedDateStr
    ? tasks.filter(t => t.dueDate === selectedDateStr || isRecurringOnDay(t, selectedDateStr))
    : []

  // ── CSV Export ────────────────────────────────────────────
  const exportToCSV = () => {
    const esc = (val) => `"${String(val || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
    const header = ['Date', 'Title', 'Description', 'Priority', 'Status', 'Completed', 'Recurrence']
    const rows   = [header.join(',')]

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const ds       = dateStr(viewYear, viewMonth, d)
      const dayTasks = tasks.filter(t => t.dueDate === ds || isRecurringOnDay(t, ds))
      dayTasks.forEach(t => {
        rows.push([
          esc(ds),
          esc(t.title),
          esc(t.description),
          esc(t.priority),
          esc(t.status),
          esc(t.isCompleted ? 'Yes' : 'No'),
          esc(t.recurrenceType !== 'none' ? t.recurrenceType : ''),
        ].join(','))
      })
    }

    const csv  = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `planex-${MONTH_NAMES[viewMonth]}-${viewYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const prevMonth = () => {
    setSelectedDay(null)
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    setSelectedDay(null)
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const goToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDay(today.getDate())
  }

  const isToday = (cell) =>
    cell.current &&
    cell.day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear()

  const monthTaskCount = tasks.filter(t => {
    if (t.dueDate) {
      const [y, m] = t.dueDate.split('-').map(Number)
      if (y === viewYear && m === viewMonth + 1) return true
    }
    if (t.recurrenceType && t.recurrenceType !== 'none' && t.recurrenceStart && t.recurrenceEnd) {
      const monthStart = new Date(viewYear, viewMonth, 1)
      const monthEnd   = new Date(viewYear, viewMonth + 1, 0)
      const recStart   = new Date(t.recurrenceStart + 'T00:00:00')
      const recEnd     = new Date(t.recurrenceEnd   + 'T00:00:00')
      if (recStart <= monthEnd && recEnd >= monthStart) return true
    }
    return false
  }).length

  const handleLogout = async () => { await logout(); navigate('/') }

  const rows = cells.length / 7

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
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>} label="Kanban" onClick={() => navigate('/kanban')} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} label="Calendar" active onClick={() => {}} />
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>} label="Statistics" onClick={() => navigate('/statistics')} />
          {isAdmin && <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} label="Admin Panel" onClick={() => navigate('/admin')} />}
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
        flex: 1, backgroundColor: '#8a9e6e', padding: '30px',
        position: 'relative', overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          position: 'fixed', bottom: 20, right: 30,
          fontSize: '8rem', fontWeight: 900, color: 'rgba(0,0,0,0.06)',
          letterSpacing: 8, pointerEvents: 'none', userSelect: 'none',
        }}>Planex</div>

        <div style={{ position: 'relative', zIndex: 1 }}>

          {/* Page title */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20 }}>
            <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: 0 }}>
              Calendar
            </h1>
            <span style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#333' }}>
              {monthTaskCount} task{monthTaskCount !== 1 ? 's' : ''} due in {MONTH_NAMES[viewMonth]}
            </span>
            {loading && <span style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#555' }}>Loading…</span>}
          </div>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={prevMonth} style={{
              width: 34, height: 34, borderRadius: '50%', border: '2px solid #2d3748',
              backgroundColor: 'transparent', cursor: 'pointer', fontSize: '1.1rem', color: '#111',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>‹</button>

            <span style={{
              fontFamily: FONT, fontSize: '1.15rem', fontWeight: 'bold', color: '#111',
              minWidth: 200, textAlign: 'center',
            }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button onClick={nextMonth} style={{
              width: 34, height: 34, borderRadius: '50%', border: '2px solid #2d3748',
              backgroundColor: 'transparent', cursor: 'pointer', fontSize: '1.1rem', color: '#111',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>›</button>

            <button onClick={goToday} style={{
              fontFamily: FONT, fontSize: '0.8rem', padding: '6px 18px', borderRadius: 20,
              border: '1px solid #2d3748', backgroundColor: 'transparent', cursor: 'pointer', color: '#111',
            }}>Today</button>

            <button onClick={exportToCSV} style={{
              fontFamily: FONT, fontSize: '0.8rem', padding: '6px 18px', borderRadius: 20,
              border: '1px solid #2d3748', backgroundColor: '#2d3748', cursor: 'pointer', color: '#e2e8f0',
              marginLeft: 'auto',
            }}>
              ↓ Export CSV
            </button>
          </div>

          {/* Grid */}
          <div style={{
            borderRadius: 16, overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.12)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          }}>
            {/* Day-of-week header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: '#2d3748' }}>
              {DAY_NAMES.map(d => (
                <div key={d} style={{
                  fontFamily: FONT, fontSize: '0.72rem', fontWeight: 'bold',
                  color: '#e2e8f0', textAlign: 'center', padding: '10px 0', letterSpacing: 1,
                }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((cell, i) => {
                const dayTasks   = tasksForDay(cell)
                const isSelected = cell.current && cell.day === selectedDay
                const isTodayCell = isToday(cell)
                const colIdx     = i % 7
                const rowIdx     = Math.floor(i / 7)
                const MAX_CHIPS  = 2

                return (
                  <div
                    key={i}
                    onClick={() => cell.current && setSelectedDay(cell.day === selectedDay ? null : cell.day)}
                    style={{
                      minHeight: 88,
                      padding: '6px 8px',
                      borderRight: colIdx < 6 ? '1px solid rgba(0,0,0,0.08)' : 'none',
                      borderBottom: rowIdx < rows - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none',
                      backgroundColor: isSelected
                        ? 'rgba(45,55,72,0.18)'
                        : isTodayCell
                        ? 'rgba(255,255,255,0.35)'
                        : cell.current
                        ? 'rgba(255,255,255,0.15)'
                        : 'rgba(0,0,0,0.04)',
                      cursor: cell.current ? 'pointer' : 'default',
                      transition: 'background-color 0.12s',
                      outline: isSelected ? '2px solid #2d3748' : 'none',
                      outlineOffset: '-2px',
                    }}
                    onMouseEnter={e => {
                      if (cell.current && !isSelected)
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.28)'
                    }}
                    onMouseLeave={e => {
                      if (cell.current && !isSelected)
                        e.currentTarget.style.backgroundColor = isTodayCell
                          ? 'rgba(255,255,255,0.35)'
                          : 'rgba(255,255,255,0.15)'
                    }}
                  >
                    {/* Day number */}
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isTodayCell ? '#2d3748' : 'transparent',
                      color: isTodayCell ? '#fff' : cell.current ? '#111' : '#bbb',
                      fontSize: '0.78rem', fontWeight: isTodayCell ? 'bold' : 'normal',
                      fontFamily: FONT, marginBottom: 4, flexShrink: 0,
                    }}>
                      {cell.day}
                    </div>

                    {/* Task chips */}
                    {dayTasks.slice(0, MAX_CHIPS).map(task => {
                      const pc          = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Low
                      const isRecurring = task.recurrenceType && task.recurrenceType !== 'none'
                      const soon        = isDueSoon(task)
                      const overdue     = isOverdue(task)
                      const chipBg      = overdue ? '#dc3545' : soon ? '#fd7e14' : pc.bg
                      const chipColor   = overdue || soon ? '#fff' : pc.color
                      return (
                        <div
                          key={task.id}
                          title={task.title}
                          onClick={e => { e.stopPropagation(); navigate(`/tasks/${task.id}`) }}
                          style={{
                            backgroundColor: chipBg, color: chipColor,
                            fontSize: '0.62rem', fontFamily: FONT, fontWeight: 'bold',
                            padding: '2px 6px', borderRadius: 4, marginBottom: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            textDecoration: task.isCompleted ? 'line-through' : 'none',
                            opacity: task.isCompleted ? 0.6 : 1,
                          }}
                          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.9)'}
                          onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                        >
                          {isRecurring && <span style={{ marginRight: 3 }}>↻</span>}
                          {task.title}
                        </div>
                      )
                    })}

                    {dayTasks.length > MAX_CHIPS && (
                      <div style={{
                        fontSize: '0.6rem', fontFamily: FONT,
                        color: '#444', paddingLeft: 2, marginTop: 1,
                      }}>
                        +{dayTasks.length - MAX_CHIPS} more
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected day panel */}
          {selectedDay !== null && (
            <div style={{
              marginTop: 20,
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: 16, padding: '20px 24px',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontFamily: FONT, fontSize: '1rem', fontWeight: 'bold', color: '#111', margin: 0 }}>
                  {MONTH_NAMES[viewMonth]} {selectedDay}, {viewYear}
                </h2>
                <span style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#444' }}>
                  {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
                </span>
              </div>

              {selectedTasks.length === 0 ? (
                <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#555', fontStyle: 'italic', margin: 0 }}>
                  No tasks due on this day.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {selectedTasks.map(task => {
                    const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Low
                    const isRecurring = task.recurrenceType && task.recurrenceType !== 'none'
                    return (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 12,
                          padding: '12px 16px', cursor: 'pointer', minWidth: 160, maxWidth: 240,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          display: 'flex', flexDirection: 'column', gap: 6,
                          transition: 'box-shadow 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                      >
                        <span style={{
                          fontFamily: FONT, fontSize: '0.85rem', fontWeight: 'bold', color: '#111',
                          textDecoration: task.isCompleted ? 'line-through' : 'none',
                          opacity: task.isCompleted ? 0.55 : 1,
                          lineHeight: 1.3,
                        }}>
                          {task.title}
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: FONT, fontSize: '0.62rem', fontWeight: 'bold',
                            padding: '2px 8px', borderRadius: 20,
                            backgroundColor: pc.bg, color: pc.color,
                          }}>
                            {task.priority}
                          </span>
                          {isRecurring && (
                            <span style={{
                              fontFamily: FONT, fontSize: '0.62rem', fontWeight: 'bold',
                              padding: '2px 8px', borderRadius: 20,
                              backgroundColor: '#e0e7ff', color: '#3730a3',
                            }}>↻ {task.recurrenceType}</span>
                          )}
                          {task.isCompleted && (
                            <span style={{
                              fontFamily: FONT, fontSize: '0.62rem', fontWeight: 'bold',
                              padding: '2px 8px', borderRadius: 20,
                              backgroundColor: '#d1e7dd', color: '#0a3622',
                            }}>Done</span>
                          )}
                          {task.collaborators?.length > 0 && (
                            <span style={{
                              fontFamily: FONT, fontSize: '0.62rem',
                              padding: '2px 8px', borderRadius: 20,
                              backgroundColor: 'rgba(0,0,0,0.08)', color: '#333',
                            }}>{task.collaborators.length} collab.</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
