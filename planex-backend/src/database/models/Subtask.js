// ──────────────────────────────────────────────────────────────
// Subtask Model — planex.Subtasks
// PK: SubtaskId (INT, auto-increment)
// FK: TaskId → Tasks.TaskId
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Subtask extends Model {
    static associate(models) {
      // defined in index.js
    }
  }

  Subtask.init({
    SubtaskId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    TaskId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Tasks', key: 'TaskId' },
    },
    Title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Title is required.' },
        len: { args: [1, 200], msg: 'Title must be at most 200 characters.' },
      },
    },
    IsCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'Subtask',
    tableName: 'Subtasks',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
  });

  return Subtask;
};
