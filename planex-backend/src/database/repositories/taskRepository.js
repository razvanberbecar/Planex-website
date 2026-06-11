// ──────────────────────────────────────────────────────────────
// Task Repository — Sequelize / SQL Server
// Replaces the in-memory task store with database persistence.
// Uses raw queries for filtered listing (sp_GetFilteredTasks).
// ──────────────────────────────────────────────────────────────

const { Op }        = require('sequelize');
const { Task, Subtask, TaskCollaborator, User, sequelize } = require('../models');

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];

// ── HELPERS: shape a raw task row into the expected frontend shape ──
function toFrontendTask(row, collabRows = []) {
  return {
    id:            row.TaskId,
    title:         row.Title,
    description:   row.Description || '',
    dueDate:       row.DueDate,
    collaborators: collabRows.filter(c => c.TaskId === row.TaskId).map(c => c.Username),
    isCompleted:   Boolean(row.IsCompleted),
    priority:      row.Priority,
    status:          row.Status || 'todo',
    createdBy:       row.CreatedBy || null,
    createdByName:   row['creator.Name'] || null,
    recurrenceType:  row.RecurrenceType || 'none',
    recurrenceStart: row.RecurrenceStart || null,
    recurrenceEnd:   row.RecurrenceEnd || null,
  };
}

function toDbRow(data) {
  const row = {
    Title:       data.title,
    Description: data.description || '',
    DueDate:     data.dueDate,
    IsCompleted:     data.isCompleted !== undefined ? data.isCompleted : false,
    Priority:        data.priority || 'Medium',
    RecurrenceType:  data.recurrenceType || 'none',
    RecurrenceStart: data.recurrenceStart || null,
    RecurrenceEnd:   data.recurrenceEnd || null,
  };
  // Include CreatedBy if provided
  if (data.createdBy !== undefined) {
    row.CreatedBy = data.createdBy;
  }
  return row;
}

// ── PUBLIC API (matches the old in-memory repo interface) ─────────

/**
 * Return all tasks, optionally filtered by owner (CreatedBy).
 * Also returns unowned tasks (CreatedBy IS NULL) so seeded/migrated
 * tasks without an owner are visible to all users.
 * @param {object} options - { userId, isAdmin } to filter by task owner
 */
async function findAll(options = {}) {
  const where = {};
  // Admin sees ALL tasks; non-admin sees only their own tasks
  if (!options.isAdmin && options.userId) {
    where.CreatedBy = options.userId;
  }
  const tasks   = await Task.findAll({
    where,
    raw: true,
    include: [{ model: User, as: 'creator', attributes: ['Name'] }],
  });
  const collabs = await TaskCollaborator.findAll({ raw: true });
  return tasks.map(t => toFrontendTask(t, collabs));
}

/**
 * Find tasks where a given user (by Name) is a collaborator.
 * Used for the "collaborative" filter so users see tasks shared with them.
 */
async function findByCollaborator(userName) {
  const collabs = await TaskCollaborator.findAll({
    where: { Username: userName },
    raw: true,
  })
  const taskIds = collabs.map(c => c.TaskId)
  if (taskIds.length === 0) return []

  const tasks = await Task.findAll({
    where: { TaskId: { [Op.in]: taskIds } },
    raw: true,
    include: [{ model: User, as: 'creator', attributes: ['Name'] }],
  })
  const allCollabs = await TaskCollaborator.findAll({ raw: true })
  return tasks.map(t => toFrontendTask(t, allCollabs))
}

/** Find a single task by ID. */
async function findById(id) {
  const task    = await Task.findByPk(id, {
    raw: true,
    include: [{ model: User, as: 'creator', attributes: ['Name'] }],
  });
  if (!task) return undefined;

  const collabs = await TaskCollaborator.findAll({
    where: { TaskId: id },
    raw: true,
  });

  const subtasks = await Subtask.findAll({
    where: { TaskId: id },
    raw: true,
  });

  return {
    ...toFrontendTask(task, collabs),
    subtasks: subtasks.map(s => ({
      id:           s.SubtaskId,
      taskId:       s.TaskId,
      title:        s.Title,
      isCompleted:  Boolean(s.IsCompleted),
    })),
  };
}

/** Get by ID (alias for findById, returns raw row). */
async function getById(id) {
  return findById(id);
}

/** Create a new task. */
async function create(data) {
  const row = toDbRow(data);
  const task = await Task.create(row);

  // Handle collaborators
  if (Array.isArray(data.collaborators) && data.collaborators.length > 0) {
    await TaskCollaborator.bulkCreate(
      data.collaborators.map(username => ({ TaskId: task.TaskId, Username: username }))
    );
  }

  return findById(task.TaskId);
}

/** Update an existing task. */
async function update(id, data) {
  const task = await Task.findByPk(id);
  if (!task) return undefined;

  const allowed = ['title', 'description', 'dueDate', 'priority', 'isCompleted'];
  const updates = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      updates[toDbRow({ [key]: data[key] })[Object.keys(toDbRow({ [key]: data[key] }))[0]]] = data[key];
    }
  }

  // Map frontend field names to DB column names
  const fieldMap = {
    title: 'Title',
    description: 'Description',
    dueDate: 'DueDate',
    priority: 'Priority',
    isCompleted:     'IsCompleted',
    status:          'Status',
    recurrenceType:  'RecurrenceType',
    recurrenceStart: 'RecurrenceStart',
    recurrenceEnd:   'RecurrenceEnd',
  };

  const dbUpdates = {};
  for (const [frontendKey, dbKey] of Object.entries(fieldMap)) {
    if (data[frontendKey] !== undefined) {
      dbUpdates[dbKey] = data[frontendKey];
    }
  }

  await Task.update(dbUpdates, { where: { TaskId: id } });

  // Handle collaborator updates
  if (data.collaborators !== undefined) {
    await TaskCollaborator.destroy({ where: { TaskId: id } });
    if (Array.isArray(data.collaborators) && data.collaborators.length > 0) {
      await TaskCollaborator.bulkCreate(
        data.collaborators.map(username => ({ TaskId: id, Username: username }))
      );
    }
  }

  return findById(id);
}

/** Delete a task by ID (cascades to subtasks and collaborators). */
async function remove(id) {
  const task = await Task.findByPk(id);
  if (!task) return false;
  await Task.destroy({ where: { TaskId: id } });
  return true;
}

/** Toggle the isCompleted flag, keeping Status in sync. */
async function toggleCompletion(id) {
  const task = await Task.findByPk(id);
  if (!task) return undefined;
  const newCompleted = !task.IsCompleted;
  const newStatus = newCompleted ? 'done' : 'todo';
  await Task.update({ IsCompleted: newCompleted, Status: newStatus }, { where: { TaskId: id } });
  return findById(id);
}

/** Update a task's kanban status (also syncs IsCompleted). */
async function updateStatus(id, status) {
  const task = await Task.findByPk(id);
  if (!task) return undefined;
  const isCompleted = status === 'done';
  await Task.update({ Status: status, IsCompleted: isCompleted }, { where: { TaskId: id } });
  return findById(id);
}

/** Get all tasks (alias for findAll, for CommonJS compatibility). */
const getAll = findAll;

/** Clear all data (for testing). */
async function clear() {
  await TaskCollaborator.destroy({ where: {} });
  await Subtask.destroy({ where: {} });
  await Task.destroy({ where: {} });
}

/** Seed initial data (for testing). */
async function seed() {
  // Seeds are handled by migrations
  // This is a no-op for the DB repository
}

module.exports = {
  findAll,
  findByCollaborator,
  findById,
  getById,
  create,
  update,
  updateStatus,
  remove,
  toggleCompletion,
  getAll,
  clear,
  seed,
};
