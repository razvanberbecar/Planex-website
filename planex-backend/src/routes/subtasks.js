// ──────────────────────────────────────────────────────────────
// Subtask Routes — CRUD for subtasks within a task.
// Requires authentication (applied at parent router level).
// ──────────────────────────────────────────────────────────────

const express    = require('express')
const router     = express.Router({ mergeParams: true })
const taskRepo   = require('../database/repositories/taskRepository')
const subRepo    = require('../database/repositories/subtaskRepository')
const logService = require('../services/logService')
const { requirePermission } = require('../middleware/auth')
const { body, param, validationResult } = require('express-validator')
const { broadcastTaskEvent } = require('../websocket/wsServer')

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

const titleRule = body('title').trim().notEmpty().withMessage('Title is required.')
  .isLength({ max: 200 }).withMessage('Title max 200 chars.')

const idRule = param('subtaskId').isInt({ gt: 0 }).withMessage('subtaskId must be a positive integer.')

function getUserId(req) {
  return req.query.userId ? Number(req.query.userId) : (req.body.userId ? Number(req.body.userId) : null)
}

async function requireTask(req, res, next) {
  const taskId = parseInt(req.params.taskId)
  const task = await taskRepo.getById(taskId)
  if (!task) return res.status(404).json({ error: 'Parent task not found.' })
  req.taskId = taskId
  next()
}

// GET /api/tasks/:taskId/subtasks — requires tasks:read
router.get('/', requireTask, requirePermission('tasks:read'), async (req, res) => {
  const subtasks = await subRepo.getAllForTask(req.taskId)
  res.json(subtasks)
})

// POST /api/tasks/:taskId/subtasks — requires subtasks:create
router.post('/', requireTask, [titleRule], validate, requirePermission('subtasks:create'), async (req, res) => {
  const subtask = await subRepo.create(req.taskId, req.body)

  broadcastTaskEvent('SUBTASK_CREATED', { taskId: req.taskId, subtask })

  const userId = getUserId(req)
  if (userId) {
    logService.log({
      userId,
      action: logService.Actions.CREATE_SUBTASK,
      resourceType: 'Subtask',
      resourceId: subtask.id,
      details: { taskId: req.taskId, title: req.body.title },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(err => console.error('[Subtasks] Log error:', err.message))
  }

  res.status(201).json(subtask)
})

// PUT /api/tasks/:taskId/subtasks/:subtaskId — requires tasks:update
router.put('/:subtaskId', requireTask, [idRule,
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('isCompleted').optional().isBoolean(),
], validate, requirePermission('subtasks:update'), async (req, res) => {
  const id = parseInt(req.params.subtaskId)
  const sub = await subRepo.getById(id)
  if (!sub) return res.status(404).json({ error: 'Subtask not found.' })
  if (sub.taskId !== req.taskId) return res.status(400).json({ error: 'Subtask does not belong to this task.' })
  const updated = await subRepo.update(id, req.body)

  broadcastTaskEvent('SUBTASK_UPDATED', { taskId: req.taskId, subtask: updated })

  const userId = getUserId(req)
  if (userId) {
    logService.log({
      userId,
      action: logService.Actions.UPDATE_SUBTASK,
      resourceType: 'Subtask',
      resourceId: id,
      details: { taskId: req.taskId, updatedFields: Object.keys(req.body) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(err => console.error('[Subtasks] Log error:', err.message))
  }

  res.json(updated)
})

// DELETE /api/tasks/:taskId/subtasks/:subtaskId — requires tasks:delete
router.delete('/:subtaskId', requireTask, [idRule], validate, requirePermission('subtasks:delete'), async (req, res) => {
  const id = parseInt(req.params.subtaskId)
  const sub = await subRepo.getById(id)
  if (!sub) return res.status(404).json({ error: 'Subtask not found.' })
  if (sub.taskId !== req.taskId) return res.status(400).json({ error: 'Subtask does not belong to this task.' })
  await subRepo.remove(id)

  broadcastTaskEvent('SUBTASK_DELETED', { taskId: req.taskId, id })

  const userId = getUserId(req)
  if (userId) {
    logService.log({
      userId,
      action: logService.Actions.DELETE_SUBTASK,
      resourceType: 'Subtask',
      resourceId: id,
      details: { taskId: req.taskId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(err => console.error('[Subtasks] Log error:', err.message))
  }

  res.status(204).send()
})

module.exports = router
