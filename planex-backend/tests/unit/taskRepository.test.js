// ──────────────────────────────────────────────────────────────
// Unit Tests — Task Repository
// ──────────────────────────────────────────────────────────────

// Vitest globals (describe, it, expect, beforeEach) are injected via vitest.config.js globals:true
import * as repo from '../../src/repository/taskRepository.js'

describe('taskRepository', () => {
  beforeEach(() => {
    repo.seed() // reset to 5 seed tasks before each test
  })

  // ── findAll ──────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all seeded tasks', () => {
      const tasks = repo.findAll()
      expect(tasks).toHaveLength(5)
    })

    it('returns copies (mutations do not affect store)', () => {
      const tasks = repo.findAll()
      tasks[0].title = 'MUTATED'
      expect(repo.findAll()[0].title).toBe('task 1')
    })
  })

  // ── findById ─────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the task for a valid ID', () => {
      const task = repo.findById(1)
      expect(task).toBeDefined()
      expect(task.title).toBe('task 1')
    })

    it('returns undefined for a non-existent ID', () => {
      expect(repo.findById(999)).toBeUndefined()
    })

    it('returns a copy (mutation does not affect store)', () => {
      const task = repo.findById(1)
      task.title = 'MUTATED'
      expect(repo.findById(1).title).toBe('task 1')
    })
  })

  // ── create ───────────────────────────────────────────────────

  describe('create', () => {
    it('adds a new task and returns it with a generated ID', () => {
      const created = repo.create({ title: 'new', dueDate: '2028-01-01', priority: 'High' })
      expect(created.id).toBeDefined()
      expect(created.title).toBe('new')
      expect(created.isCompleted).toBe(false)
      expect(repo.findAll()).toHaveLength(6)
    })

    it('defaults description to empty string', () => {
      const created = repo.create({ title: 't', dueDate: '2028-01-01', priority: 'Low' })
      expect(created.description).toBe('')
    })

    it('defaults collaborators to empty array', () => {
      const created = repo.create({ title: 't', dueDate: '2028-01-01', priority: 'Low' })
      expect(created.collaborators).toEqual([])
    })

    it('defaults priority to Medium when not provided', () => {
      const created = repo.create({ title: 't', dueDate: '2028-01-01' })
      expect(created.priority).toBe('Medium')
    })

    it('assigns incrementing IDs', () => {
      const a = repo.create({ title: 'a', dueDate: '2028-01-01', priority: 'Low' })
      const b = repo.create({ title: 'b', dueDate: '2028-01-01', priority: 'Low' })
      expect(b.id).toBe(a.id + 1)
    })
  })

  // ── update ───────────────────────────────────────────────────

  describe('update', () => {
    it('updates allowed fields', () => {
      const updated = repo.update(1, { title: 'updated title', priority: 'Low' })
      expect(updated.title).toBe('updated title')
      expect(updated.priority).toBe('Low')
    })

    it('returns undefined for a non-existent ID', () => {
      expect(repo.update(999, { title: 'x' })).toBeUndefined()
    })

    it('does not modify fields not provided', () => {
      const before = repo.findById(1)
      repo.update(1, { title: 'changed' })
      const after = repo.findById(1)
      expect(after.description).toBe(before.description)
      expect(after.dueDate).toBe(before.dueDate)
    })

    it('creates a copy of the collaborators array', () => {
      const collabs = ['a', 'b']
      repo.update(1, { collaborators: collabs })
      collabs.push('c')
      expect(repo.findById(1).collaborators).toEqual(['a', 'b'])
    })
  })

  // ── remove ───────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the task and returns true', () => {
      expect(repo.remove(1)).toBe(true)
      expect(repo.findAll()).toHaveLength(4)
      expect(repo.findById(1)).toBeUndefined()
    })

    it('returns false for a non-existent ID', () => {
      expect(repo.remove(999)).toBe(false)
    })
  })

  // ── toggleCompletion ─────────────────────────────────────────

  describe('toggleCompletion', () => {
    it('flips isCompleted from false to true', () => {
      const toggled = repo.toggleCompletion(1)
      expect(toggled.isCompleted).toBe(true)
    })

    it('flips isCompleted from true to false', () => {
      const toggled = repo.toggleCompletion(2) // task 2 is completed
      expect(toggled.isCompleted).toBe(false)
    })

    it('returns undefined for a non-existent ID', () => {
      expect(repo.toggleCompletion(999)).toBeUndefined()
    })
  })

  // ── clear ────────────────────────────────────────────────────

  describe('clear', () => {
    it('empties the store', () => {
      repo.clear()
      expect(repo.findAll()).toHaveLength(0)
    })

    it('resets ID counter (new task gets ID 1)', () => {
      repo.clear()
      const t = repo.create({ title: 'first', dueDate: '2028-01-01', priority: 'Low' })
      expect(t.id).toBe(1)
    })
  })
})
