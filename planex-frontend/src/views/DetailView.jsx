import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchTask, createTask, updateTask, deleteTask, searchUsers } from '../services/api'
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

function Sidebar({ navigate, user, onLogout }) {
  return (
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
        <SidebarItem icon="📊" label="Statistics"    onClick={() => navigate('/statistics')} />
      </div>
      <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', color: '#e2e8f0', fontSize: '0.9rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', fontFamily: FONT }}>
        ⇥ Logout
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
              <span
                onClick={() => onRemove(user.UserId)}
                style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', opacity: 0.7 }}
              >
                ×
              </span>
            </span>
          ))}
        </div>
      )}
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

  const [fields, setFields] = useState({
    title: '', description: '', dueDate: '', priority: 'Medium',
  })

  // Collaborators: array of { UserId, Name } objects for the autocomplete
  const [collaborators, setCollaborators] = useState([])

  const [errors, setErrors] = useState({})

  // Load task from API when viewing/editing
  useEffect(() => {
    if (isNew) return
    setLoading(true)
    fetchTask(id)
      .then(data => {
        setTask(data)
        setFields({
          title:         data.title,
          description:   data.description || '',
          dueDate:       data.dueDate,
          priority:      data.priority || 'Medium',
        })
        // Convert string collaborators to { UserId: null, Name } objects
        setCollaborators(
          (data.collaborators || []).map(name => ({ UserId: null, Name: name }))
        )
        saveLastViewedTask(data.id)
        setLoading(false)
      })
      .catch(() => { setLoading(false) })
  }, [id])

  const handleChange = (e) => {
    setFields(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setErrors(prev => ({ ...prev, [e.target.name]: undefined }))
  }

  const handleSubmit = async () => {
    const errs = validateTask(fields)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const payload = {
      ...fields,
      collaborators: collaborators.map(c => c.Name),
      createdBy: user?.UserId,
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
      const updated = await updateTask(task.id, { isCompleted: !task.isCompleted })
      setTask(updated)
    } catch (err) {
      setApiError(err.message)
    }
  }

  const isForm = mode === 'add' || mode === 'edit'
  const pageTitle = mode === 'add' ? 'New Task' : mode === 'edit' ? 'Edit Task' : (task ? task.title : '')
  const currentPriority = mode === 'view' ? (task?.priority || 'Low') : fields.priority
  const pColors = priorityColors[currentPriority] || priorityColors['Low']

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar navigate={navigate} user={user} onLogout={async () => { await logout(); navigate('/'); }} />
        <main style={{ flex: 1, backgroundColor: '#8a9e6e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontFamily: FONT, fontSize: '1.2rem', color: '#111' }}>Loading...</p>
        </main>
      </div>
    )
  }

  if (!isNew && !task) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar navigate={navigate} user={user} onLogout={async () => { await logout(); navigate('/'); }} />
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
      <Sidebar navigate={navigate} user={user} onLogout={async () => { await logout(); navigate('/'); }} />
      <main style={{ flex: 1, backgroundColor: '#8a9e6e', padding: '40px 50px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: '8rem', fontWeight: 900, color: 'rgba(0,0,0,0.08)', letterSpacing: 8, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>Planex</div>

        {apiError && (
          <div style={{ fontFamily: FONT, color: '#7c1d24', backgroundColor: '#f8d7da', padding: '10px 16px', borderRadius: 8, marginBottom: 16, position: 'relative', zIndex: 1 }}>
            ⚠ {apiError}
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
              <div>
                <input style={inputStyle} name="dueDate" placeholder="Due Date (YYYY-MM-DD)" value={fields.dueDate} onChange={handleChange} />
                {errors.dueDate && <p style={errorStyle}>{errors.dueDate}</p>}
              </div>
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
              <div onClick={handleToggle} title="Toggle completion" style={{ width: 30, height: 30, border: '3px solid #111', borderRadius: 4, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', backgroundColor: 'transparent' }}>
                {task.isCompleted ? '✓' : ''}
              </div>
              <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: 0, textDecorationLine: task.isCompleted ? 'line-through underline' : 'underline' }}>
                {task.title}
              </h1>
              <span style={{ fontFamily: FONT, fontSize: '0.8rem', fontWeight: 'bold', padding: '4px 12px', borderRadius: 20, backgroundColor: pColors.bg, color: pColors.color, border: `1px solid ${pColors.border}` }}>
                {currentPriority}
              </span>
            </div>
            <p style={{ fontFamily: FONT, fontSize: '1rem', color: '#333', marginBottom: 8 }}>Due Date — {task.dueDate}</p>
            {task.createdByName && (
              <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#555', marginBottom: 24, fontStyle: 'italic' }}>
                Created by: {task.createdByName}
              </p>
            )}
            <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, backgroundColor: '#f5f5d0', borderRadius: 18, padding: '20px 24px', minHeight: 300, fontFamily: FONT, fontSize: '0.95rem', color: '#222', lineHeight: 1.7, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                {task.description || <span style={{ color: '#888' }}>No description.</span>}
              </div>
              <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ backgroundColor: '#f5f5d0', borderRadius: 18, padding: '16px 20px', minHeight: 160 }}>
                  <p style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#555', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 10px 0' }}>Collaborators</p>
                  {task.collaborators && task.collaborators.length > 0 ? (
                    task.collaborators.map((c, i) => (
                      <p key={i} style={{ fontFamily: FONT, fontSize: '0.9rem', color: '#222', margin: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: 4 }}>{c}</p>
                    ))
                  ) : (
                    <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#888' }}>None</p>
                  )}
                </div>
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
