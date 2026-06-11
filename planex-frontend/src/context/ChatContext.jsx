// ──────────────────────────────────────────────────────────────
// ChatContext — global WebSocket connection that survives
// route changes so the chat never disconnects when switching tabs.
// ──────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthContext'

const ChatContext = createContext(null)

// In dev, Vite proxies /ws to localhost:3001 so window.location.host works.
// In production the frontend and backend are on different Render subdomains,
// so we derive the WS host from VITE_API_URL (same env var the API uses).
const WS_PROTO = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const _apiUrl  = import.meta.env.VITE_API_URL   // e.g. "https://planex-backend.onrender.com/api"
const _wsHost  = _apiUrl ? new URL(_apiUrl).host : window.location.host
const WS_URL   = `${WS_PROTO}//${_wsHost}/ws`

export function ChatProvider({ children }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const wsRef = useRef(null)

  // ── Connect / disconnect when user changes ─────────────────
  useEffect(() => {
    if (!user) {
      // User logged out — clean up
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setMessages([])
      setConnected(false)
      setOnlineUsers([])
      return
    }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({
        type: 'JOIN',
        payload: { userId: user.UserId, userName: user.Name },
      }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        switch (msg.type) {
          case 'CHAT_HISTORY':
            setMessages(msg.payload.messages || [])
            break

          case 'CHAT_MESSAGE':
            setMessages(prev => [...prev, msg.payload])
            break

          case 'ONLINE_USERS':
            // Full list of already-connected users sent to the joiner on JOIN
            setOnlineUsers(msg.payload.users || [])
            break

          case 'USER_JOINED':
            if (msg.payload.userId !== user.UserId) {
              setOnlineUsers(prev => {
                if (prev.find(u => u.userId === msg.payload.userId)) return prev
                return [...prev, msg.payload]
              })
            }
            break

          case 'USER_LEFT':
            setOnlineUsers(prev => prev.filter(u => u.userId !== msg.payload.userId))
            break

          case 'TASK_CREATED':
            window.dispatchEvent(new CustomEvent('task:created', { detail: msg.payload }))
            break

          case 'TASK_UPDATED':
            window.dispatchEvent(new CustomEvent('task:updated', { detail: msg.payload }))
            break

          case 'TASK_DELETED':
            window.dispatchEvent(new CustomEvent('task:deleted', { detail: msg.payload }))
            break

          case 'SUBTASK_CREATED':
            window.dispatchEvent(new CustomEvent('subtask:created', { detail: msg.payload }))
            break

          case 'SUBTASK_UPDATED':
            window.dispatchEvent(new CustomEvent('subtask:updated', { detail: msg.payload }))
            break

          case 'SUBTASK_DELETED':
            window.dispatchEvent(new CustomEvent('subtask:deleted', { detail: msg.payload }))
            break
        }
      } catch { /* ignore malformed messages */ }
    }

    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [user])

  // ── Send a chat message ───────────────────────────────────
  const sendMessage = useCallback((text) => {
    if (!text.trim() || !wsRef.current) return
    wsRef.current.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      payload: { text: text.trim(), room: 'general' },
    }))
  }, [])

  // ── Chat panel open/close state (persists across route changes) ──
  const [chatOpen, setChatOpen] = useState(true)
  const toggleChat = useCallback(() => setChatOpen(prev => !prev), [])
  const openChat = useCallback(() => setChatOpen(true), [])

  return (
    <ChatContext.Provider value={{ messages, connected, onlineUsers, sendMessage, chatOpen, toggleChat, openChat }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
