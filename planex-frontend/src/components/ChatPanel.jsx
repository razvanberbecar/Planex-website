import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'

const FONT = '"Courier New", Courier, monospace'

// ── Detect narrow viewport ─────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mobile
}

export default function ChatPanel() {
  const { user } = useAuth()
  const { messages, connected, onlineUsers, sendMessage, chatOpen, toggleChat } = useChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const location = useLocation()
  const isMobile = useIsMobile()

  // ── Auto-scroll to bottom on new messages ──────────────
  useEffect(() => {
    if (chatOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, chatOpen])

  // Hide chat on public pages (must be AFTER all hooks)
  const isPublicPage = ['/', '/register', '/forgot-password', '/welcome'].includes(location.pathname)
    || location.pathname.startsWith('/reset-password')
  if (isPublicPage) return null

  // ── Send message ────────────────────────────────────────
  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Format time ─────────────────────────────────────────
  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isOwn = (msg) => msg.userId === user?.UserId
  const isSystem = (msg) => msg.system || msg._id?.startsWith('sys-')

  // ── Collapsed: show only the toggle tab ────────────────
  if (!chatOpen) {
    return (
      <button
        onClick={toggleChat}
        title="Open chat"
        style={{
          ...styles.toggleTab,
          ...(isMobile ? styles.toggleTabMobile : {}),
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        {connected && (
          <span style={styles.unreadDot} />
        )}
      </button>
    )
  }

  // ── Open: full panel (inline on desktop, overlay on mobile) ──
  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && (
        <div
          onClick={toggleChat}
          style={styles.backdrop}
        />
      )}

      <div style={{
        ...styles.container,
        ...(isMobile ? styles.containerMobile : {}),
      }}>
        {/* Header */}
        <div style={styles.header}>
          <button onClick={toggleChat} style={styles.closeBtn} title="Close chat">
            —
          </button>
          <span style={styles.headerTitle}>Chat</span>
          <span style={{
            ...styles.statusDot,
            backgroundColor: connected ? '#4ade80' : '#ef4444',
          }} />
          <span style={styles.statusText}>
            {connected ? `${onlineUsers.length + 1} online` : 'offline'}
          </span>
        </div>

        {/* Messages */}
        <div style={styles.messagesArea}>
          {messages.length === 0 && (
            <div style={styles.empty}>
              {connected ? 'No messages yet. Say hello!' : 'Connecting...'}
            </div>
          )}
          {messages.map((msg) => {
            if (isSystem(msg)) {
              return (
                <div key={msg._id} style={styles.systemMsg}>
                  {msg.text}
                </div>
              )
            }
            return (
              <div key={msg._id} style={{
                ...styles.messageRow,
                justifyContent: isOwn(msg) ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  ...styles.bubble,
                  backgroundColor: isOwn(msg) ? '#2d3748' : '#f5f5d0',
                  color: isOwn(msg) ? '#e2e8f0' : '#111',
                }}>
                  {!isOwn(msg) && (
                    <div style={styles.sender}>{msg.userName}</div>
                  )}
                  <div style={styles.text}>{msg.text}</div>
                  <div style={{
                    ...styles.time,
                    color: isOwn(msg) ? '#94a3b8' : '#666',
                  }}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={styles.inputArea}>
          <input
            style={styles.input}
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connected}
          />
          <button
            style={{
              ...styles.sendBtn,
              opacity: connected && input.trim() ? 1 : 0.5,
            }}
            onClick={handleSend}
            disabled={!connected || !input.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    </>
  )
}

const PANEL_WIDTH = 340

const styles = {
  // ── Collapsed toggle tab ──────────────────────────────
  toggleTab: {
    width: 44,
    minWidth: 44,
    backgroundColor: '#2d3748',
    border: 'none',
    borderLeft: '1px solid rgba(255,255,255,0.15)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    fontFamily: FONT,
    transition: 'background-color 0.2s',
  },
  toggleTabMobile: {
    position: 'fixed',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    height: 60,
    borderRadius: '10px 0 0 10px',
    zIndex: 1500,
    borderLeft: 'none',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRight: 'none',
    boxShadow: '-2px 0 8px rgba(0,0,0,0.3)',
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#4ade80',
  },

  // ── Open panel ────────────────────────────────────────
  container: {
    width: PANEL_WIDTH,
    minWidth: PANEL_WIDTH,
    backgroundColor: '#2d3748',
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    fontFamily: FONT,
    height: '100vh',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  containerMobile: {
    position: 'fixed',
    right: 0,
    top: 0,
    height: '100vh',
    zIndex: 2000,
    boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
    width: '85vw',
    maxWidth: 360,
    minWidth: 280,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 1999,
  },

  // ── Header ────────────────────────────────────────────
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '18px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0 4px 0 0',
    fontFamily: FONT,
    lineHeight: 1,
  },
  headerTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginLeft: 'auto',
  },
  statusText: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    marginLeft: 4,
  },

  // ── Messages ──────────────────────────────────────────
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '0.8rem',
    marginTop: 40,
  },
  systemMsg: {
    textAlign: 'center',
    fontSize: '0.7rem',
    color: '#64748b',
    padding: '4px 0',
    fontStyle: 'italic',
  },
  messageRow: {
    display: 'flex',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '80%',
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: '0.8rem',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  sender: {
    fontSize: '0.65rem',
    fontWeight: 'bold',
    color: '#8a9e6e',
    marginBottom: 2,
  },
  text: {
    whiteSpace: 'pre-wrap',
  },
  time: {
    fontSize: '0.6rem',
    textAlign: 'right',
    marginTop: 3,
  },

  // ── Input ─────────────────────────────────────────────
  inputArea: {
    display: 'flex',
    gap: 8,
    padding: '12px 12px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 20,
    border: 'none',
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    fontFamily: FONT,
    fontSize: '0.8rem',
    outline: 'none',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#8a9e6e',
    color: '#111',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
}
