// ──────────────────────────────────────────────────────────────
// Task Repository — In-Memory Data Store
// All data is stored in a plain JavaScript array.  NO PERSISTENCE.
// ──────────────────────────────────────────────────────────────

let tasks = []
let nextId = 1

// ── Seed data (matches the 5 tasks pre-loaded in the React frontend) ──
// createdBy uses numeric UserId values; collaborators uses user names (for filtering).
const SEED_TASKS = [
  { id: 1, title: 'task 1', description: 'description for task 1', dueDate: '2026-06-30', collaborators: ['user1'],          isCompleted: false, priority: 'High',   createdBy: 1 },
  { id: 2, title: 'task 2', description: 'description for task 2', dueDate: '2026-07-15', collaborators: [],                 isCompleted: true,  priority: 'Low',    createdBy: 2 },
  { id: 3, title: 'task 3', description: 'description for task 3', dueDate: '2027-01-01', collaborators: ['user1', 'user2'],  isCompleted: false, priority: 'Medium', createdBy: 1 },
  { id: 4, title: 'task 4', description: 'description for task 4', dueDate: '2027-02-01', collaborators: ['user5'],           isCompleted: true,  priority: 'Low',    createdBy: 3 },
  { id: 5, title: 'task 5', description: 'description for task 5', dueDate: '2026-12-01', collaborators: [],                  isCompleted: false, priority: 'Medium', createdBy: 2 },
]

/** Populate the store with seed data and reset the ID counter. */
export function seed() {
  tasks = SEED_TASKS.map(t => ({ ...t }))
  nextId = Math.max(...tasks.map(t => t.id)) + 1
}

/** Clear all data (useful for tests). */
export function clear() {
  tasks = []
  nextId = 1
}

/**
 * Reset the store with custom seed data (useful for tests).
 * Each item in `seed` must be a plain object; a shallow copy is stored.
 * @param {Array<object>} seed
 */
export function _reset(seed = []) {
  tasks = seed.map(t => ({ ...t }))
  nextId = seed.length ? Math.max(...seed.map(t => t.id)) + 1 : 1
}

/**
 * Return tasks with optional user-based filtering.
 *
 * @param {Object}        [opts]        - Filter options (all optional).
 * @param {number|string} [opts.userId] - If provided (non-admin), return only tasks where
 *                                        `createdBy === userId`.
 * @param {boolean}       [opts.isAdmin]- If true, bypass user filtering and return ALL tasks.
 * @returns {Array<object>} Shallow copies of matching tasks.
 */
export function findAll({ userId, isAdmin } = {}) {
  if (isAdmin) {
    // Admin sees everything
    return tasks.map(t => ({ ...t }))
  }
  if (userId) {
    const uid = Number(userId)
    return tasks.filter(t => t.createdBy === uid).map(t => ({ ...t }))
  }
  // No filter supplied → return all (backward compat for tests / legacy callers)
  return tasks.map(t => ({ ...t }))
}

// For CommonJS compatibility (wsServer.js expects getAll)
export const getAll = findAll;

/** Alias for findById — used by routes that expect getById naming. */
export const getById = findById;

/**
 * Find tasks where the given userName is a collaborator.
 * Returns shallow copies of matching tasks.
 */
export function findByCollaborator(userName) {
  return tasks
    .filter(t => t.collaborators && t.collaborators.includes(userName))
    .map(t => ({ ...t }))
}

/** Find a single task by ID. Returns a copy or undefined. */
export function findById(id) {
  const task = tasks.find(t => t.id === id)
  return task ? { ...task } : undefined
}

/** Insert a new task.  Returns the created task (with generated ID). */
export function create(data) {
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
}

/**
 * Update an existing task.  Merges `data` into the task.
 * Returns the updated copy, or undefined if not found.
 */
export function update(id, data) {
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
}

/** Delete a task by ID.  Returns true if deleted, false if not found. */
export function remove(id) {
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) return false
  tasks.splice(index, 1)
  return true
}

/** Toggle the isCompleted flag.  Returns updated copy or undefined. */
export function toggleCompletion(id) {
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) return undefined
  tasks[index].isCompleted = !tasks[index].isCompleted
  return { ...tasks[index] }
}

// Seed the store on module load so the API starts with data.
seed()
