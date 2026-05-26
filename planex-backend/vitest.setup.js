// ──────────────────────────────────────────────────────────────
// Vitest Setup — CJS require() Mock Patcher
//
// Vitest's vi.mock() only intercepts ESM imports processed by
// Vite. CJS require() calls (used extensively in app.js, routes,
// and middleware) bypass Vite and go directly to Node.js's
// module cache.
//
// This setup file populates the CJS require cache with mock
// modules BEFORE any test files are imported, ensuring that
// require('./middleware/auth') returns our mock instead of the
// real auth module.
//
// NOTE: DB repositories are mocked here for route integration
// tests. Database integration tests (db.test.js) will clear
// these cache entries before loading the real repos.
// ──────────────────────────────────────────────────────────────

import { vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// ── Mock Auth Middleware ─────────────────────────────────────
//
// Provides the same exported API as src/middleware/auth.js:
//   authenticate, optionalAuth, requirePermission, authorize,
//   requireAdmin, generateAccessToken, generateRefreshToken,
//   updateLastActivity
//
// Each middleware function simply sets req.user and calls next(),
// bypassing JWT verification, Session lookups, and all DB access.

const mockAuth = {
  authenticate: (req, res, next) => {
    req.user = { UserId: 1, RoleId: 1, roleName: 'admin' }
    next()
  },

  optionalAuth: (req, res, next) => {
    req.user = { UserId: 1, RoleId: 1, roleName: 'admin' }
    next()
  },

  requirePermission: (_permissionName) => {
    return (_req, _res, next) => next()
  },

  authorize: (..._allowedRoles) => {
    return (_req, _res, next) => next()
  },

  requireAdmin: (_req, _res, next) => {
    next()
  },

  generateAccessToken: (_payload) => 'mock-access-token',
  generateRefreshToken: (_payload) => 'mock-refresh-token',

  updateLastActivity: (_req, _res, next) => {
    next()
  },
}

// ── Populate the CJS require cache ──────────────────────────
//
// We register the mock at the exact path that Node.js will
// use when resolving require('./middleware/auth') from app.js or
// require('../middleware/auth') from routes/ files.
//
// path.resolve() normalises separators for the current platform.

const authModulePath = path.resolve(__dirname, 'src/middleware/auth.js')

if (!require.cache[authModulePath]) {
  require.cache[authModulePath] = {
    exports: mockAuth,
    loaded: true,
    id: authModulePath,
    paths: [],
    filename: authModulePath,
  }
}

// ── Mock DB Task Repository ─────────────────────────────────
//
// In-memory implementation that mirrors the Sequelize-backed
// src/database/repositories/taskRepository.js interface.
//
// Used by route integration tests (taskRoutes.test.js) so they
// don't require a real SQL Server connection.

function createMockTaskRepo() {
  const SEED_TASKS = [
    { id: 1, title: 'task 1', description: 'description for task 1', dueDate: '2026-06-30', collaborators: ['user1'],          isCompleted: false, priority: 'High',   createdBy: 1 },
    { id: 2, title: 'task 2', description: 'description for task 2', dueDate: '2026-07-15', collaborators: [],                 isCompleted: true,  priority: 'Low',    createdBy: 2 },
    { id: 3, title: 'task 3', description: 'description for task 3', dueDate: '2027-01-01', collaborators: ['user1', 'user2'],  isCompleted: false, priority: 'Medium', createdBy: 1 },
    { id: 4, title: 'task 4', description: 'description for task 4', dueDate: '2027-02-01', collaborators: ['user5'],           isCompleted: true,  priority: 'Low',    createdBy: 3 },
    { id: 5, title: 'task 5', description: 'description for task 5', dueDate: '2026-12-01', collaborators: [],                  isCompleted: false, priority: 'Medium', createdBy: 2 },
  ]

  let tasks = []
  let nextId = 1

  return {
    seed() {
      tasks = SEED_TASKS.map(t => ({ ...t }))
      nextId = Math.max(...tasks.map(t => t.id)) + 1
    },
    clear() {
      tasks = []
      nextId = 1
    },
    _reset(seed = []) {
      tasks = seed.map(t => ({ ...t }))
      nextId = seed.length ? Math.max(...seed.map(s => s.id)) + 1 : 1
    },
    findAll({ userId, isAdmin } = {}) {
      if (isAdmin) return tasks.map(t => ({ ...t }))
      if (userId) {
        const uid = Number(userId)
        return tasks.filter(t => t.createdBy === uid).map(t => ({ ...t }))
      }
      return tasks.map(t => ({ ...t }))
    },
    findByCollaborator(userName) {
      return tasks
        .filter(t => t.collaborators && t.collaborators.includes(userName))
        .map(t => ({ ...t }))
    },
    findById(id) {
      const task = tasks.find(t => t.id === id)
      return task ? { ...task } : undefined
    },
    getById(id) {
      const task = tasks.find(t => t.id === id)
      return task ? { ...task } : undefined
    },
    getAll() {
      return tasks.map(t => ({ ...t }))
    },
    create(data) {
      const task = {
        id: nextId++,
        title: data.title,
        description: data.description || '',
        dueDate: data.dueDate,
        collaborators: Array.isArray(data.collaborators) ? [...data.collaborators] : [],
        isCompleted: false,
        priority: data.priority || 'Medium',
        createdBy: data.createdBy || null,
      }
      tasks.push(task)
      return { ...task }
    },
    update(id, data) {
      const index = tasks.findIndex(t => t.id === id)
      if (index === -1) return undefined
      const allowed = ['title', 'description', 'dueDate', 'collaborators', 'priority', 'isCompleted']
      for (const key of allowed) {
        if (data[key] !== undefined) {
          tasks[index][key] = key === 'collaborators' && Array.isArray(data[key])
            ? [...data[key]]
            : data[key]
        }
      }
      return { ...tasks[index] }
    },
    remove(id) {
      const index = tasks.findIndex(t => t.id === id)
      if (index === -1) return false
      tasks.splice(index, 1)
      return true
    },
    toggleCompletion(id) {
      const index = tasks.findIndex(t => t.id === id)
      if (index === -1) return undefined
      tasks[index].isCompleted = !tasks[index].isCompleted
      return { ...tasks[index] }
    },
  }
}

// ── Mock DB Subtask Repository ──────────────────────────────
//
// In-memory implementation that mirrors the Sequelize-backed
// src/database/repositories/subtaskRepository.js interface.

function createMockSubtaskRepo() {
  const SEED_SUBTASKS = [
    { id: 1, taskId: 1, title: 'Research topic',    isCompleted: false },
    { id: 2, taskId: 1, title: 'Write draft',        isCompleted: true  },
    { id: 3, taskId: 3, title: 'Invite collaborators', isCompleted: false },
  ]

  let subtasks = []
  let nextId = 1

  return {
    seed() {
      subtasks = SEED_SUBTASKS.map(s => ({ ...s }))
      nextId = Math.max(...subtasks.map(s => s.id)) + 1
    },
    getAllForTask(taskId) {
      return subtasks.filter(s => s.taskId === taskId).map(s => ({ ...s }))
    },
    getById(id) {
      return subtasks.find(s => s.id === id) || null
    },
    create(taskId, data) {
      const sub = { id: nextId++, taskId, title: data.title, isCompleted: false }
      subtasks.push(sub)
      return { ...sub }
    },
    update(id, data) {
      const idx = subtasks.findIndex(s => s.id === id)
      if (idx === -1) return null
      if (data.title !== undefined) subtasks[idx].title = data.title
      if (data.isCompleted !== undefined) subtasks[idx].isCompleted = data.isCompleted
      return { ...subtasks[idx] }
    },
    remove(id) {
      const idx = subtasks.findIndex(s => s.id === id)
      if (idx === -1) return false
      subtasks.splice(idx, 1)
      return true
    },
    removeAllForTask(taskId) {
      subtasks = subtasks.filter(s => s.taskId !== taskId)
    },
    _reset(seed = []) {
      subtasks = seed.map(s => ({ ...s }))
      nextId = seed.length ? Math.max(...seed.map(s => s.id)) + 1 : 1
    },
  }
}

const mockTaskRepo = createMockTaskRepo()
const mockSubtaskRepo = createMockSubtaskRepo()

// Seed the mocks once so they have initial data
mockTaskRepo.seed()
mockSubtaskRepo._reset()

const dbTaskRepoPath = path.resolve(__dirname, 'src/database/repositories/taskRepository.js')
const dbSubtaskRepoPath = path.resolve(__dirname, 'src/database/repositories/subtaskRepository.js')

if (!require.cache[dbTaskRepoPath]) {
  require.cache[dbTaskRepoPath] = {
    exports: mockTaskRepo,
    loaded: true,
    id: dbTaskRepoPath,
    paths: [],
    filename: dbTaskRepoPath,
  }
}

if (!require.cache[dbSubtaskRepoPath]) {
  require.cache[dbSubtaskRepoPath] = {
    exports: mockSubtaskRepo,
    loaded: true,
    id: dbSubtaskRepoPath,
    paths: [],
    filename: dbSubtaskRepoPath,
  }
}
