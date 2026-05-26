// ──────────────────────────────────────────────────────────────
// Task Controller — HTTP Request Handlers
// Extracts inputs, delegates to the service, sends responses.
// ──────────────────────────────────────────────────────────────

import * as service from '../services/taskService.js'

/** GET /api/tasks */
export function list(req, res) {
  const { filter, search, sort, page, limit } = req.query
  const result = service.listTasks({ filter, search, sort, page, limit })
  // Flatten meta so the frontend receives { data, totalPages, total, page, limit }
  res.json({
    data: result.data,
    total: result.meta.totalItems,
    totalPages: result.meta.totalPages,
    page: result.meta.currentPage,
    limit: result.meta.limit,
  })
}

/** GET /api/tasks/statistics */
export function statistics(req, res) {
  res.json(service.getStatistics())
}

/** GET /api/tasks/:id */
export function getOne(req, res) {
  const id = Number(req.params.id)
  const task = service.getTask(id)
  if (!task) return res.status(404).json({ error: 'Task not found.' })
  res.json(task)
}

/** POST /api/tasks */
export function create(req, res) {
  const task = service.createTask(req.body)
  res.status(201).json(task)
}

/** PUT /api/tasks/:id */
export function update(req, res) {
  const id = Number(req.params.id)
  const task = service.updateTask(id, req.body)
  if (!task) return res.status(404).json({ error: 'Task not found.' })
  res.json(task)
}

/** DELETE /api/tasks/:id */
export function remove(req, res) {
  const id = Number(req.params.id)
  const deleted = service.deleteTask(id)
  if (!deleted) return res.status(404).json({ error: 'Task not found.' })
  res.status(204).send()
}

/** PATCH /api/tasks/:id/toggle */
export function toggle(req, res) {
  const id = Number(req.params.id)
  const task = service.toggleTask(id)
  if (!task) return res.status(404).json({ error: 'Task not found.' })
  res.json(task)
}
