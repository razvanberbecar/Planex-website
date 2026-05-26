// ──────────────────────────────────────────────────────────────
// Unit Tests — Task Service
// ──────────────────────────────────────────────────────────────

// Vitest globals (describe, it, expect, beforeEach) are injected via vitest.config.js globals:true
import * as repo from '../../src/repository/taskRepository.js'
import * as service from '../../src/services/taskService.js'

describe('taskService', () => {
  beforeEach(() => {
    repo.seed()
  })

  // ── listTasks ────────────────────────────────────────────────

  describe('listTasks', () => {
    it('returns all tasks paginated (default page=1, limit=5)', () => {
      const result = service.listTasks()
      expect(result.data).toHaveLength(5)
      expect(result.meta.totalItems).toBe(5)
      expect(result.meta.currentPage).toBe(1)
    })

    it('paginates correctly (limit=2, page=2)', () => {
      const result = service.listTasks({ page: 2, limit: 2 })
      expect(result.data).toHaveLength(2)
      expect(result.meta.currentPage).toBe(2)
      expect(result.meta.totalPages).toBe(3)
    })

    it('filters active tasks', () => {
      const result = service.listTasks({ filter: 'active', limit: 100 })
      expect(result.data.every(t => !t.isCompleted)).toBe(true)
      expect(result.data).toHaveLength(3)
    })

    it('filters completed tasks', () => {
      const result = service.listTasks({ filter: 'completed', limit: 100 })
      expect(result.data.every(t => t.isCompleted)).toBe(true)
      expect(result.data).toHaveLength(2)
    })

    it('filters collaborative tasks', () => {
      const result = service.listTasks({ filter: 'collaborative', limit: 100 })
      expect(result.data.every(t => t.collaborators.length > 0)).toBe(true)
      expect(result.data).toHaveLength(3)
    })

    it('searches by title (case-insensitive)', () => {
      const result = service.listTasks({ search: 'TASK 1', limit: 100 })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].title).toBe('task 1')
    })

    it('sorts by priority ascending (High → Low)', () => {
      const result = service.listTasks({ sort: 'priority_asc', limit: 100 })
      const priorities = result.data.map(t => t.priority)
      expect(priorities[0]).toBe('High')
      expect(priorities[priorities.length - 1]).toBe('Low')
    })

    it('sorts by priority descending (Low → High)', () => {
      const result = service.listTasks({ sort: 'priority_desc', limit: 100 })
      const priorities = result.data.map(t => t.priority)
      expect(priorities[0]).toBe('Low')
    })

    it('combines filter + search + sort + pagination', () => {
      // Active tasks matching "task", sorted high→low, page 1 of 2
      const result = service.listTasks({
        filter: 'active',
        search: 'task',
        sort: 'priority_asc',
        limit: 2,
        page: 1,
      })
      expect(result.data.length).toBeLessThanOrEqual(2)
      expect(result.meta.currentPage).toBe(1)
    })
  })

  // ── getTask ──────────────────────────────────────────────────

  describe('getTask', () => {
    it('returns the task for a valid ID', () => {
      expect(service.getTask(1).title).toBe('task 1')
    })

    it('returns undefined for a non-existent ID', () => {
      expect(service.getTask(999)).toBeUndefined()
    })
  })

  // ── createTask ───────────────────────────────────────────────

  describe('createTask', () => {
    it('creates and returns a new task', () => {
      const task = service.createTask({ title: 'new', dueDate: '2028-01-01', priority: 'High' })
      expect(task.id).toBeDefined()
      expect(task.title).toBe('new')
    })
  })

  // ── updateTask ───────────────────────────────────────────────

  describe('updateTask', () => {
    it('updates and returns the task', () => {
      const updated = service.updateTask(1, { title: 'updated' })
      expect(updated.title).toBe('updated')
    })

    it('returns undefined for a non-existent ID', () => {
      expect(service.updateTask(999, { title: 'x' })).toBeUndefined()
    })
  })

  // ── deleteTask ───────────────────────────────────────────────

  describe('deleteTask', () => {
    it('returns true when deleted', () => {
      expect(service.deleteTask(1)).toBe(true)
    })

    it('returns false for a non-existent ID', () => {
      expect(service.deleteTask(999)).toBe(false)
    })
  })

  // ── toggleTask ───────────────────────────────────────────────

  describe('toggleTask', () => {
    it('toggles the completion status', () => {
      const original = service.getTask(1)
      const toggled = service.toggleTask(1)
      expect(toggled.isCompleted).toBe(!original.isCompleted)
    })

    it('returns undefined for a non-existent ID', () => {
      expect(service.toggleTask(999)).toBeUndefined()
    })
  })

  // ── getStatistics ────────────────────────────────────────────

  describe('getStatistics', () => {
    it('returns correct aggregate counts', () => {
      const stats = service.getStatistics()
      expect(stats.total).toBe(5)
      expect(stats.completed).toBe(2)
      expect(stats.active).toBe(3)
      expect(stats.collaborative).toBe(3)
      expect(stats.solo).toBe(2)
    })

    it('returns correct priority breakdown', () => {
      const stats = service.getStatistics()
      expect(stats.byPriority.High).toBe(1)
      expect(stats.byPriority.Medium).toBe(2)
      expect(stats.byPriority.Low).toBe(2)
    })

    it('returns byMonth as an array with month data', () => {
      const stats = service.getStatistics()
      expect(Array.isArray(stats.byMonth)).toBe(true)
      expect(stats.byMonth.length).toBeGreaterThan(0)
      stats.byMonth.forEach(m => {
        expect(m).toHaveProperty('month')
        expect(m).toHaveProperty('tasks')
        expect(m).toHaveProperty('collab')
        expect(m).toHaveProperty('solo')
      })
    })

    it('returns a peakMonth string', () => {
      const stats = service.getStatistics()
      expect(typeof stats.peakMonth).toBe('string')
      expect(stats.peakMonth).not.toBe('—')
    })

    it('handles empty store gracefully', () => {
      repo.clear()
      const stats = service.getStatistics()
      expect(stats.total).toBe(0)
      expect(stats.peakMonth).toBe('—')
      expect(stats.byMonth).toEqual([])
    })
  })
})
