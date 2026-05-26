// ──────────────────────────────────────────────────────────────
// Task Routes — REST endpoints for tasks
// All routes require authentication.
// Authorization is applied per-route based on role/permission.
// ──────────────────────────────────────────────────────────────

const express = require('express');
const { Op } = require('sequelize');
const taskRepo = require('../database/repositories/taskRepository');
const subRepo  = require('../database/repositories/subtaskRepository');
const { User } = require('../database/models');
const logService = require('../services/logService');
const { authenticate, authorize, requirePermission } = require('../middleware/auth');
const {
  taskBodyRules,
  taskUpdateRules,
  idParamRule,
  handleValidation,
} = require('../middleware/validateCjs');

const router = express.Router();

// All routes in this router require authentication + activity tracking
router.use(authenticate);

// Helper: paginate an array in-memory (for REST endpoint)
function paginateArray(items, page = 1, limit = 5) {
  const safePage  = Math.max(1, Math.floor(Number(page) || 1))
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 5)))
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / safeLimit))
  const currentPage = Math.min(safePage, totalPages)
  const start = (currentPage - 1) * safeLimit
  const data  = items.slice(start, start + safeLimit)
  return { data, total: totalItems, totalPages, page: currentPage, limit: safeLimit }
}

// ── USER SEARCH for collaborator autocomplete ─────────────
// Available to all authenticated users
// Uses ILIKE for case-insensitive matching on PostgreSQL
router.get('/users/search', async (req, res, next) => {
  try {
    const { q } = req.query
    if (!q || q.length < 1) return res.json([])
    const users = await User.findAll({
      where: {
        Name: { [Op.iLike]: `%${q}%` },
      },
      attributes: ['UserId', 'Name', 'Email'],
      raw: true,
    })
    res.json(users)
  } catch (err) {
    next(err)
  }
})

// ── LIST with filtering/search/sort/pagination ─────────────
// Requires tasks:read permission
router.get('/', requirePermission('tasks:read'), async (req, res, next) => {
  try {
    const { filter, search, sort, page, limit, userId, userName, isAdmin } = req.query
    const admin = isAdmin === 'true'

    // Log the view action (fallback to JWT user if not in query)
    const uid = userId ? Number(userId) : (req.user ? req.user.UserId : undefined)
    if (uid) {
      logService.log({
        userId: uid,
        action: logService.Actions.VIEW_TASKS,
        resourceType: 'Task',
        details: { filter, search, sort, page, limit },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(err => console.error('[Tasks] Log error:', err.message))
    }

    let items
    if (filter === 'collaborative' && userName) {
      items = await taskRepo.findByCollaborator(userName)
    } else if (admin) {
      items = await taskRepo.findAll({ isAdmin: true })
    } else {
      // Non-admin: show tasks the user created OR tasks they are a collaborator on
      const myTasks = await taskRepo.findAll({ userId: userId ? Number(userId) : undefined })
      const collabTasks = userName ? await taskRepo.findByCollaborator(userName) : []
      const seen = new Set()
      items = [...myTasks, ...collabTasks].filter(t => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })
    }

    if (filter === 'active')        items = items.filter(t => !t.isCompleted)
    else if (filter === 'completed')     items = items.filter(t => t.isCompleted)

    if (search) {
      const term = search.toLowerCase()
      items = items.filter(t => t.title.toLowerCase().includes(term))
    }

    const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 }
    if (sort === 'priority_asc') {
      items.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))
    } else if (sort === 'priority_desc') {
      items.sort((a, b) => (PRIORITY_ORDER[b.priority] ?? 1) - (PRIORITY_ORDER[a.priority] ?? 1))
    }

    const result = paginateArray(items, page, limit)
    const data = await Promise.all(result.data.map(async (t) => ({
      ...t,
      subtasks: await subRepo.getAllForTask(t.id),
    })))

    res.json({ ...result, data })
  } catch (err) {
    next(err)
  }
})

// Statistics must be defined BEFORE the /:id route to avoid
// "statistics" being parsed as an ID parameter.
router.get('/statistics', requirePermission('tasks:read'), async (req, res, next) => {
  try {
    const { userId, userName, isAdmin } = req.query
    const admin = isAdmin === 'true'

    let tasks
    if (admin) {
      tasks = await taskRepo.findAll({ isAdmin: true })
    } else {
      const myTasks = await taskRepo.findAll({ userId: userId ? Number(userId) : undefined })
      const collabTasks = userName ? await taskRepo.findByCollaborator(userName) : []
      const seen = new Set()
      tasks = [...myTasks, ...collabTasks].filter(t => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })
    }

    const total      = tasks.length
    const completed  = tasks.filter(t => t.isCompleted).length
    const active     = total - completed
    const collaborative = tasks.filter(t => t.collaborators && t.collaborators.length > 0).length
    const solo       = total - collaborative

    // Normalise priority keys to lowercase for frontend consistency
    const byPriority = { high: 0, medium: 0, low: 0 }
    tasks.forEach(t => {
      const key = (t.priority || 'medium').toLowerCase()
      if (byPriority[key] !== undefined) byPriority[key]++
    })

    const monthMap = {}
    tasks.forEach(t => {
      const raw = t.dueDate || ''
      const date = new Date(raw.replace(/\./g, '-'))
      const key = isNaN(date.getTime()) ? 'Unknown'
        : date.toLocaleString('default', { month: 'short', year: '2-digit' })
      if (!monthMap[key]) monthMap[key] = { tasks: 0, collab: 0, solo: 0 }
      monthMap[key].tasks++
      if (t.collaborators && t.collaborators.length > 0) monthMap[key].collab++
      else monthMap[key].solo++
    })

    const byMonth = Object.entries(monthMap).map(([month, val]) => ({ month, ...val }))
    const peakMonth = byMonth.length ? byMonth.reduce((a, b) => (b.tasks > a.tasks ? b : a)).month : '—'

    res.json({ total, completed, active, collaborative, solo, byPriority, byMonth, peakMonth })
  } catch (err) {
    next(err)
  }
})

// ── GET single task ────────────────────────────────────────
// Requires tasks:read permission
router.get('/:id', idParamRule, handleValidation, requirePermission('tasks:read'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const task = await taskRepo.getById(id)
    if (!task) return res.status(404).json({ error: 'Task not found.' })
    task.subtasks = await subRepo.getAllForTask(id)

    const userId = req.query.userId ? Number(req.query.userId) : (req.user ? req.user.UserId : null)
    if (userId) {
      logService.log({
        userId,
        action: logService.Actions.VIEW_TASK,
        resourceType: 'Task',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(err => console.error('[Tasks] Log error:', err.message))
    }

    res.json(task)
  } catch (err) {
    next(err)
  }
})

// ── CREATE ─────────────────────────────────────────────────
// Requires tasks:create permission
router.post('/', taskBodyRules, handleValidation, requirePermission('tasks:create'), async (req, res, next) => {
  try {
    const taskData = {
      ...req.body,
      createdBy: req.body.createdBy || null,
    };
    const task = await taskRepo.create(taskData);
    task.subtasks = [];

    const userId = req.body.createdBy ? Number(req.body.createdBy) : (req.user ? req.user.UserId : null)
    if (userId) {
      logService.log({
        userId,
        action: logService.Actions.CREATE_TASK,
        resourceType: 'Task',
        resourceId: task.id,
        details: { title: taskData.title, priority: taskData.priority },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(err => console.error('[Tasks] Log error:', err.message))
    }

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
})

// ── UPDATE ─────────────────────────────────────────────────
// Requires tasks:update permission
router.put('/:id', idParamRule, taskUpdateRules, handleValidation, requirePermission('tasks:update'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const task = await taskRepo.update(id, req.body)
    if (!task) return res.status(404).json({ error: 'Task not found.' })
    task.subtasks = await subRepo.getAllForTask(id)

    const userId = req.body.userId ? Number(req.body.userId) : (req.user ? req.user.UserId : null)
    if (userId) {
      logService.log({
        userId,
        action: logService.Actions.UPDATE_TASK,
        resourceType: 'Task',
        resourceId: id,
        details: { updatedFields: Object.keys(req.body) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(err => console.error('[Tasks] Log error:', err.message))
    }

    res.json(task)
  } catch (err) {
    next(err)
  }
})

// ── DELETE ─────────────────────────────────────────────────
// Authorisation: admin/manager can delete any task;
// regular users can only delete tasks they created.
router.delete('/:id', idParamRule, handleValidation, async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    // Fetch the task to check ownership
    const task = await taskRepo.findById(id)
    if (!task) return res.status(404).json({ error: 'Task not found.' })

    const currentUserId = req.user.UserId
    const isAdmin = req.user.roleName === 'admin'

    // Non-admin can only delete their own tasks
    if (!isAdmin && Number(task.createdBy) !== Number(currentUserId)) {
      return res.status(403).json({ error: 'You can only delete your own tasks.' })
    }

    const deleted = await taskRepo.remove(id)
    if (!deleted) return res.status(404).json({ error: 'Task not found.' })

    logService.log({
      userId: currentUserId,
      action: logService.Actions.DELETE_TASK,
      resourceType: 'Task',
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(err => console.error('[Tasks] Log error:', err.message))

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── TOGGLE COMPLETION ──────────────────────────────────────
// Requires tasks:update permission
router.patch('/:id/toggle', idParamRule, handleValidation, requirePermission('tasks:update'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const task = await taskRepo.toggleCompletion(id)
    if (!task) return res.status(404).json({ error: 'Task not found.' })
    task.subtasks = await subRepo.getAllForTask(id)

    const userId = req.query.userId ? Number(req.query.userId) : (req.user ? req.user.UserId : null)
    if (userId) {
      logService.log({
        userId,
        action: logService.Actions.TOGGLE_TASK,
        resourceType: 'Task',
        resourceId: id,
        details: { isCompleted: task.isCompleted },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(err => console.error('[Tasks] Log error:', err.message))
    }

    res.json(task)
  } catch (err) {
    next(err)
  }
})

module.exports = router;
