import React, { useState, useEffect } from 'react'
import { fetchSubtasks, createSubtask, updateSubtask, deleteSubtask, suggestAiSubtasks } from '../services/api'

const FONT = '"Courier New", Courier, monospace'

export default function SubtaskPanel({ taskId }) {
  const [subtasks, setSubtasks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // AI state
  const [suggestions,  setSuggestions]  = useState(null)  // null = hidden, [] = empty, [...] = visible
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiError,      setAiError]      = useState('')
  const [addingAll,    setAddingAll]    = useState(false)

  useEffect(() => {
    if (!taskId) return
    setLoading(true)
    fetchSubtasks(taskId)
      .then(data => { setSubtasks(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [taskId])

  // Live updates from other users
  useEffect(() => {
    if (!taskId) return
    const onCreated = (e) => {
      if (e.detail.taskId !== taskId) return
      setSubtasks(prev => prev.some(s => s.id === e.detail.subtask.id) ? prev : [...prev, e.detail.subtask])
    }
    const onUpdated = (e) => {
      if (e.detail.taskId !== taskId) return
      setSubtasks(prev => prev.map(s => s.id === e.detail.subtask.id ? e.detail.subtask : s))
    }
    const onDeleted = (e) => {
      if (e.detail.taskId !== taskId) return
      setSubtasks(prev => prev.filter(s => s.id !== e.detail.id))
    }
    window.addEventListener('subtask:created', onCreated)
    window.addEventListener('subtask:updated', onUpdated)
    window.addEventListener('subtask:deleted', onDeleted)
    return () => {
      window.removeEventListener('subtask:created', onCreated)
      window.removeEventListener('subtask:updated', onUpdated)
      window.removeEventListener('subtask:deleted', onDeleted)
    }
  }, [taskId])

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    try {
      const created = await createSubtask(taskId, newTitle.trim())
      setSubtasks(prev => prev.some(s => s.id === created.id) ? prev : [...prev, created])
      setNewTitle('')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggle = async (sub) => {
    try {
      const updated = await updateSubtask(taskId, sub.id, { isCompleted: !sub.isCompleted })
      setSubtasks(prev => prev.map(s => s.id === sub.id ? updated : s))
    } catch {}
  }

  const handleDelete = async (id) => {
    try {
      await deleteSubtask(taskId, id)
      setSubtasks(prev => prev.filter(s => s.id !== id))
    } catch {}
  }

  // ── AI handlers ───────────────────────────────────────────
  const handleAiSuggest = async () => {
    setAiLoading(true)
    setAiError('')
    setSuggestions(null)
    try {
      const data = await suggestAiSubtasks(taskId)
      setSuggestions(data.suggestions || [])
    } catch (err) {
      setAiError(err.message || 'AI suggestion failed. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleAddSuggestion = async (title) => {
    try {
      const created = await createSubtask(taskId, title)
      setSubtasks(prev => prev.some(s => s.id === created.id) ? prev : [...prev, created])
      setSuggestions(prev => prev.filter(s => s !== title))
    } catch (err) {
      setAiError(err.message)
    }
  }

  const handleAddAll = async () => {
    if (!suggestions?.length) return
    setAddingAll(true)
    for (const title of suggestions) {
      try {
        const created = await createSubtask(taskId, title)
        setSubtasks(prev => prev.some(s => s.id === created.id) ? prev : [...prev, created])
      } catch {}
    }
    setSuggestions(null)
    setAddingAll(false)
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

      {/* Subtask list */}
      {loading ? (
        <p style={{ fontFamily: FONT, fontSize: '0.85rem', color: '#888' }}>Loading subtasks...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {subtasks.map(sub => (
            <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => handleToggle(sub)}
                aria-label={sub.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                style={{ width: 18, height: 18, border: '2px solid #555', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: sub.isCompleted ? '#3a4558' : 'transparent', padding: 0, transition: 'background-color 0.2s' }}
              >
                {sub.isCompleted && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </button>
              <span style={{ fontFamily: FONT, fontSize: '0.88rem', color: '#222', flex: 1, textDecoration: sub.isCompleted ? 'line-through' : 'none', opacity: sub.isCompleted ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                {sub.title}
              </span>
              <button onClick={() => handleDelete(sub.id)} aria-label={`Delete subtask: ${sub.title}`} style={{ cursor: 'pointer', color: '#aaa', background: 'none', border: 'none', padding: '2px', display: 'flex', alignItems: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Manual add */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          type="text"
          placeholder="Add a subtask..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ flex: 1, padding: '8px 14px', borderRadius: 20, border: '1px solid rgba(0,0,0,0.15)', backgroundColor: 'rgba(255,255,255,0.6)', fontFamily: FONT, fontSize: '0.85rem', outline: 'none' }}
        />
        <button onClick={handleAdd} style={{ padding: '8px 16px', borderRadius: 20, border: 'none', backgroundColor: '#3a4558', color: '#ddd', fontFamily: FONT, fontSize: '0.85rem', cursor: 'pointer' }}>
          Add
        </button>
      </div>

      {/* AI suggest button */}
      <button
        onClick={handleAiSuggest}
        disabled={aiLoading}
        style={{
          marginTop: 8, width: '100%', padding: '8px 0', borderRadius: 20,
          border: '1px dashed rgba(0,0,0,0.25)',
          backgroundColor: aiLoading ? 'rgba(0,0,0,0.05)' : 'transparent',
          color: '#555', fontFamily: FONT, fontSize: '0.82rem',
          cursor: aiLoading ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={e => { if (!aiLoading) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.07)' }}
        onMouseLeave={e => { if (!aiLoading) e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        {aiLoading ? 'Thinking...' : 'AI Suggest subtasks'}
      </button>

      {/* AI error */}
      {aiError && (
        <p style={{ fontFamily: FONT, fontSize: '0.78rem', color: '#7c1d24', marginTop: 6, marginBottom: 0 }}>
          {aiError}
        </p>
      )}

      {/* AI suggestions panel */}
      {suggestions && suggestions.length > 0 && (
        <div style={{
          marginTop: 10, borderRadius: 12, overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.12)',
          backgroundColor: 'rgba(255,255,255,0.55)',
        }}>
          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', backgroundColor: '#3a4558',
          }}>
            <span style={{ fontFamily: FONT, fontSize: '0.7rem', fontWeight: 'bold', color: '#e2e8f0', letterSpacing: 1, textTransform: 'uppercase' }}>
              AI Suggestions
            </span>
            <button
              onClick={() => setSuggestions(null)}
              aria-label="Dismiss AI suggestions"
              style={{ color: '#e2e8f0', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', opacity: 0.7 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Suggestion rows */}
          <div style={{ padding: '6px 0' }}>
            {suggestions.map((title, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px',
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
              }}>
                <span style={{ fontFamily: FONT, fontSize: '0.83rem', color: '#222', flex: 1, lineHeight: 1.3 }}>
                  {title}
                </span>
                <button
                  onClick={() => handleAddSuggestion(title)}
                  style={{
                    padding: '3px 12px', borderRadius: 20, border: 'none',
                    backgroundColor: '#3a4558', color: '#ddd',
                    fontFamily: FONT, fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>

          {/* Add all */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <button
              onClick={handleAddAll}
              disabled={addingAll}
              style={{
                width: '100%', padding: '7px 0', borderRadius: 20, border: 'none',
                backgroundColor: addingAll ? '#888' : '#3a4558',
                color: '#ddd', fontFamily: FONT, fontSize: '0.82rem',
                cursor: addingAll ? 'not-allowed' : 'pointer',
              }}
            >
              {addingAll ? 'Adding...' : `Add all ${suggestions.length}`}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
