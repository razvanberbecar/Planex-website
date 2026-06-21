import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchTask, createTask, updateTask, deleteTask, searchUsers, searchTasks, addTaskDependency, removeTaskDependency, fetchTaskActivity, toggleTask } from '../services/api'
import { validateTask } from '../utils/validation'
import { saveLastViewedTask } from '../utils/cookies'
import SubtaskPanel from '../components/SubtaskPanel'
import { useAuth } from '../context/AuthContext'

const FONT = '"Courier New", Courier, monospace'

const priorityColors = {
  High:   { bg: '#f8d7da', color: '#7c1d24', border: '#f5c2c7' },
  Medium: { bg: '#fff3cd', color: '#664d03', border: '#ffecb5' },
  Low:    { bg: '#d1e7dd', color: '#0a3622', border: '#badbcc' },
}

function SidebarItem({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', color: '#e2e8f0', fontSize: '0.9rem', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', backgroundColor: 'transparent', fontFamily: FONT, transition: 'background-color 0.2s' }}>
      <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function Sidebar({ navigate, user, isAdmin, onLogout }) {
  return (
    <aside style={{ width: 210, minWidth: 210, backgroundColor: '#2d3748', color: '#e2e8f0', display: 'flex', flexDirection: 'column', padding: '20px 0', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={() => navigate('/profile')} aria-label="View profile" style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#4a5568', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0, border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>
          {user?.Name ? user.Name.charAt(0).toUpperCase() : '?'}
        </button>
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{user?.Name || 'Unknown'}</span>
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
        <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} label="Calendar" onClick={() => navigate('/calendar')} />
        <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>} label="Statistics" onClick={() => navigate('/statistics')} />
        {isAdmin && (
          <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} label="Admin Panel" onClick={() => navigate('/admin')} />
        )}
        <SidebarItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} label="Profile" onClick={() => navigate('/profile')} />
      </div>
      <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', color: '#e2e8f0', fontSize: '0.9rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', fontFamily: FONT }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Logout
      </button>
    </aside>
  )
}

const inputStyle = { width: '100%', padding: '14px 18px', borderRadius: 30, border: 'none', backgroundColor: '#f5f5d0', fontFamily: FONT, fontSize: '0.95rem', color: '#222', boxSizing: 'border-box', outline: 'none' }
const errorStyle = { color: '#8b0000', fontSize: '0.8rem', marginTop: 4, marginLeft: 18, fontFamily: FONT }
const actionBtnStyle = { padding: '14px 0', width: '100%', borderRadius: 30, border: 'none', backgroundColor: '#3a4558', color: '#ddd', fontFamily: FONT, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', letterSpacing: 1 }

// ── User search autocomplete dropdown ────────────────────
function CollaboratorInput({ selected, onAdd, onRemove }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)
  const timerRef = useRef(null)

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.length < 1) { setResults([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const users = await searchUsers(query)
        // Exclude already-selected users
        setResults(users.filter(u => !selected.find(s => s.UserId === u.UserId)))
        setOpen(true)
      } catch { setResults([]) }
      setLoading(false)
    }, 250)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, selected])

  // Click outside to close dropdown
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectUser = (user) => {
    onAdd(user)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        placeholder="Search collaborators by name..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
      />
      {loading && <span style={{ position: 'absolute', right: 16, top: 14, fontSize: '0.75rem', color: '#888' }}>...</span>}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: 12,
          marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {results.map(user => (
            <div
              key={user.UserId}
              onClick={() => selectUser(user)}
              style={{
                padding: '10px 16px', cursor: 'pointer', fontFamily: FONT, fontSize: '0.85rem',
                color: '#111', borderBottom: '1px solid #eee', transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <strong>{user.Name}</strong>
              <span style={{ color: '#888', marginLeft: 8, fontSize: '0.75rem' }}>{user.Email}</span>
            </div>
          ))}
        </div>
      )}
      {/* Selected collaborators as chips */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {selected.map(user => (
            <span key={user.UserId} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              backgroundColor: '#3a4558', color: '#ddd', padding: '4px 12px',
              borderRadius: 20, fontSize: '0.8rem', fontFamily: FONT,
            }}>
              {user.Name}
              <button
                onClick={() => onRemove(user.UserId)}
                aria-label={`Remove ${user.Name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', opacity: 0.7, padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function LockIcon({ size = 13, color = '#7c1d24' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function CheckIcon({ size = 13, color = '#0a3622' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

// ── Dependency panel (view mode) ─────────────────────────
function DependencyPanel({ taskId, blockedBy, onAdd, onRemove, navigate }) {
  const [adding, setAdding] = useState(false)
  const STATUS_COLORS = { done: '#d1e7dd', in_progress: '#fff3cd', todo: '#e9e9e9' }
  const STATUS_LABELS = { done: 'Done', in_progress: 'In Progress', todo: 'To Do' }

  return (
    <div style={{ backgroundColor: '#f5f5d0', borderRadius: 18, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#555', letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Blocked by</p>
        <button
          onClick={() => setAdding(a => !a)}
          style={{ fontFamily: FONT, fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, border: '1px solid #3a4558', backgroundColor: adding ? '#3a4558' : 'transparent', color: adding ? '#ddd' : '#3a4558', cursor: 'pointer' }}
        >
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {blockedBy.length === 0 && !adding && (
        <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#888', margin: 0 }}>None</p>
      )}

      {blockedBy.map(b => (
        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <span style={{ cursor: 'pointer', display: 'flex' }} onClick={() => navigate(`/tasks/${b.id}`)}>
            {b.isCompleted ? <CheckIcon /> : <LockIcon />}
          </span>
          <span onClick={() => navigate(`/tasks/${b.id}`)} style={{ fontFamily: FONT, fontSize: '0.85rem', color: b.isCompleted ? '#0a3622' : '#7c1d24', textDecoration: 'underline', flex: 1, cursor: 'pointer' }}>{b.title}</span>
          <span style={{ fontFamily: FONT, fontSize: '0.7rem', color: '#555', backgroundColor: STATUS_COLORS[b.status] || '#e9e9e9', padding: '2px 6px', borderRadius: 10 }}>
            {STATUS_LABELS[b.status] || b.status}
          </span>
          <button onClick={() => onRemove(b.id)} aria-label="Remove dependency" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 2, display: 'flex', alignItems: 'center', marginLeft: 2 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}

      {adding && (
        <div style={{ marginTop: 8 }}>
          <TaskDependencyInput
            excludeId={taskId}
            selected={blockedBy}
            onAdd={(t) => { onAdd(t); setAdding(false) }}
            onRemove={onRemove}
          />
        </div>
      )}
    </div>
  )
}

// ── Task search autocomplete for dependency picker ────────
function TaskDependencyInput({ excludeId, selected, onAdd, onRemove }) {
  const [query, setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(false)
  const ref     = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.length < 1) { setResults([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const tasks = await searchTasks(query, excludeId)
        setResults(tasks.filter(t => !selected.some(s => s.id === t.id)))
        setOpen(true)
      } catch { setResults([]) }
      setLoading(false)
    }, 250)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, selected, excludeId])

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        placeholder="Search tasks to block this one..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
      />
      {loading && <span style={{ position: 'absolute', right: 16, top: 14, fontSize: '0.75rem', color: '#888' }}>...</span>}
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: 12, marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {results.map(t => (
            <div
              key={t.id}
              onClick={() => { onAdd(t); setQuery(''); setResults([]); setOpen(false) }}
              style={{ padding: '10px 16px', cursor: 'pointer', fontFamily: FONT, fontSize: '0.85rem', color: '#111', borderBottom: '1px solid #eee', transition: 'background-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <strong>{t.title}</strong>
              <span style={{ color: '#888', marginLeft: 8, fontSize: '0.75rem' }}>{STATUS_LABELS[t.status] || t.status}</span>
            </div>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {selected.map(t => (
            <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: t.isCompleted ? '#d1e7dd' : '#f8d7da', color: t.isCompleted ? '#0a3622' : '#7c1d24', padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontFamily: FONT }}>
              {!t.isCompleted && <LockIcon size={11} color="#7c1d24" />}{t.title}
              <button onClick={() => onRemove(t.id)} aria-label={`Remove dependency: ${t.title}`} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7, padding: 0, display: 'flex', alignItems: 'center', color: 'inherit' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Activity timeline helpers ─────────────────────────────
const STATUS_LABELS_ACTIVITY = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }

function formatActivity(entry) {
  const d = entry.details || {}
  switch (entry.action) {
    case 'CREATE_TASK':      return 'created this task'
    case 'UPDATE_TASK':
      if (d.change === 'status') return `moved to ${STATUS_LABELS_ACTIVITY[d.to] || d.to}`
      if (d.change === 'completed') return d.isCompleted ? 'marked as completed' : 'reopened the task'
      return 'updated the task'
    case 'TOGGLE_TASK':      return d.isCompleted ? 'marked as completed' : 'reopened the task'
    case 'DELETE_TASK':      return 'deleted this task'
    case 'CREATE_SUBTASK':   return `added subtask "${d.title || ''}"`
    case 'UPDATE_SUBTASK':
      if (d.isCompleted === true)  return `completed subtask "${d.title || ''}"`
      if (d.isCompleted === false) return `reopened subtask "${d.title || ''}"`
      return 'updated a subtask'
    case 'DELETE_SUBTASK':   return `removed subtask "${d.title || ''}"`
    case 'ADD_DEPENDENCY':   return `added blocker: "${d.blockerTitle || `#${d.blockedById}`}"`
    case 'REMOVE_DEPENDENCY':return `removed blocker: "${d.blockerTitle || `#${d.blockerId}`}"`
    default: return entry.action.toLowerCase().replace(/_/g, ' ')
  }
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60)  return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function ActivityTimeline({ activity, loading }) {
  if (loading) return <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#555' }}>Loading activity...</p>
  if (!activity.length) return <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#888' }}>No activity recorded yet.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {activity.map((entry, i) => (
        <div key={entry.logId || i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderBottom: i < activity.length - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#3a4558', color: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
            {(entry.userName || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#222' }}>
              <strong>{entry.userName || 'Unknown'}</strong> {formatActivity(entry)}
            </span>
            <span style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#888', marginLeft: 8 }}>{timeAgo(entry.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DetailView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin, logout } = useAuth()

  const isNew = id === 'new'

  const [task, setTask]     = useState(null)
  const [loading, setLoading] = useState(!isNew)
  const [mode, setMode]     = useState(isNew ? 'add' : 'view')
  const [apiError, setApiError] = useState('')
  const [recurringMsg, setRecurringMsg] = useState('')

  const [fields, setFields] = useState({
    title: '', description: '', dueDate: '', priority: 'Medium',
    recurrenceType: 'none', recurrenceStart: '', recurrenceEnd: '',
  })

  // Collaborators: array of { UserId, Name } objects for the autocomplete
  const [collaborators, setCollaborators] = useState([])

  const [errors, setErrors] = useState({})

  const [blockedBy, setBlockedBy]           = useState([])
  const [activity, setActivity]             = useState([])
  const [activityLoading, setActivityLoading] = useState(false)

  // Load task from API when viewing/editing
  useEffect(() => {
    if (isNew) return
    setLoading(true)
    fetchTask(id)
      .then(data => {
        setTask(data)
        setFields({
          title:           data.title,
          description:     data.description || '',
          dueDate:         data.dueDate,
          priority:        data.priority || 'Medium',
          recurrenceType:  data.recurrenceType || 'none',
          recurrenceStart: data.recurrenceStart || '',
          recurrenceEnd:   data.recurrenceEnd || '',
        })
        // Convert string collaborators to { UserId: null, Name } objects
        setCollaborators(
          (data.collaborators || []).map(name => ({ UserId: null, Name: name }))
        )
        setBlockedBy(data.blockedBy || [])
        saveLastViewedTask(data.id)
        setLoading(false)
        // Fetch activity log
        setActivityLoading(true)
        fetchTaskActivity(id)
          .then(logs => setActivity(logs || []))
          .catch(() => setActivity([]))
          .finally(() => setActivityLoading(false))
      })
      .catch(() => { setLoading(false) })
  }, [id])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFields(prev => {
      const next = { ...prev, [name]: value }
      // Keep dueDate in sync with recurrenceStart when recurring
      if (name === 'recurrenceStart' && prev.recurrenceType !== 'none') {
        next.dueDate = value
      }
      // When switching to a recurrence type, copy recurrenceStart → dueDate
      if (name === 'recurrenceType' && value !== 'none' && prev.recurrenceStart) {
        next.dueDate = prev.recurrenceStart
      }
      // When clearing recurrence, leave dueDate as-is so user can set it manually
      return next
    })
    setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async () => {
    const errs = validateTask(fields)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const payload = {
      ...fields,
      collaborators:   collaborators.map(c => c.Name),
      createdBy:       user?.UserId,
      recurrenceType:  fields.recurrenceType || 'none',
      recurrenceStart: fields.recurrenceType !== 'none' ? fields.recurrenceStart : null,
      recurrenceEnd:   fields.recurrenceType !== 'none' ? fields.recurrenceEnd : null,
    }

    try {
      if (mode === 'add') {
        await createTask(payload)
        navigate('/tasks')
      } else {
        const updated = await updateTask(task.id, payload)
        setTask(updated)
        setMode('view')
      }
    } catch (err) {
      setApiError(err.message)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteTask(task.id)
      navigate('/tasks')
    } catch (err) {
      setApiError(err.message)
    }
  }

  const handleToggle = async () => {
    try {
      const updated = await toggleTask(task.id)
      setTask(updated)
      if (updated.recurringAdvanced) {
        const nextDate = updated.dueDate
          ? new Date(updated.dueDate).toLocaleDateString()
          : 'the next occurrence'
        setRecurringMsg(`Done! Next occurrence set for ${nextDate}.`)
        setTimeout(() => setRecurringMsg(''), 4000)
      }
    } catch (err) {
      setApiError(err.message)
    }
  }

  const handleAddDep = async (blocker) => {
    if (blockedBy.some(b => b.id === blocker.id)) return
    try {
      await addTaskDependency(task.id, blocker.id)
      setBlockedBy(prev => [...prev, blocker])
    } catch (err) {
      setApiError(err.message)
    }
  }

  const handleRemoveDep = async (blockerId) => {
    try {
      await removeTaskDependency(task.id, blockerId)
      setBlockedBy(prev => prev.filter(b => b.id !== blockerId))
    } catch (err) {
      setApiError(err.message)
    }
  }

  const isForm = mode === 'add' || mode === 'edit'
  const pageTitle = mode === 'add' ? 'New Task' : mode === 'edit' ? 'Edit Task' : (task ? task.title : '')
  const taskOverdue = mode === 'view' && task && !task.isCompleted && task.dueDate && new Date(task.dueDate + 'T23:59:59') < new Date()
  const currentPriority = taskOverdue ? 'High' : (mode === 'view' ? (task?.priority || 'Low') : fields.priority)
  const pColors = priorityColors[currentPriority] || priorityColors['Low']

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar navigate={navigate} user={user} isAdmin={isAdmin} onLogout={async () => { await logout(); navigate('/'); }} />
        <main style={{ flex: 1, backgroundColor: '#8a9e6e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #ccc', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} aria-label="Loading" />
        </main>
      </div>
    )
  }

  if (!isNew && !task) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar navigate={navigate} user={user} isAdmin={isAdmin} onLogout={async () => { await logout(); navigate('/'); }} />
        <main style={{ flex: 1, backgroundColor: '#8a9e6e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontFamily: FONT, fontSize: '1.2rem', color: '#111' }}>
            Task not found. <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/tasks')}>Go back</span>
          </p>
        </main>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FONT }}>
      <Sidebar navigate={navigate} user={user} isAdmin={isAdmin} onLogout={async () => { await logout(); navigate('/'); }} />
      <main style={{ flex: 1, backgroundColor: '#8a9e6e', padding: '40px 50px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: '8rem', fontWeight: 900, color: 'rgba(0,0,0,0.08)', letterSpacing: 8, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>Planex</div>

        {recurringMsg && (
          <div style={{ fontFamily: FONT, color: '#0a3622', backgroundColor: '#d1e7dd', padding: '10px 16px', borderRadius: 8, marginBottom: 16, position: 'relative', zIndex: 1 }}>
            🔁 {recurringMsg}
          </div>
        )}

        {apiError && (
          <div style={{ fontFamily: FONT, color: '#7c1d24', backgroundColor: '#f8d7da', padding: '10px 16px', borderRadius: 8, marginBottom: 16, position: 'relative', zIndex: 1 }}>
            {apiError}
          </div>
        )}

        {/* FORM */}
        {isForm && (
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 860 }}>
            <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: '0 0 30px 0' }}>{pageTitle}</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <input style={inputStyle} name="title" placeholder="Name" value={fields.title} onChange={handleChange} />
                {errors.title && <p style={errorStyle}>{errors.title}</p>}
              </div>
              <div>
                <textarea style={{ ...inputStyle, borderRadius: 18, resize: 'vertical', minHeight: 160 }} name="description" placeholder="Description" value={fields.description} onChange={handleChange} />
              </div>
              {fields.recurrenceType === 'none' && (
                <div>
                  <input style={inputStyle} name="dueDate" placeholder="Due Date (YYYY-MM-DD)" value={fields.dueDate} onChange={handleChange} />
                  {errors.dueDate && <p style={errorStyle}>{errors.dueDate}</p>}
                </div>
              )}
              <div>
                <CollaboratorInput
                  selected={collaborators}
                  onAdd={(user) => setCollaborators(prev => [...prev, { UserId: user.UserId, Name: user.Name }])}
                  onRemove={(userId) => setCollaborators(prev => prev.filter(c => c.UserId !== userId))}
                />
              </div>
              <div>
                <select name="priority" value={fields.priority} onChange={handleChange} style={{ ...inputStyle, borderRadius: 30, cursor: 'pointer' }}>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>

              {/* ── Recurrence ── */}
              <div>
                <select name="recurrenceType" value={fields.recurrenceType} onChange={handleChange} style={{ ...inputStyle, borderRadius: 30, cursor: 'pointer' }}>
                  <option value="none">No Recurrence</option>
                  <option value="daily">Repeats Daily</option>
                  <option value="weekly">Repeats Weekly</option>
                  <option value="monthly">Repeats Monthly</option>
                </select>
              </div>
              {fields.recurrenceType !== 'none' && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <input
                      style={inputStyle}
                      name="recurrenceStart"
                      placeholder="Start Date (YYYY-MM-DD)"
                      value={fields.recurrenceStart}
                      onChange={handleChange}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      style={inputStyle}
                      name="recurrenceEnd"
                      placeholder="End Date (YYYY-MM-DD)"
                      value={fields.recurrenceEnd}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button style={{ ...actionBtnStyle, width: 280 }} onClick={handleSubmit}>
                {mode === 'add' ? 'Add Task' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* VIEW */}
        {mode === 'view' && task && (
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <button onClick={handleToggle} aria-label={task.isCompleted ? 'Mark incomplete' : 'Mark complete'} style={{ width: 30, height: 30, border: '3px solid #111', borderRadius: 4, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', padding: 0 }}>
                {task.isCompleted && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
              <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: 0, textDecorationLine: task.isCompleted ? 'line-through underline' : 'underline' }}>
                {task.title}
              </h1>
              <span style={{ fontFamily: FONT, fontSize: '0.8rem', fontWeight: 'bold', padding: '4px 12px', borderRadius: 20, backgroundColor: pColors.bg, color: pColors.color, border: `1px solid ${pColors.border}` }}>
                {currentPriority}{taskOverdue && task?.priority !== 'High' ? ' ↑' : ''}
              </span>
            </div>
            <p style={{ fontFamily: FONT, fontSize: '1rem', color: '#333', marginBottom: 8 }}>Due Date — {task.dueDate}</p>
            {task.recurrenceType && task.recurrenceType !== 'none' && (
              <p style={{ fontFamily: FONT, fontSize: '0.9rem', color: '#333', marginBottom: 8 }}>
                ↻ Repeats{' '}
                <strong>{task.recurrenceType}</strong>
                {task.recurrenceStart && task.recurrenceEnd && (
                  <> from <strong>{task.recurrenceStart}</strong> to <strong>{task.recurrenceEnd}</strong></>
                )}
              </p>
            )}
            {task.createdByName && (
              <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#555', marginBottom: 24, fontStyle: 'italic' }}>
                Created by: {task.createdByName}
              </p>
            )}
            {/* Blocked warning banner */}
            {blockedBy.some(b => !b.isCompleted) && (
              <div style={{ fontFamily: FONT, fontSize: '0.9rem', backgroundColor: '#f8d7da', color: '#7c1d24', padding: '10px 18px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <LockIcon size={15} color="#7c1d24" />
                This task is blocked and cannot be completed until all dependencies are done.
              </div>
            )}

            <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ backgroundColor: '#f5f5d0', borderRadius: 18, padding: '20px 24px', minHeight: 300, fontFamily: FONT, fontSize: '0.95rem', color: '#222', lineHeight: 1.7, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                  {task.description || <span style={{ color: '#888' }}>No description.</span>}
                </div>

                {/* Activity timeline */}
                <div style={{ marginTop: 24, backgroundColor: '#f5f5d0', borderRadius: 18, padding: '20px 24px' }}>
                  <p style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#555', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 14px 0' }}>Activity</p>
                  <ActivityTimeline activity={activity} loading={activityLoading} />
                </div>
              </div>

              <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ backgroundColor: '#f5f5d0', borderRadius: 18, padding: '16px 20px', minHeight: 80 }}>
                  <p style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#555', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 10px 0' }}>Collaborators</p>
                  {task.collaborators && task.collaborators.length > 0 ? (
                    task.collaborators.map((c, i) => (
                      <p key={i} style={{ fontFamily: FONT, fontSize: '0.9rem', color: '#222', margin: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: 4 }}>{c}</p>
                    ))
                  ) : (
                    <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#888' }}>None</p>
                  )}
                </div>

                {/* Blocked by panel — always visible with inline add */}
                <DependencyPanel taskId={task.id} blockedBy={blockedBy} onAdd={handleAddDep} onRemove={handleRemoveDep} navigate={navigate} />

                <SubtaskPanel taskId={task.id} />
                {/* Only task creator or admin can delete */}
                {(isAdmin || Number(task.createdBy) === Number(user?.UserId)) && (
                  <button style={actionBtnStyle} onClick={handleDelete}>Remove Task</button>
                )}
                <button style={actionBtnStyle} onClick={() => setMode('edit')}>Edit Task</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
