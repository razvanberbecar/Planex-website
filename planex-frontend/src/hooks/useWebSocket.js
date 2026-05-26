import { useEffect, useRef, useCallback } from 'react'

// Use the Vite proxy path (/ws) so WebSocket goes through the same
// host:port as the page.  The protocol auto-detects ws:/wss: based
// on the page protocol so mixed-content is never an issue.
const WS_PROTO = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL   = `${WS_PROTO}//${window.location.host}/ws`

/**
 * useWebSocket — connects to the backend WebSocket server.
 * Automatically reconnects if the connection drops.
 * Sends JWT token for server-side authentication.
 */
function getAccessToken() {
  return localStorage.getItem('planex_accessToken')
}

export function useWebSocket({ onConnected } = {}) {
  const wsRef         = useRef(null)
  const reconnectRef  = useRef(null)
  const mountedRef    = useRef(true)
  const tokenRef      = useRef(getAccessToken())

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    const token = getAccessToken()
    tokenRef.current = token

    // Don't connect without a token
    if (!token) {
      console.log('[WS] No token available — will retry in 5s...')
      if (mountedRef.current) {
        reconnectRef.current = setTimeout(connect, 5000)
      }
      return
    }

    try {
      // Pass token as query parameter for server-side auth
      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected to Planex backend')
        if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'CONNECTED') {
            onConnected && onConnected(msg.payload)
          }

          // Handle auth errors from server
          if (msg.type === 'ERROR' && msg.code === 'AUTH_FAILED') {
            console.warn('[WS] Authentication failed — reconnecting...')
            ws.close()
          }
        } catch {}
      }

      ws.onerror = () => console.warn('[WS] Connection error')

      ws.onclose = () => {
        console.log('[WS] Disconnected — reconnecting in 5s...')
        if (mountedRef.current) {
          reconnectRef.current = setTimeout(connect, 5000)
        }
      }
    } catch (err) {
      console.warn('[WS] Could not connect:', err.message)
      if (mountedRef.current) {
        reconnectRef.current = setTimeout(connect, 5000)
      }
    }
  }, [onConnected])

  useEffect(() => {
    mountedRef.current = true
    connect()

    // Reconnect when token changes (login/logout)
    const handleTokenChange = () => {
      const newToken = getAccessToken()
      if (newToken !== tokenRef.current) {
        tokenRef.current = newToken
        if (wsRef.current) wsRef.current.close()
        connect()
      }
    }
    window.addEventListener('storage', handleTokenChange)

    return () => {
      mountedRef.current = false
      window.removeEventListener('storage', handleTokenChange)
      if (wsRef.current) wsRef.current.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  return wsRef
}