// ──────────────────────────────────────────────────────────────
// Task Service — Business Logic
// Filtering, sorting, pagination, statistics.
// ──────────────────────────────────────────────────────────────

import * as repo from '../repository/taskRepository.js'
import { paginate } from '../utils/pagination.js'

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 }

// ── LIST (filter → search → sort → paginate) ─────────────────

/**
 * Return a paginated, filtered, sorted list of tasks.
 * @param {object} query – { filter, search, sort, page, limit }
 */
export function listTasks(query = {}) {
  let items = repo.findAll()

  // 1. Filter
  const filter = query.filter || 'all'
  if (filter === 'active')        items = items.filter(t => !t.isCompleted)
  else if (filter === 'completed')     items = items.filter(t => t.isCompleted)
  else if (filter === 'collaborative') items = items.filter(t => t.collaborators && t.collaborators.length > 0)

  // 2. Search (title, case-insensitive)
  if (query.search) {
    const term = query.search.toLowerCase()
    items = items.filter(t => t.title.toLowerCase().includes(term))
  }

  // 3. Sort by priority
  if (query.sort === 'priority_asc') {
    items.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))
  } else if (query.sort === 'priority_desc') {
    items.sort((a, b) => (PRIORITY_ORDER[b.priority] ?? 1) - (PRIORITY_ORDER[a.priority] ?? 1))
  }

  // 4. Paginate
  return paginate(items, query.page, query.limit)
}

// ── SINGLE ────────────────────────────────────────────────────

export function getTask(id) {
  return repo.findById(id)
}

// ── CREATE ────────────────────────────────────────────────────

export function createTask(data) {
  return repo.create(data)
}

// ── UPDATE ────────────────────────────────────────────────────

export function updateTask(id, data) {
  return repo.update(id, data)
}

// ── DELETE ────────────────────────────────────────────────────

export function deleteTask(id) {
  return repo.remove(id)
}

// ── TOGGLE COMPLETION ─────────────────────────────────────────

export function toggleTask(id) {
  return repo.toggleCompletion(id)
}

// ── STATISTICS ────────────────────────────────────────────────

export function getStatistics() {
  const tasks = repo.findAll()
  const total      = tasks.length
  const completed  = tasks.filter(t => t.isCompleted).length
  const active     = tasks.filter(t => !t.isCompleted).length
  const collaborative = tasks.filter(t => t.collaborators && t.collaborators.length > 0).length
  const solo       = total - collaborative

  // Priority breakdown
  const byPriority = { High: 0, Medium: 0, Low: 0 }
  tasks.forEach(t => { byPriority[t.priority] = (byPriority[t.priority] || 0) + 1 })

  // Group by month
  const monthMap = {}
  tasks.forEach(t => {
    const raw = t.dueDate || ''
    const date = new Date(raw.replace(/\./g, '-'))
    const key = isNaN(date.getTime())
      ? 'Unknown'
      : date.toLocaleString('default', { month: 'short', year: '2-digit' })
    if (!monthMap[key]) monthMap[key] = { tasks: 0, collab: 0, solo: 0 }
    monthMap[key].tasks++
    if (t.collaborators && t.collaborators.length > 0) monthMap[key].collab++
    else monthMap[key].solo++
  })

  const byMonth = Object.entries(monthMap).map(([month, val]) => ({
    month,
    ...val,
  }))

  const peakMonth = byMonth.length
    ? byMonth.reduce((a, b) => (b.tasks > a.tasks ? b : a)).month
    : '—'

  return { total, completed, active, collaborative, solo, byPriority, byMonth, peakMonth }
}
