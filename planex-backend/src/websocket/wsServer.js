const { WebSocketServer } = require('ws')
const { getDb } = require('../database/mongodb')
const { checkToxicity } = require('../services/aiService')
const { flagUser } = require('../services/flagService')

let wss = null

// Store username<->ws mapping so we can identify who sent what
const clients = new Map() // ws -> { userId, userName }

// ── In-memory message cache (fallback when MongoDB is down) ──
const MAX_CACHED_MESSAGES = 100
const messageCache = [] // newest at the end

// ── BROADCAST ─────────────────────────────────────────────
function broadcast(type, payload, excludeWs = null) {
  if (!wss) return
  const message = JSON.stringify({ type, payload })
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client !== excludeWs) {
      client.send(message)
    }
  })
}

// ── Load recent messages (MongoDB → in-memory fallback) ────
async function loadRecentMessages(room = 'general', limit = 50) {
  try {
    const db = getDb()
    if (db) {
      const messages = db.collection('messages')
      const docs = await messages
        .find({ room })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()
      return docs.reverse()
    }
  } catch (err) {
    console.error('[WS] Failed to load messages from MongoDB:', err.message)
  }

  // Fallback: return from in-memory cache
  const filtered = messageCache.filter(m => m.room === room)
  return filtered.slice(-limit)
}

// ── Save message (MongoDB + in-memory cache) ──────────────
async function saveMessage(room, userId, userName, text) {
  const timestamp = new Date()
  let doc = null

  try {
    const db = getDb()
    if (db) {
      const messages = db.collection('messages')
      const result = await messages.insertOne({ room, userId, userName, text, timestamp })
      doc = { _id: result.insertedId, room, userId, userName, text, timestamp }
    }
  } catch (err) {
    console.error('[WS] Failed to save message to MongoDB:', err.message)
  }

  // Always store in in-memory cache as well
  const cacheEntry = {
    _id: `cache-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    room: room || 'general',
    userId,
    userName,
    text,
    timestamp,
  }
  messageCache.push(cacheEntry)
  if (messageCache.length > MAX_CACHED_MESSAGES) {
    messageCache.splice(0, messageCache.length - MAX_CACHED_MESSAGES)
  }

  return doc || cacheEntry
}

// ── ATTACH TO HTTP SERVER ─────────────────────────────────
function attachWebSocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (ws, req) => {
    console.log(`[WS] Client connected from ${req.socket.remoteAddress}`)

    // Send confirmation on connection
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      payload: { message: 'Connected to Planex WebSocket' },
    }))

    // ── Handle incoming messages ──────────────────────────
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString())

        switch (msg.type) {
          // ── JOIN: client registers with userId + userName ──
          case 'JOIN': {
            const { userId, userName } = msg.payload
            clients.set(ws, { userId, userName })
            console.log(`[WS] User "${userName}" (ID: ${userId}) joined`)

            // ── Send the list of already-online users to the new joiner ──
            const onlineList = []
            wss.clients.forEach(client => {
              if (client.readyState === 1 && client !== ws) {
                const info = clients.get(client)
                if (info) onlineList.push(info)
              }
            })
            ws.send(JSON.stringify({
              type: 'ONLINE_USERS',
              payload: { users: onlineList },
            }))

            // Send welcome + recent messages
            const recent = await loadRecentMessages('general')
            ws.send(JSON.stringify({
              type: 'CHAT_HISTORY',
              payload: { room: 'general', messages: recent },
            }))

            // Notify others
            broadcast('USER_JOINED', { userId, userName }, ws)
            break
          }

          // ── CHAT_MESSAGE: toxicity check, then store + broadcast ──
          case 'CHAT_MESSAGE': {
            const clientInfo = clients.get(ws)
            if (!clientInfo) {
              ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'You must JOIN first.' } }))
              return
            }

            const { text, room } = msg.payload
            if (!text || !text.trim()) return

            // ── Toxicity guard ────────────────────────────────────
            const { toxic } = await checkToxicity(text.trim())
            if (toxic) {
              ws.send(JSON.stringify({
                type: 'MESSAGE_REJECTED',
                payload: { reason: 'Your message was blocked for containing inappropriate content.' },
              }))
              // Flag the user for admin review (fire-and-forget)
              flagUser(clientInfo.userId, 'toxic_chat', text.trim().slice(0, 300)).catch(() => {})
              return
            }

            const saved = await saveMessage(
              room || 'general',
              clientInfo.userId,
              clientInfo.userName,
              text.trim()
            )

            const msgStr = JSON.stringify({
              type: 'CHAT_MESSAGE',
              payload: saved,
            })
            wss.clients.forEach(client => {
              if (client.readyState === 1) client.send(msgStr)
            })
            break
          }

          default:
            break
        }
      } catch (err) {
        console.error('[WS] Error handling message:', err.message)
      }
    })

    ws.on('close', () => {
      const info = clients.get(ws)
      if (info) {
        console.log(`[WS] User "${info.userName}" disconnected`)
        broadcast('USER_LEFT', { userId: info.userId, userName: info.userName })
        clients.delete(ws)
      } else {
        console.log('[WS] Client disconnected')
      }
    })
  })

  return wss
}

function broadcastTaskEvent(type, payload) {
  if (!wss) return
  const message = JSON.stringify({ type, payload })
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(message)
  })
}

module.exports = { attachWebSocket, broadcast, broadcastTaskEvent }
