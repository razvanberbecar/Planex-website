const express = require('express')
const { authenticate, updateLastActivity } = require('../middleware/auth')
const { suggestSubtasks } = require('../services/aiService')

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

module.exports = router
