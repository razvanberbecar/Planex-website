// ──────────────────────────────────────────────────────────────
// ChatContext — global WebSocket connection that survives
// route changes so the chat never disconnects when switching tabs.
// ──────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthContext'

const ChatContext = createContext(null)

// Use the Vite proxy path (/ws) for WebSocket — same host:port as
// the page, and protocol auto-detects ws:/wss: to avoid mixed-content.
const WS_PROTO = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL   = `${WS_PROTO}//${window.location.host}/ws`

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
