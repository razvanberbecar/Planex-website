const express = require('express')
const { authenticate, updateLastActivity } = require('../middleware/auth')
const { suggestSubtasks, filterChatMessages } = require('../services/aiService')

const router = express.Router()

// ── POST /api/ai/suggest-subtasks ────────────────────────────
router.post('/suggest-subtasks', authenticate, updateLastActivity, async (req, res) => {
  try {
    const { title, description } = req.body
    if (!title) return res.status(400).json({ error: 'title is required' })
    const subtasks = await suggestSubtasks(title, description)
    res.json({ subtasks })
  } catch (err) {
    console.error('[AI] suggest-subtasks error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/ai/chat-filter ─────────────────────────────────
// Body: { messages: [...], query: string }
// Returns: { ids: string[] }  — _id values of matching messages
router.post('/chat-filter', authenticate, updateLastActivity, async (req, res) => {
  try {
    const { messages, query } = req.body
    if (!query || !query.trim()) return res.status(400).json({ error: 'query is required' })
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' })

    const ids = await filterChatMessages(messages, query.trim())
    res.json({ ids })
  } catch (err) {
    console.error('[AI] chat-filter error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
