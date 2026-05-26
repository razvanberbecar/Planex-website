// ──────────────────────────────────────────────────────────────
// Integration Tests — Task API Endpoints
// Uses supertest to test the full HTTP request/response cycle.
// ──────────────────────────────────────────────────────────────

// Vitest globals (describe, it, expect, beforeEach) are injected via vitest.config.js globals:true

// Mock auth middleware to bypass JWT / DB checks during integration tests
vi.mock('../../src/middleware/auth.js')

import request from 'supertest'
import app from '../../src/app.js'

// NOTE: taskRoutes.js now requires('../database/repositories/taskRepository')
// via CJS require().  vitest.setup.js populates the CJS require cache with
// in-memory mocks for both DB repos, so this require() returns the mock.
// We do NOT use vi.mock() for DB repos here — that would conflict with the
// CJS cache approach and cause hoisting issues with factory closures.
const repo = require('../../src/database/repositories/taskRepository')

describe('Task API — /api/tasks', () => {
  beforeEach(() => {
    repo.seed()
  })

  // ── GET /api/tasks ───────────────────────────────────────────

  describe('GET /api/tasks', () => {
    it('200 — returns paginated task list', async () => {
      const res = await request(app).get('/api/tasks')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('data')
      expect(res.body).toHaveProperty('total')
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBe(5)
      expect(res.body.total).toBe(5)
    })

    it('respects page & limit params', async () => {
      const res = await request(app).get('/api/tasks?page=2&limit=2')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBe(2)
      expect(res.body.page).toBe(2)
    })

    it('filters by active', async () => {
      const res = await request(app).get('/api/tasks?filter=active')
      expect(res.status).toBe(200)
      expect(res.body.data.every(t => !t.isCompleted)).toBe(true)
    })

    it('filters by completed', async () => {
      const res = await request(app).get('/api/tasks?filter=completed')
      expect(res.status).toBe(200)
      expect(res.body.data.every(t => t.isCompleted)).toBe(true)
    })

    it('filters by collaborative', async () => {
      const res = await request(app).get('/api/tasks?filter=collaborative&userName=user1')
      expect(res.status).toBe(200)
      expect(res.body.data.every(t => t.collaborators.includes('user1'))).toBe(true)
    })

    it('searches by title', async () => {
      const res = await request(app).get('/api/tasks?search=task 1')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.data[0].title).toBe('task 1')
    })

    it('sorts by priority ascending', async () => {
      const res = await request(app).get('/api/tasks?sort=priority_asc')
      expect(res.status).toBe(200)
      const priorities = res.body.data.map(t => t.priority)
      // PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 }
      // Seed: ['High', 'Low', 'Medium', 'Low', 'Medium']
      // Ascending: High(0), Medium(1), Medium(1), Low(2), Low(2)
      expect(priorities).toEqual(['High', 'Medium', 'Medium', 'Low', 'Low'])
    })

    it('sorts by priority descending', async () => {
      const res = await request(app).get('/api/tasks?sort=priority_desc')
      expect(res.status).toBe(200)
      const priorities = res.body.data.map(t => t.priority)
      // Descending: Low(2), Low(2), Medium(1), Medium(1), High(0)
      expect(priorities).toEqual(['Low', 'Low', 'Medium', 'Medium', 'High'])
    })
  })

  // ── GET /api/tasks/statistics ────────────────────────────────

  describe('GET /api/tasks/statistics', () => {
    it('200 — returns statistics object', async () => {
      const res = await request(app).get('/api/tasks/statistics')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('total')
      expect(res.body).toHaveProperty('completed')
      expect(res.body).toHaveProperty('active')
      expect(res.body.total).toBe(5)
      expect(res.body.completed).toBe(2)
      expect(res.body.active).toBe(3)
    })
  })

  // ── GET /api/tasks/:id ───────────────────────────────────────

  describe('GET /api/tasks/:id', () => {
    it('200 — returns a single task', async () => {
      const res = await request(app).get('/api/tasks/1')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('title', 'task 1')
    })

    it('404 — task not found', async () => {
      const res = await request(app).get('/api/tasks/999')
      expect(res.status).toBe(404)
    })

    it('400 — invalid ID format', async () => {
      const res = await request(app).get('/api/tasks/abc')
      expect(res.status).toBe(400)
    })
  })

  // ── POST /api/tasks ──────────────────────────────────────────

  describe('POST /api/tasks', () => {
    const validTask = {
      title: 'New Task',
      description: 'A new task for testing',
      dueDate: '2026-12-31',
      priority: 'High',
    }

    it('201 — creates a new task', async () => {
      const res = await request(app).post('/api/tasks').send(validTask)
      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      expect(res.body.title).toBe('New Task')
    })

    it('400 — missing title', async () => {
      const res = await request(app).post('/api/tasks').send({ ...validTask, title: '' })
      expect(res.status).toBe(400)
    })

    it('400 — missing dueDate', async () => {
      const res = await request(app).post('/api/tasks').send({ ...validTask, dueDate: '' })
      expect(res.status).toBe(400)
    })

    it('400 — invalid dueDate format', async () => {
      const res = await request(app).post('/api/tasks').send({ ...validTask, dueDate: 'not-a-date' })
      expect(res.status).toBe(400)
    })

    it('400 — invalid priority value', async () => {
      const res = await request(app).post('/api/tasks').send({ ...validTask, priority: 'Urgent' })
      expect(res.status).toBe(400)
    })

    it('400 — title too long', async () => {
      const res = await request(app).post('/api/tasks').send({ ...validTask, title: 'x'.repeat(101) })
      expect(res.status).toBe(400)
    })

    it('400 — description too long', async () => {
      // Validation middleware allows max 1000 characters
      const res = await request(app).post('/api/tasks').send({ ...validTask, description: 'x'.repeat(1001) })
      expect(res.status).toBe(400)
    })

    it('400 — collaborators not an array', async () => {
      const res = await request(app).post('/api/tasks').send({ ...validTask, collaborators: 'not-an-array' })
      expect(res.status).toBe(400)
    })

    it('400 — missing priority', async () => {
      const res = await request(app).post('/api/tasks').send({ ...validTask, priority: '' })
      expect(res.status).toBe(400)
    })
  })

  // ── PUT /api/tasks/:id ───────────────────────────────────────

  describe('PUT /api/tasks/:id', () => {
    it('200 — updates an existing task', async () => {
      const res = await request(app).put('/api/tasks/1').send({ title: 'Updated Task', priority: 'Low' })
      expect(res.status).toBe(200)
      expect(res.body.title).toBe('Updated Task')
      expect(res.body.priority).toBe('Low')
    })

    it('404 — task not found', async () => {
      const res = await request(app).put('/api/tasks/999').send({ title: 'Ghost' })
      expect(res.status).toBe(404)
    })

    it('400 — invalid ID', async () => {
      const res = await request(app).put('/api/tasks/abc').send({ title: 'Nope' })
      expect(res.status).toBe(400)
    })

    it('400 — invalid priority in update', async () => {
      const res = await request(app).put('/api/tasks/1').send({ priority: 'Urgent' })
      expect(res.status).toBe(400)
    })

    it('400 — invalid dueDate in update', async () => {
      const res = await request(app).put('/api/tasks/1').send({ dueDate: 'bad-date' })
      expect(res.status).toBe(400)
    })
  })

  // ── DELETE /api/tasks/:id ────────────────────────────────────

  describe('DELETE /api/tasks/:id', () => {
    it('204 — deletes an existing task', async () => {
      const res = await request(app).delete('/api/tasks/1')
      expect(res.status).toBe(204)
    })

    it('404 — task not found', async () => {
      const res = await request(app).delete('/api/tasks/999')
      expect(res.status).toBe(404)
    })

    it('400 — invalid ID', async () => {
      const res = await request(app).delete('/api/tasks/abc')
      expect(res.status).toBe(400)
    })
  })

  // ── PATCH /api/tasks/:id/toggle ──────────────────────────────

  describe('PATCH /api/tasks/:id/toggle', () => {
    it('200 — toggles isCompleted from false to true', async () => {
      const res = await request(app).patch('/api/tasks/1/toggle')
      expect(res.status).toBe(200)
      expect(res.body.isCompleted).toBe(true)
    })

    it('200 — toggles isCompleted from true to false', async () => {
      const res = await request(app).patch('/api/tasks/2/toggle')
      expect(res.status).toBe(200)
      expect(res.body.isCompleted).toBe(false)
    })

    it('404 — task not found', async () => {
      const res = await request(app).patch('/api/tasks/999/toggle')
      expect(res.status).toBe(404)
    })

    it('400 — invalid ID', async () => {
      const res = await request(app).patch('/api/tasks/abc/toggle')
      expect(res.status).toBe(400)
    })
  })

  // ── Unknown routes ──────────────────────────────────────────

  describe('Unknown routes', () => {
    it('404 — non-existent route', async () => {
      const res = await request(app).get('/api/tasks/1/nonexistent')
      expect(res.status).toBe(404)
    })
  })
})
