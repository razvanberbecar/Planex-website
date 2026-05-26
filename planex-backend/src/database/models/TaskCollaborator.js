// ──────────────────────────────────────────────────────────────
// TaskCollaborator Model — planex.TaskCollaborators
// Normalizes the collaborators array into separate rows.
// PK: CollaboratorId (INT, auto-increment)
// FK: TaskId → Tasks.TaskId
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TaskCollaborator extends Model {
    static associate(models) {
      // defined in index.js
    }
  }

  TaskCollaborator.init({
    CollaboratorId: {
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
    Username: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'TaskCollaborator',
    tableName: 'TaskCollaborators',
    timestamps: false,
  });

  return TaskCollaborator;
};
