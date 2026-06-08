const taskRepo = require('../database/repositories/taskRepository')
const subRepo  = require('../database/repositories/subtaskRepository')

// ── VALIDATION HELPERS ────────────────────────────────────
const VALID_PRIORITIES = ['High', 'Medium', 'Low']
const VALID_FILTERS    = ['all', 'active', 'completed', 'collaborative']

function validateCreateTask(input) {
  if (!input.title || input.title.trim() === '')
    throw new Error('Title is required.')
  if (input.title.length > 100)
    throw new Error('Title must be at most 100 characters.')
  if (!input.dueDate || input.dueDate.trim() === '')
    throw new Error('Due date is required.')
  if (isNaN(Date.parse(input.dueDate)))
    throw new Error('Due date must be a valid ISO date (YYYY-MM-DD).')
  if (input.priority && !VALID_PRIORITIES.includes(input.priority))
    throw new Error(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`)
}

function validateUpdateTask(input) {
  if (input.title !== undefined && input.title.trim() === '')
    throw new Error('Title cannot be empty.')
  if (input.dueDate !== undefined && isNaN(Date.parse(input.dueDate)))
    throw new Error('Due date must be a valid ISO date (YYYY-MM-DD).')
  if (input.priority !== undefined && !VALID_PRIORITIES.includes(input.priority))
    throw new Error(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`)
}

// ── ROOT RESOLVERS ────────────────────────────────────────
const root = {

  // ── QUERIES ─────────────────────────────────────────────

  tasks: async ({ page = 1, limit = 5, filter = 'all', priority = '', search = '' }) => {
    if (!VALID_FILTERS.includes(filter))
      throw new Error(`Filter must be one of: ${VALID_FILTERS.join(', ')}.`)
    if (priority && !VALID_PRIORITIES.includes(priority))
      throw new Error(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`)
    if (page < 1)  throw new Error('Page must be >= 1.')
    if (limit < 1 || limit > 100) throw new Error('Limit must be between 1 and 100.')

    // Use in-memory repository for data
    let items = await taskRepo.findAll()

    // Sub-filter (active / completed / collaborative)
    if (filter === 'active')        items = items.filter(t => !t.isCompleted)
    else if (filter === 'completed') items = items.filter(t => t.isCompleted)
    else if (filter === 'collaborative') items = items.filter(t => t.collaborators && t.collaborators.length > 0)

    // Priority filter
    if (priority) items = items.filter(t => t.priority === priority)

    // Search
    if (search) {
      const term = search.toLowerCase()
      items = items.filter(t => t.title.toLowerCase().includes(term))
    }

    // Pagination
    const totalItems = items.length
    const totalPages = Math.max(1, Math.ceil(totalItems / limit))
    const currentPage = Math.min(page, totalPages)
    const start = (currentPage - 1) * limit
    const data = items.slice(start, start + limit)

    // Attach subtasks
    const tasks = await Promise.all(data.map(async (t) => ({
      ...t,
      subtasks: await subRepo.getAllForTask(t.id),
    })))

    return {
      data: tasks,
      totalPages,
      total: totalItems,
      page: currentPage,
      limit,
    }
  },

  task: async ({ id }) => {
    const task = await taskRepo.getById(id)
    if (!task) return null
    task.subtasks = await subRepo.getAllForTask(id)
    return task
  },

  statistics: async () => {
    const stats = await taskRepo.findAll()
    const total      = stats.length
    const completed  = stats.filter(t => t.isCompleted).length
    const active     = total - completed
    const collaborative = stats.filter(t => t.collaborators && t.collaborators.length > 0).length
    const solo       = total - collaborative

    const byPriority = { High: 0, Medium: 0, Low: 0 }
    stats.forEach(t => { if (byPriority[t.priority] !== undefined) byPriority[t.priority]++ })

    const monthMap = {}
    stats.forEach(t => {
      const raw = t.dueDate || ''
      const date = new Date(raw.replace(/\./g, '-'))
      const key = isNaN(date.getTime()) ? 'Unknown'
        : date.toLocaleString('default', { month: 'short', year: '2-digit' })
      if (!monthMap[key]) monthMap[key] = { tasks: 0, collaborative: 0, solo: 0 }
      monthMap[key].tasks++
      if (t.collaborators && t.collaborators.length > 0) monthMap[key].collaborative++
      else monthMap[key].solo++
    })

    const monthlyBreakdown = Object.entries(monthMap).map(([month, val]) => ({ month, ...val }))
    const peakMonth = monthlyBreakdown.length
      ? monthlyBreakdown.reduce((a, b) => (b.tasks > a.tasks ? b : a)).month
      : '—'

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    const collaborativeRate = total > 0 ? Math.round((collaborative / total) * 100) : 0

    return { total, completed, active, collaborative, solo, completionRate, collaborativeRate, priority: byPriority, peakMonth, monthlyBreakdown }
  },

  subtasks: async ({ taskId }) => {
    const task = await taskRepo.getById(taskId)
    if (!task) throw new Error('Task not found.')
    return subRepo.getAllForTask(taskId)
  },

  // ── MUTATIONS ────────────────────────────────────────────

  createTask: async ({ input }) => {
    validateCreateTask(input)
    const task = await taskRepo.create(input)
    task.subtasks = []
    return task
  },

  updateTask: async ({ id, input }) => {
    validateUpdateTask(input)
    const task = await taskRepo.update(id, input)
    if (!task) return null
    task.subtasks = await subRepo.getAllForTask(id)
    return task
  },

  deleteTask: async ({ id }) => {
    const deleted = await taskRepo.remove(id)
    return deleted
  },

  createSubtask: async ({ taskId, title }) => {
    if (!title || title.trim() === '') throw new Error('Title is required.')
    const task = await taskRepo.getById(taskId)
    if (!task) throw new Error('Task not found.')
    return subRepo.create(taskId, { title })
  },

  updateSubtask: async ({ id, title, isCompleted }) => {
    const sub = await subRepo.getById(id)
    if (!sub) return null
    return subRepo.update(id, { title, isCompleted })
  },

  deleteSubtask: async ({ id }) => {
    return subRepo.remove(id)
  },

}

module.exports = root
