// ──────────────────────────────────────────────────────────────
// Statistics Route — GET /api/statistics
// Requires authentication. Computes aggregate statistics.
// ──────────────────────────────────────────────────────────────

const express    = require('express')
const router     = express.Router()
const taskRepo   = require('../database/repositories/taskRepository')
const logService = require('../services/logService')
const statsService = require('../services/statisticsService')
const { authenticate, updateLastActivity, requirePermission } = require('../middleware/auth')

// All statistics routes require authentication + tasks:read permission
router.use(authenticate, updateLastActivity, requirePermission('tasks:read'))

// ── GET /api/statistics ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const tasks = await taskRepo.findAll()

    const total          = tasks.length
    const completed      = tasks.filter(t => t.isCompleted).length
    const active         = total - completed
    const collaborative  = tasks.filter(t => t.collaborators && t.collaborators.length > 0).length
    const solo           = total - collaborative

    const byPriority = { High: 0, Medium: 0, Low: 0 }
    tasks.forEach(t => {
      if (byPriority[t.priority] !== undefined) byPriority[t.priority]++
    })

    const monthMap = {}
    tasks.forEach(t => {
      const raw = t.dueDate || ''
      const date = new Date(raw.replace(/\./g, '-'))
      const key = isNaN(date.getTime())
        ? 'Unknown'
        : date.toLocaleString('default', { month: 'short', year: '2-digit' })
      if (!monthMap[key]) monthMap[key] = { tasks: 0, collaborative: 0, solo: 0 }
      monthMap[key].tasks++
      if (t.collaborators && t.collaborators.length > 0) monthMap[key].collaborative++
      else monthMap[key].solo++
    })

    const monthlyBreakdown = Object.entries(monthMap).map(([month, val]) => ({
      month,
      ...val,
    }))

    const peakMonth = monthlyBreakdown.length
      ? monthlyBreakdown.reduce((a, b) => (b.tasks > a.tasks ? b : a)).month
      : '—'

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    const collaborativeRate = total > 0 ? Math.round((collaborative / total) * 100) : 0

    const userId = req.query.userId ? Number(req.query.userId) : null
    if (userId) {
      logService.log({
        userId,
        action: logService.Actions.VIEW_STATISTICS,
        resourceType: 'Statistics',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(err => console.error('[Stats] Log error:', err.message))
    }

    res.json({
      total,
      completed,
      active,
      collaborative,
      solo,
      completionRate,
      collaborativeRate,
      priority: byPriority,
      peakMonth,
      monthlyBreakdown,
    })
  } catch (err) {
    console.error('[Stats] Failed to compute statistics:', err)
    res.status(500).json({ error: 'Failed to compute statistics.' })
  }
})

// ── GET /api/statistics/heavy ───────────────────────────────
// Heavily computational statistics based on many-to-many relationship.
// Query params:
//   type  - Comma-separated list: density,productivity,heatmap,centrality,rhythm (default: all)
//   mode  - "naive" (slow) or "optimized" (fast, default)
router.get('/heavy', async (req, res) => {
  try {
    const mode = (req.query.mode || 'optimized').toLowerCase();
    if (!['naive', 'optimized'].includes(mode)) {
      return res.status(400).json({ error: "mode must be 'naive' or 'optimized'" });
    }

    const validTypes = ['density', 'productivity', 'heatmap', 'centrality', 'rhythm'];
    const rawTypes = req.query.type
      ? req.query.type.split(',').map(t => t.trim().toLowerCase())
      : validTypes;

    const requestedTypes = rawTypes.filter(t => validTypes.includes(t));
    if (requestedTypes.length === 0) {
      return res.status(400).json({ error: `No valid types specified. Valid: ${validTypes.join(', ')}` });
    }

    const results = {};
    const timings = {};

    for (const type of requestedTypes) {
      const tStart = Date.now();
      const out = await statsService.compute(type, mode);
      results[type] = out.result;
      timings[type] = out.timing;
    }

    const totalTime = Object.values(timings).reduce((sum, t) => sum + (t.total || 0), 0);

    // Log the access
    logService.log({
      userId: req.user.UserId,
      action: logService.Actions.VIEW_STATISTICS,
      resourceType: 'Statistics',
      details: { type: requestedTypes.join(','), mode, totalTime: `${totalTime}ms` },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(err => console.error('[Stats] Log error:', err.message));

    res.json({
      mode,
      types: requestedTypes,
      totalTimeMs: totalTime,
      timings,
      results,
    });
  } catch (err) {
    console.error('[Stats/Heavy] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to compute heavy statistics.' });
  }
});

// ── GET /api/statistics/benchmark ───────────────────────────
// Runs all 5 computations in both naive and optimized mode,
// returns side-by-side timing comparison.
router.get('/benchmark', async (req, res) => {
  try {
    const benchmarkResults = await statsService.benchmark();
    res.json({ benchmark: benchmarkResults });
  } catch (err) {
    console.error('[Stats/Benchmark] Error:', err);
    res.status(500).json({ error: err.message || 'Benchmark failed.' });
  }
});

module.exports = router
