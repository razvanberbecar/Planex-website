// ──────────────────────────────────────────────────────────────
// Subtask Repository — Sequelize / SQL Server
// Replaces the in-memory subtask store with database persistence.
// ──────────────────────────────────────────────────────────────

const { Subtask, Task } = require('../models');

// ── HELPERS: shape a DB row into frontend-friendly format ──────
function toFrontend(row) {
  return {
    id:          row.SubtaskId,
    taskId:      row.TaskId,
    title:       row.Title,
    isCompleted: Boolean(row.IsCompleted),
  };
}

// ── PUBLIC API (matches the old in-memory repo interface) ─────

/** Get all subtasks for a specific task. */
async function getAllForTask(taskId) {
  const rows = await Subtask.findAll({
    where: { TaskId: taskId },
    raw: true,
  });
  return rows.map(toFrontend);
}

/** Get a single subtask by ID. */
async function getById(id) {
  const row = await Subtask.findByPk(id, { raw: true });
  return row ? toFrontend(row) : null;
}

/** Create a new subtask for a given task. */
async function create(taskId, data) {
  const row = await Subtask.create({
    TaskId: taskId,
    Title: data.title.trim(),
  });
  return toFrontend(row.get({ plain: true }));
}

/** Update a subtask (only title and isCompleted). */
async function update(id, data) {
  const sub = await Subtask.findByPk(id);
  if (!sub) return null;

  const updates = {};
  if (data.title !== undefined) updates.Title = data.title.trim();
  if (data.isCompleted !== undefined) updates.IsCompleted = data.isCompleted;

  await Subtask.update(updates, { where: { SubtaskId: id } });

  const updated = await Subtask.findByPk(id, { raw: true });
  return toFrontend(updated);
}

/** Delete a subtask by ID. */
async function remove(id) {
  const sub = await Subtask.findByPk(id);
  if (!sub) return false;
  await Subtask.destroy({ where: { SubtaskId: id } });
  return true;
}

/** Delete all subtasks for a given task. */
async function removeAllForTask(taskId) {
  await Subtask.destroy({ where: { TaskId: taskId } });
}

/** Reset store with seed data (for testing). */
async function _reset(seed = []) {
  await Subtask.destroy({ where: {} });
  if (seed.length > 0) {
    await Subtask.bulkCreate(seed.map(s => ({
      TaskId: s.taskId,
      Title: s.title,
      IsCompleted: s.isCompleted,
    })));
  }
}

module.exports = {
  getAllForTask,
  getById,
  create,
  update,
  remove,
  removeAllForTask,
  _reset,
};
