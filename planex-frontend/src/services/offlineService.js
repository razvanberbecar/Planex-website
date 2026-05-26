// ── OFFLINE SERVICE ───────────────────────────────────────
// Detects when the network goes down, stores CRUD operations in memory,
// and replays them against the backend when the connection is restored.

import * as api from './api'

// In-memory queue of pending operations
let syncQueue = []

// In-memory local task store used when offline
let localTasks = []

let isOnline = navigator.onLine
let listeners = []

// ── NETWORK LISTENERS ─────────────────────────────────────
window.addEventListener('online', async () => {
  isOnline = true
  console.log('[Offline] Back online — syncing queue...')
  notifyListeners()
  await flushQueue()
})

window.addEventListener('offline', () => {
  isOnline = false
  console.log('[Offline] Gone offline — using local memory')
  notifyListeners()
})

export function getIsOnline() { return isOnline }

// Subscribe to online/offline changes
export function subscribeToNetworkStatus(fn) {
  listeners.push(fn)
  return () => { listeners = listeners.filter(l => l !== fn) }
}

function notifyListeners() {
  listeners.forEach(fn => fn(isOnline))
}

// ── LOCAL STORE ───────────────────────────────────────────
export function setLocalTasks(tasks) { localTasks = [...tasks] }
export function getLocalTasks()      { return localTasks }

function applyLocalOperation(op) {
  if (op.type === 'CREATE') {
    const tempTask = { ...op.data, id: Date.now(), isCompleted: false }
    localTasks.push(tempTask)
  }
  if (op.type === 'UPDATE') {
    localTasks = localTasks.map(t => t.id === op.id ? { ...t, ...op.data } : t)
  }
  if (op.type === 'DELETE') {
    localTasks = localTasks.filter(t => t.id !== op.id)
  }
}

// ── QUEUE ─────────────────────────────────────────────────
function enqueue(op) {
  syncQueue.push(op)
  applyLocalOperation(op)
  console.log(`[Offline] Queued operation: ${op.type}`, op)
}

async function flushQueue() {
  if (syncQueue.length === 0) return
  console.log(`[Offline] Flushing ${syncQueue.length} queued operations...`)

  const ops = [...syncQueue]
  syncQueue = []

  for (const op of ops) {
    try {
      if (op.type === 'CREATE') await api.createTask(op.data)
      if (op.type === 'UPDATE') await api.updateTask(op.id, op.data)
      if (op.type === 'DELETE') await api.deleteTask(op.id)
      console.log(`[Offline] Synced: ${op.type}`)
    } catch (err) {
      console.error(`[Offline] Failed to sync op ${op.type}:`, err.message)
      // Re-queue failed ops
      syncQueue.push(op)
    }
  }
}

// ── SMART CRUD ────────────────────────────────────────────
// Use these instead of api.* directly.
// They automatically fall back to offline mode when needed.

export async function smartCreateTask(data) {
  if (isOnline) {
    return api.createTask(data)
  } else {
    enqueue({ type: 'CREATE', data })
    return { ...data, id: Date.now(), isCompleted: false, priority: data.priority || 'Medium' }
  }
}

export async function smartUpdateTask(id, data) {
  if (isOnline) {
    return api.updateTask(id, data)
  } else {
    enqueue({ type: 'UPDATE', id, data })
    const existing = localTasks.find(t => t.id === id)
    return existing ? { ...existing, ...data } : null
  }
}

export async function smartDeleteTask(id) {
  if (isOnline) {
    return api.deleteTask(id)
  } else {
    enqueue({ type: 'DELETE', id })
    return null
  }
}

export function getPendingCount() { return syncQueue.length }