// In-memory subtask store. No persistence.
// Each subtask belongs to a parent task (taskId).

let subtasks = [
  { id: 1, taskId: 1, title: 'Research topic',    isCompleted: false },
  { id: 2, taskId: 1, title: 'Write draft',        isCompleted: true  },
  { id: 3, taskId: 3, title: 'Invite collaborators', isCompleted: false },
]

let nextId = 4

function getAllForTask(taskId) {
  return subtasks.filter(s => s.taskId === taskId)
}

function getById(id) {
  return subtasks.find(s => s.id === id) || null
}

function create(taskId, data) {
  const subtask = { id: nextId++, taskId, title: data.title.trim(), isCompleted: false }
  subtasks.push(subtask)
  return subtask
}

function update(id, data) {
  const index = subtasks.findIndex(s => s.id === id)
  if (index === -1) return null
  subtasks[index] = {
    ...subtasks[index],
    ...(data.title       !== undefined && { title: data.title.trim() }),
    ...(data.isCompleted !== undefined && { isCompleted: data.isCompleted }),
  }
  return subtasks[index]
}

function remove(id) {
  const index = subtasks.findIndex(s => s.id === id)
  if (index === -1) return false
  subtasks.splice(index, 1)
  return true
}

function removeAllForTask(taskId) {
  subtasks = subtasks.filter(s => s.taskId !== taskId)
}

function _reset(seed = []) {
  subtasks = [...seed]
  nextId = seed.length ? Math.max(...seed.map(s => s.id)) + 1 : 1
}

module.exports = { getAllForTask, getById, create, update, remove, removeAllForTask, _reset }