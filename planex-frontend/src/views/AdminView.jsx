import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  fetchSuspiciousActivities,
  fetchObservationList,
  reviewSuspiciousActivity,
  clearObservation,
  restrictUser,
  unrestrictUser,
} from '../services/api'

const FONT = '"Courier New", Courier, monospace'

const SEVERITY_COLORS = {
  CRITICAL: { bg: '#f8d7da', color: '#7c1d24', border: '#f5c2c7' },
  HIGH:     { bg: '#fce4d6', color: '#8a4b0a', border: '#f5cba0' },
  MEDIUM:   { bg: '#fff3cd', color: '#664d03', border: '#ffecb5' },
  LOW:      { bg: '#d1e7dd', color: '#0a3622', border: '#badbcc' },
}

const STATUS_COLORS = {
  UNDER_OBSERVATION: { bg: '#fff3cd', color: '#664d03', border: '#ffecb5' },
  CLEARED:           { bg: '#d1e7dd', color: '#0a3622', border: '#badbcc' },
  RESTRICTED:        { bg: '#f8d7da', color: '#7c1d24', border: '#f5c2c7' },
}

function Badge({ label, colorMap }) {
  const c = colorMap[label] || colorMap['LOW'] || { bg: '#eee', color: '#333', border: '#ccc' }
  return (
    <span style={{
      fontFamily: FONT, fontSize: '0.7rem', fontWeight: 'bold', padding: '3px 10px',
      borderRadius: 20, backgroundColor: c.bg, color: c.color,
      border: `1px solid ${c.border}`, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
      color: '#e2e8f0', fontSize: '0.9rem', border: 'none', cursor: 'pointer',
      textAlign: 'left', width: '100%',
      backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
      fontFamily: FONT, transition: 'background-color 0.2s',
    }}>
      <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function SeverityBadge({ severity }) {
  return <Badge label={severity} colorMap={SEVERITY_COLORS} />
}

function StatusBadge({ status }) {
  return <Badge label={status} colorMap={STATUS_COLORS} />
}

export default function AdminView() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tab, setTab] = useState('suspicious') // 'suspicious' | 'observation'

  // Suspicious activities
  const [activities, setActivities] = useState([])
  const [actLoading, setActLoading] = useState(false)
  const [actError, setActError] = useState('')
  const [showUnreviewedOnly, setShowUnreviewedOnly] = useState(false)

  // Observation list
  const [observations, setObservations] = useState([])
  const [obsLoading, setObsLoading] = useState(false)
  const [obsError, setObsError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Action feedback
  const [actionMsg, setActionMsg] = useState('')
  const [noteText, setNoteText] = useState('')

  const loadActivities = useCallback(async () => {
    if (!user) return
    setActLoading(true)
    setActError('')
    try {
      const data = await fetchSuspiciousActivities({
        unreviewedOnly: showUnreviewedOnly || undefined,
      })
      setActivities(data)
    } catch (err) {
      setActError(err.message)
    } finally {
      setActLoading(false)
    }
  }, [user, showUnreviewedOnly])

  const loadObservations = useCallback(async () => {
    if (!user) return
    setObsLoading(true)
    setObsError('')
    try {
      const data = await fetchObservationList({
        status: statusFilter || undefined,
      })
      setObservations(data)
    } catch (err) {
      setObsError(err.message)
    } finally {
      setObsLoading(false)
    }
  }, [user, statusFilter])

  useEffect(() => { loadActivities() }, [loadActivities])
  useEffect(() => { loadObservations() }, [loadObservations])

  const handleReview = async (id) => {
    try {
      await reviewSuspiciousActivity(id)
      setActionMsg('Activity marked as reviewed.')
      loadActivities()
    } catch (err) {
      setActError(err.message)
    }
  }

  const handleClear = async (id) => {
    try {
      await clearObservation(id, noteText)
      setActionMsg('User cleared from observation.')
      setNoteText('')
      loadObservations()
    } catch (err) {
      setObsError(err.message)
    }
  }

  const handleRestrict = async (id) => {
    try {
      await restrictUser(id, noteText)
      setActionMsg('User restricted.')
      setNoteText('')
      loadObservations()
    } catch (err) {
      setObsError(err.message)
    }
  }

  const handleUnrestrict = async (id) => {
    try {
      await unrestrictUser(id, noteText)
      setActionMsg('User unrestricted — back under observation.')
      setNoteText('')
      loadObservations()
    } catch (err) {
      setObsError(err.message)
    }
  }

  // Clear action message after 3s
  useEffect(() => {
    if (!actionMsg) return
    const t = setTimeout(() => setActionMsg(''), 3000)
    return () => clearTimeout(t)
  }, [actionMsg])

  const thStyle = {
    fontFamily: FONT, fontSize: '0.7rem', fontWeight: 'bold', color: '#333',
    textAlign: 'left', padding: '6px 10px', textTransform: 'uppercase',
    letterSpacing: 1, borderBottom: '1px solid rgba(0,0,0,0.2)',
  }
  const tdStyle = {
    fontFamily: FONT, fontSize: '0.8rem', color: '#111',
    padding: '8px 10px', borderBottom: '1px solid rgba(0,0,0,0.12)',
    verticalAlign: 'middle',
  }
  const btnStyle = {
    fontFamily: FONT, fontSize: '0.7rem', fontWeight: 'bold',
    padding: '4px 12px', borderRadius: 20, border: '1px solid #333',
    backgroundColor: 'transparent', cursor: 'pointer', color: '#111',
    transition: 'all 0.15s',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FONT }}>

      {/* SIDEBAR */}
      <aside style={{
        width: 210, minWidth: 210, backgroundColor: '#2d3748', color: '#e2e8f0',
        display: 'flex', flexDirection: 'column', padding: '20px 0',
        boxSizing: 'border-box',
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
            {user?.Name ? user.Name.charAt(0).toUpperCase() : '?'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: '0.85rem', fontWeight: 'bold',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user?.Name || 'Unknown'}
            </div>
            <div style={{
              fontSize: '0.65rem', color: '#8a9e6e',
              textTransform: 'uppercase', letterSpacing: 1,
            }}>
              admin ⭐
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10, flex: 1 }}>
          <SidebarItem icon="🔍" label="Suspicious" active={tab === 'suspicious'} onClick={() => setTab('suspicious')} />
          <SidebarItem icon="👁" label="Observation" active={tab === 'observation'} onClick={() => setTab('observation')} />
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 20px' }}>
          <button onClick={() => navigate('/tasks')} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
            color: '#e2e8f0', fontSize: '0.85rem', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', fontFamily: FONT, width: '100%',
          }}>
            ← Back to Tasks
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

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 900, color: '#111', textDecoration: 'underline', margin: 0 }}>
            Admin — {tab === 'suspicious' ? 'Suspicious Activities' : 'Observation List'}
          </h1>
        </div>

        {/* Action feedback toast */}
        {actionMsg && (
          <div style={{
            fontFamily: FONT, fontSize: '0.85rem', color: '#0a3622',
            backgroundColor: '#d1e7dd', padding: '8px 16px', borderRadius: 8,
            marginBottom: 16, position: 'relative', zIndex: 1,
          }}>
            ✓ {actionMsg}
          </div>
        )}

        {/* ── SUSPICIOUS ACTIVITIES TAB ── */}
        {tab === 'suspicious' && (
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <label style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#333', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showUnreviewedOnly}
                  onChange={e => setShowUnreviewedOnly(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Unreviewed only
              </label>
            </div>

            {actError && (
              <div style={{ fontFamily: FONT, color: '#7c1d24', backgroundColor: '#f8d7da', padding: '8px 16px', borderRadius: 8, marginBottom: 16 }}>
                ⚠ {actError}
              </div>
            )}

            {actLoading ? (
              <p style={{ fontFamily: FONT, color: '#444' }}>Loading...</p>
            ) : activities.length === 0 ? (
              <p style={{ fontFamily: FONT, color: '#444' }}>No suspicious activities found.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>User</th>
                      <th style={thStyle}>Rule</th>
                      <th style={thStyle}>Severity</th>
                      <th style={thStyle}>Detected</th>
                      <th style={thStyle}>Reviewed</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map(a => (
                      <tr key={a.SuspiciousActivityId} style={{ transition: 'background-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={tdStyle}>
                          <strong>{a.user?.Name || 'Unknown'}</strong>
                          <span style={{ fontSize: '0.7rem', color: '#666', display: 'block' }}>
                            {a.user?.Email || ''}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '0.75rem', fontFamily: FONT }}>
                            {a.RuleTriggered}
                          </span>
                        </td>
                        <td style={tdStyle}><SeverityBadge severity={a.Severity} /></td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '0.75rem' }}>
                            {new Date(a.DetectedAt).toLocaleString()}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {a.IsReviewed ? (
                            <span style={{ color: '#0a3622', fontSize: '0.75rem' }}>
                              ✓ by {a.reviewer?.Name || 'admin'}
                            </span>
                          ) : (
                            <span style={{ color: '#8a4b0a', fontSize: '0.75rem' }}>Pending</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {!a.IsReviewed && (
                            <button style={btnStyle} onClick={() => handleReview(a.SuspiciousActivityId)}>
                              Mark Reviewed
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── OBSERVATION LIST TAB ── */}
        {tab === 'observation' && (
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#333' }}>Status:</span>
              {['', 'UNDER_OBSERVATION', 'CLEARED', 'RESTRICTED'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    fontFamily: FONT, fontSize: '0.75rem', fontWeight: 'bold',
                    padding: '4px 14px', borderRadius: 20, cursor: 'pointer',
                    border: '1px solid #333',
                    backgroundColor: statusFilter === s ? '#3a4558' : 'transparent',
                    color: statusFilter === s ? '#ddd' : '#333',
                    transition: 'all 0.15s',
                  }}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>

            {obsError && (
              <div style={{ fontFamily: FONT, color: '#7c1d24', backgroundColor: '#f8d7da', padding: '8px 16px', borderRadius: 8, marginBottom: 16 }}>
                ⚠ {obsError}
              </div>
            )}

            {obsLoading ? (
              <p style={{ fontFamily: FONT, color: '#444' }}>Loading...</p>
            ) : observations.length === 0 ? (
              <p style={{ fontFamily: FONT, color: '#444' }}>No observation entries found.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>User</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Reason</th>
                      <th style={thStyle}>Started</th>
                      <th style={thStyle}>Notes</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observations.map(o => (
                      <tr key={o.ObservationId} style={{ transition: 'background-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={tdStyle}>
                          <strong>{o.observedUser?.Name || 'Unknown'}</strong>
                          <span style={{ fontSize: '0.7rem', color: '#666', display: 'block' }}>
                            {o.observedUser?.Email || ''}
                          </span>
                        </td>
                        <td style={tdStyle}><StatusBadge status={o.Status} /></td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '0.75rem' }}>{o.Reason || '—'}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '0.75rem' }}>
                            {new Date(o.StartedAt).toLocaleString()}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '0.75rem', color: '#555' }}>
                            {o.Notes || '—'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-start' }}>
                            {o.Status === 'UNDER_OBSERVATION' && (
                              <>
                                <button style={btnStyle} onClick={() => handleClear(o.ObservationId)}>
                                  Clear
                                </button>
                                <button
                                  style={{ ...btnStyle, color: '#7c1d24', borderColor: '#7c1d24' }}
                                  onClick={() => handleRestrict(o.ObservationId)}
                                >
                                  Restrict
                                </button>
                              </>
                            )}
                            {o.Status === 'RESTRICTED' && (
                              <button
                                style={{ ...btnStyle, color: '#0a3622', borderColor: '#0a3622' }}
                                onClick={() => handleUnrestrict(o.ObservationId)}
                              >
                                Unrestrict
                              </button>
                            )}
                            {o.Status === 'CLEARED' && (
                              <span style={{ fontSize: '0.7rem', color: '#666' }}>
                                Finalized
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Note input for actions */}
            <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: FONT, fontSize: '0.8rem', color: '#333' }}>Note:</span>
              <input
                type="text"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Optional note for clear/restrict..."
                style={{
                  fontFamily: FONT, fontSize: '0.8rem', padding: '8px 14px',
                  borderRadius: 20, border: '1px solid #333', backgroundColor: '#f5f5d0',
                  outline: 'none', color: '#222', flex: 1, maxWidth: 400,
                }}
              />
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
