import React, { useState, useEffect } from 'react'

// Use the current hostname so it works from any device on the network
const BASE_URL = `http://${window.location.hostname}:3001/api`
const FONT = '"Courier New", Courier, monospace'

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export default function SubtaskPanel({ taskId }) {
  const [subtasks, setSubtasks]   = useState([])
  const [newTitle, setNewTitle]   = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!taskId) return
    setLoading(true)
    apiFetch(`/tasks/${taskId}/subtasks`)
      .then(data => { setSubtasks(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [taskId])

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    try {
      const created = await apiFetch(`/tasks/${taskId}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim() }),
      })
      setSubtasks(prev => [...prev, created])
      setNewTitle('')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggle = async (sub) => {
    try {
      const updated = await apiFetch(`/tasks/${taskId}/subtasks/${sub.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isCompleted: !sub.isCompleted }),
      })
      setSubtasks(prev => prev.map(s => s.id === sub.id ? updated : s))
    } catch {}
  }

  const handleDelete = async (id) => {
    try {
      await apiFetch(`/tasks/${taskId}/subtasks/${id}`, { method: 'DELETE' })
      setSubtasks(prev => prev.filter(s => s.id !== id))
    } catch {}
  }

  const completed = subtasks.filter(s => s.isCompleted).length
  const total     = subtasks.length

  return (
    <div style={{ backgroundColor: '#f5f5d0', borderRadius: 18, padding: '20px 24px', marginTop: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold', color: '#555', letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>
          Subtasks
        </p>
        {total > 0 && (
          <span style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#555' }}>
            {completed}/{total} done
          </span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(completed / total) * 100}%`, backgroundColor: '#3a4558', borderRadius: 3, transition: 'width 0.3s ease' }} />
        </div>
      )}

      {error && <p style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#7c1d24', marginBottom: 8 }}>{error}</p>}

      {/* List */}
      {loading ? (
        <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#888' }}>Loading subtasks...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {subtasks.map(sub => (
            <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                onClick={() => handleToggle(sub)}
                style={{ width: 18, height: 18, border: '2px solid #555', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0, backgroundColor: sub.isCompleted ? '#3a4558' : 'transparent', color: '#fff', transition: 'background-color 0.2s' }}
              >
                {sub.isCompleted ? '✓' : ''}
              </div>
              <span style={{ fontFamily: FONT, fontSize: '0.88rem', color: '#222', flex: 1, textDecoration: sub.isCompleted ? 'line-through' : 'none', opacity: sub.isCompleted ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                {sub.title}
              </span>
              <span onClick={() => handleDelete(sub.id)} style={{ cursor: 'pointer', color: '#aaa', fontSize: '0.75rem' }}>✕</span>
            </div>
          ))}
        </div>
      )}

      {/* Add new subtask */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          type="text"
          placeholder="Add a subtask..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ flex: 1, padding: '8px 14px', borderRadius: 20, border: '1px solid rgba(0,0,0,0.15)', backgroundColor: 'rgba(255,255,255,0.6)', fontFamily: FONT, fontSize: '0.85rem', outline: 'none' }}
        />
        <button
          onClick={handleAdd}
          style={{ padding: '8px 16px', borderRadius: 20, border: 'none', backgroundColor: '#3a4558', color: '#ddd', fontFamily: FONT, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          Add
        </button>
      </div>
    </div>
  )
}