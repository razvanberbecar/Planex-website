// ──────────────────────────────────────────────────────────────
// Integration Tests — Subtask REST & GraphQL endpoints
// Uses the CJS-require-cache DB repo mocks from vitest.setup.js
// ──────────────────────────────────────────────────────────────

// Mock auth middleware to bypass JWT / DB checks during integration tests
vi.mock('../src/middleware/auth.js')

import path from 'path'
import { createRequire } from 'module'
const _require = createRequire(import.meta.url)

import request from 'supertest'
import app from '../src/app.js'

// The DB repos in the CJS require cache are the vitest.setup.js mocks.
// We obtain references to them so we can reset state between tests.
const taskRepo = _require('../src/database/repositories/taskRepository')
const subRepo  = _require('../src/database/repositories/subtaskRepository')

beforeEach(() => {
  taskRepo.seed()
  subRepo.seed()
})

// ── SUBTASK REST TESTS ────────────────────────────────────

describe('GET /api/tasks/:taskId/subtasks', () => {
  it('returns subtasks for a task', async () => {
    const res = await request(app).get('/api/tasks/1/subtasks')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(2)
  })

  it('returns 404 for unknown task', async () => {
    const res = await request(app).get('/api/tasks/9999/subtasks')
    expect(res.status).toBe(404)
  })

  it('returns empty array when task has no subtasks', async () => {
    const res = await request(app).get('/api/tasks/2/subtasks')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('POST /api/tasks/:taskId/subtasks', () => {
  it('creates a subtask and returns 201', async () => {
    const res = await request(app).post('/api/tasks/1/subtasks').send({ title: 'New Sub' })
    expect(res.status).toBe(201)
    expect(res.body.title).toBe('New Sub')
    expect(res.body.taskId).toBe(1)
    expect(res.body.isCompleted).toBe(false)
  })

  it('returns 422 when title is missing', async () => {
    const res = await request(app).post('/api/tasks/1/subtasks').send({})
    expect(res.status).toBe(422)
  })

  it('returns 404 for unknown parent task', async () => {
    const res = await request(app).post('/api/tasks/9999/subtasks').send({ title: 'X' })
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/tasks/:taskId/subtasks/:subtaskId', () => {
  it('updates a subtask title', async () => {
    const res = await request(app).put('/api/tasks/1/subtasks/1').send({ title: 'Updated' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated')
  })

  it('toggles isCompleted', async () => {
    const res = await request(app).put('/api/tasks/1/subtasks/1').send({ isCompleted: true })
    expect(res.status).toBe(200)
    expect(res.body.isCompleted).toBe(true)
  })

  it('returns 404 for unknown subtask', async () => {
    const res = await request(app).put('/api/tasks/1/subtasks/9999').send({ title: 'X' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/tasks/:taskId/subtasks/:subtaskId', () => {
  it('deletes a subtask and returns 204', async () => {
    const res = await request(app).delete('/api/tasks/1/subtasks/1')
    expect(res.status).toBe(204)
  })

  it('returns 404 for unknown subtask', async () => {
    const res = await request(app).delete('/api/tasks/1/subtasks/9999')
    expect(res.status).toBe(404)
  })
})

// ── GRAPHQL TESTS ─────────────────────────────────────────

function gql(query, variables = {}) {
  return request(app)
    .post('/graphql')
    .send({ query, variables })
    .set('Content-Type', 'application/json')
}

describe('GraphQL - Query tasks', () => {
  it('queries paginated tasks', async () => {
    const res = await gql(`{ tasks { data { id title priority } total page totalPages } }`)
    expect(res.status).toBe(200)
    // vitest.setup.js seeds 5 tasks
    expect(res.body.data.tasks.total).toBe(5)
    expect(Array.isArray(res.body.data.tasks.data)).toBe(true)
  })

  it('filters active tasks', async () => {
    const res = await gql(`{ tasks(filter: "active") { data { isCompleted } total } }`)
    expect(res.body.data.tasks.data.every(t => !t.isCompleted)).toBe(true)
  })

  it('queries a single task with subtasks', async () => {
    const res = await gql(`{ task(id: 1) { id title subtasks { id title } } }`)
    expect(res.body.data.task.id).toBe(1)
    expect(Array.isArray(res.body.data.task.subtasks)).toBe(true)
  })

  it('returns null for unknown task', async () => {
    const res = await gql(`{ task(id: 9999) { id } }`)
    expect(res.body.data.task).toBeNull()
  })

  it('queries statistics', async () => {
    const res = await gql(`{ statistics { total completed active collaborative solo completionRate } }`)
    const s = res.body.data.statistics
    // vitest.setup.js: 5 tasks, 2 completed (ids 2,4), 3 active (ids 1,3,5)
    expect(s.total).toBe(5)
    expect(s.completed).toBe(2)
    expect(s.active).toBe(3)
  })
})

describe('GraphQL - Mutations', () => {
  it('creates a task', async () => {
    const res = await gql(`
      mutation { createTask(input: { title: "GQL Task", dueDate: "2026-09-01", priority: "High" }) { id title priority } }
    `)
    expect(res.body.data.createTask.title).toBe('GQL Task')
    expect(res.body.data.createTask.priority).toBe('High')
  })

  it('returns error for missing title', async () => {
    const res = await gql(`
      mutation { createTask(input: { title: "", dueDate: "2026-09-01" }) { id } }
    `)
    expect(res.body.errors).toBeDefined()
  })

  it('returns error for invalid dueDate', async () => {
    const res = await gql(`
      mutation { createTask(input: { title: "Test", dueDate: "not-a-date" }) { id } }
    `)
    expect(res.body.errors).toBeDefined()
  })

  it('updates a task', async () => {
    const res = await gql(`
      mutation { updateTask(id: 1, input: { title: "Updated via GQL" }) { id title } }
    `)
    expect(res.body.data.updateTask.title).toBe('Updated via GQL')
  })

  it('deletes a task', async () => {
    const res = await gql(`mutation { deleteTask(id: 1) }`)
    expect(res.body.data.deleteTask).toBe(true)
  })

  it('creates a subtask via GraphQL', async () => {
    const res = await gql(`
      mutation { createSubtask(taskId: 1, title: "GQL Subtask") { id title taskId } }
    `)
    expect(res.body.data.createSubtask.taskId).toBe(1)
    expect(res.body.data.createSubtask.title).toBe('GQL Subtask')
  })

  it('updates a subtask via GraphQL', async () => {
    const res = await gql(`
      mutation { updateSubtask(id: 1, isCompleted: true) { id isCompleted } }
    `)
    expect(res.body.data.updateSubtask.isCompleted).toBe(true)
  })

  it('deletes a subtask via GraphQL', async () => {
    const res = await gql(`mutation { deleteSubtask(id: 1) }`)
    expect(res.body.data.deleteSubtask).toBe(true)
  })
})
