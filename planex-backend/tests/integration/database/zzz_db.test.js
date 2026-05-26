// ──────────────────────────────────────────────────────────────
// Database Integration Tests
// Tests the Sequelize-backed repositories and API endpoints
// against the real SQL Server PlanexDB database.
// ──────────────────────────────────────────────────────────────

// ── Clear CJS cache for DB repos ────────────────────────────
//
// vitest.setup.js populates the CJS require cache with in-memory
// mocks of the DB repositories so that route integration tests
// can run without a real SQL Server.
//
// This test file needs the REAL Sequelize-backed repositories,
// so we delete the cached mock entries BEFORE requiring the
// modules. This forces Node.js to re-evaluate the actual files.
//
// IMPORTANT: If db.test.js is the FIRST test file loaded in the
// worker, the app module will be loaded fresh with real repos.
// If it runs AFTER taskRoutes.test.js, the app module may already
// be cached with mock repo references — but since db.test.js uses
// direct repo calls (not through app), this doesn't affect the
// database tests.  Only the Health Check test uses `app`, and it
// does not touch any repository.
// ──────────────────────────────────────────────────────────────

const path = require('path')
const __testDir = __dirname

function clearCjsCache(relativePath) {
  const resolved = path.resolve(__testDir, relativePath)
  delete require.cache[resolved]
}

clearCjsCache('../../../src/database/repositories/taskRepository.js')
clearCjsCache('../../../src/database/repositories/subtaskRepository.js')
clearCjsCache('../../../src/app.js')
clearCjsCache('../../../src/routes/taskRoutes.js')
clearCjsCache('../../../src/routes/subtasks.js')
clearCjsCache('../../../src/routes/statistics.js')
clearCjsCache('../../../src/graphql/resolvers.js')

const request = require('supertest')
const app     = require('../../../src/app')

const taskRepo = require('../../../src/database/repositories/taskRepository')
const subRepo  = require('../../../src/database/repositories/subtaskRepository')
const { sequelize, Task, Subtask, TaskCollaborator } = require('../../../src/database/models')

let dbAvailable = false

// ── SEED DATA (must match migration 20260428180105) ─────────
const SEED_TASKS = [
  { TaskId: 1, Title: 'task 1', Description: 'desc 1', DueDate: '2026-06-30', IsCompleted: false, Priority: 'High' },
  { TaskId: 2, Title: 'task 2', Description: 'desc 2', DueDate: '2026-07-15', IsCompleted: true,  Priority: 'Low' },
  { TaskId: 3, Title: 'task 3', Description: 'desc 3', DueDate: '2026-08-01', IsCompleted: false, Priority: 'Medium' },
  { TaskId: 4, Title: 'task 4', Description: 'desc 4', DueDate: '2026-09-10', IsCompleted: true,  Priority: 'High' },
  { TaskId: 5, Title: 'task 5', Description: 'desc 5', DueDate: '2026-12-25', IsCompleted: false, Priority: 'Low' },
]

const SEED_SUBTASKS = [
  { SubtaskId: 1, TaskId: 1, Title: 'subtask 1', IsCompleted: false },
  { SubtaskId: 2, TaskId: 1, Title: 'subtask 2', IsCompleted: true  },
  { SubtaskId: 3, TaskId: 3, Title: 'subtask 3', IsCompleted: false },
]

const SEED_COLLABS = [
  { TaskId: 1, Username: 'user1' },
  { TaskId: 3, Username: 'user1' },
  { TaskId: 3, Username: 'user2' },
  { TaskId: 4, Username: 'user5' },
]

// Helper: reset database to known seed state
async function resetDb() {
  await TaskCollaborator.destroy({ where: {} })
  await Subtask.destroy({ where: {} })
  await Task.destroy({ where: {} })

  await Task.bulkCreate(SEED_TASKS)
  await Subtask.bulkCreate(SEED_SUBTASKS)
  await TaskCollaborator.bulkCreate(SEED_COLLABS)
}

// -------------------------------------------
// Connection check
// -------------------------------------------
beforeAll(async () => {
  try {
    await sequelize.authenticate()
    dbAvailable = true
    console.log('[DB-TEST] Connected to PlanexDB')
  } catch (err) {
    console.warn('[DB-TEST] Connection failed:', err.message)
    console.warn('[DB-TEST] Skipping all database-dependent tests')
  }
})

// Hook to skip tests when DB is unavailable
beforeEach(function () {
  if (!dbAvailable) {
    this.skip()
  }
})

afterAll(async () => {
  if (dbAvailable) {
    await sequelize.close()
  }
})

// -------------------------------------------
// TASK REPOSITORY — direct DB tests
// -------------------------------------------
describe('TaskRepository (Sequelize / SQL Server)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  // ── findAll ──────────────────────────────
  describe('findAll()', () => {
    it('returns all tasks with collaborator usernames', async () => {
      const tasks = await taskRepo.findAll()
      expect(tasks).toHaveLength(5)

      const t1 = tasks.find(t => t.id === 1)
      expect(t1.title).toBe('task 1')
      expect(t1.collaborators).toEqual(['user1'])
      expect(t1.isCompleted).toBe(false)

      const t3 = tasks.find(t => t.id === 3)
      expect(t3.collaborators).toEqual(['user1', 'user2'])

      const t5 = tasks.find(t => t.id === 5)
      expect(t5.collaborators).toEqual([])
    })

    it('returns all priority values correctly', async () => {
      const tasks = await taskRepo.findAll()
      expect(tasks.find(t => t.id === 1).priority).toBe('High')
      expect(tasks.find(t => t.id === 2).priority).toBe('Low')
      expect(tasks.find(t => t.id === 3).priority).toBe('Medium')
    })
  })

  // ── getById / findById ───────────────────
  describe('getById()', () => {
    it('returns a task with subtasks and collaborators', async () => {
      const task = await taskRepo.getById(1)
      expect(task).toBeDefined()
      expect(task.title).toBe('task 1')
      expect(task.collaborators).toEqual(['user1'])
      expect(task.subtasks).toHaveLength(2)
      expect(task.subtasks[0].title).toBe('subtask 1')
    })

    it('returns undefined for non-existent task', async () => {
      const task = await taskRepo.getById(999)
      expect(task).toBeUndefined()
    })
  })

  // ── create ───────────────────────────────
  describe('create()', () => {
    it('creates a task without collaborators', async () => {
      const task = await taskRepo.create({
        title: 'New Task',
        description: 'New desc',
        dueDate: '2027-01-01',
        priority: 'High',
      })
      expect(task.id).toBeGreaterThan(0)
      expect(task.title).toBe('New Task')
      expect(task.collaborators).toEqual([])
      expect(task.isCompleted).toBe(false)
    })

    it('creates a task with collaborators', async () => {
      const task = await taskRepo.create({
        title: 'Collab Task',
        dueDate: '2027-02-02',
        priority: 'Medium',
        collaborators: ['alice', 'bob'],
      })
      expect(task.collaborators).toEqual(['alice', 'bob'])
    })
  })

  // ── update ───────────────────────────────
  describe('update()', () => {
    it('updates task fields', async () => {
      const updated = await taskRepo.update(1, { title: 'Updated 1', priority: 'Low' })
      expect(updated.title).toBe('Updated 1')
      expect(updated.priority).toBe('Low')
      // Other fields unchanged
      expect(updated.description).toBe('desc 1')
    })

    it('replaces collaborators on update', async () => {
      const updated = await taskRepo.update(1, { collaborators: ['newuser'] })
      expect(updated.collaborators).toEqual(['newuser'])
    })

    it('removes all collaborators when empty array', async () => {
      const updated = await taskRepo.update(3, { collaborators: [] })
      expect(updated.collaborators).toEqual([])
    })

    it('returns undefined for non-existent task', async () => {
      const result = await taskRepo.update(999, { title: 'Nope' })
      expect(result).toBeUndefined()
    })
  })

  // ── toggleCompletion ─────────────────────
  describe('toggleCompletion()', () => {
    it('toggles isCompleted from false to true', async () => {
      const task = await taskRepo.toggleCompletion(1)
      expect(task.isCompleted).toBe(true)
    })

    it('toggles isCompleted from true to false', async () => {
      const task = await taskRepo.toggleCompletion(2)
      expect(task.isCompleted).toBe(false)
    })

    it('returns undefined for non-existent task', async () => {
      const result = await taskRepo.toggleCompletion(999)
      expect(result).toBeUndefined()
    })
  })

  // ── remove ───────────────────────────────
  describe('remove()', () => {
    it('deletes a task and cascades to subtasks and collaborators', async () => {
      const deleted = await taskRepo.remove(1)
      expect(deleted).toBe(true)

      const task = await taskRepo.getById(1)
      expect(task).toBeUndefined()

      const subs = await subRepo.getAllForTask(1)
      expect(subs).toHaveLength(0)
    })

    it('returns false for non-existent task', async () => {
      const result = await taskRepo.remove(999)
      expect(result).toBe(false)
    })
  })
})

// -------------------------------------------
// SUBTASK REPOSITORY — direct DB tests
// -------------------------------------------
describe('SubtaskRepository (Sequelize / SQL Server)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  describe('getAllForTask()', () => {
    it('returns subtasks for a task', async () => {
      const subs = await subRepo.getAllForTask(1)
      expect(subs).toHaveLength(2)
      expect(subs[0].title).toBe('subtask 1')
      expect(subs[0].taskId).toBe(1)
    })

    it('returns empty array for task with no subtasks', async () => {
      const subs = await subRepo.getAllForTask(2)
      expect(subs).toEqual([])
    })
  })

  describe('getById()', () => {
    it('returns a subtask by ID', async () => {
      const sub = await subRepo.getById(1)
      expect(sub.title).toBe('subtask 1')
      expect(sub.taskId).toBe(1)
    })

    it('returns null for non-existent subtask', async () => {
      const sub = await subRepo.getById(999)
      expect(sub).toBeNull()
    })
  })

  describe('create()', () => {
    it('creates a subtask for an existing task', async () => {
      const sub = await subRepo.create(1, { title: 'New Subtask' })
      expect(sub.title).toBe('New Subtask')
      expect(sub.taskId).toBe(1)
      expect(sub.isCompleted).toBe(false)
      expect(sub.id).toBeGreaterThan(0)
    })
  })

  describe('update()', () => {
    it('updates subtask title', async () => {
      const sub = await subRepo.update(1, { title: 'Updated Sub' })
      expect(sub.title).toBe('Updated Sub')
    })

    it('toggles subtask completion', async () => {
      const sub = await subRepo.update(1, { isCompleted: true })
      expect(sub.isCompleted).toBe(true)
    })

    it('returns null for non-existent subtask', async () => {
      const sub = await subRepo.update(999, { title: 'Nope' })
      expect(sub).toBeNull()
    })
  })

  describe('remove()', () => {
    it('deletes a subtask', async () => {
      const result = await subRepo.remove(1)
      expect(result).toBe(true)
      const sub = await subRepo.getById(1)
      expect(sub).toBeNull()
    })

    it('returns false for non-existent subtask', async () => {
      const result = await subRepo.remove(999)
      expect(result).toBe(false)
    })
  })
})


// -------------------------------------------
// HEALTH CHECK
// -------------------------------------------
describe('Health Check', () => {
  it('200 — API health endpoint', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
