// ──────────────────────────────────────────────────────────────
// Sequelize Models Index
// Loads all models and sets up associations.
// ──────────────────────────────────────────────────────────────

const { Sequelize } = require('sequelize');
const config        = require('../config');

const env    = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize;
if (dbConfig.use_env_variable) {
  // When DATABASE_URL is set, pass it as the first argument and the config object as the second
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
} else {
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
}

// ── Import Models ───────────────────────────────────────────
const TaskModel             = require('./Task');
const SubtaskModel          = require('./Subtask');
const TaskCollaboratorModel = require('./TaskCollaborator');
const RoleModel             = require('./Role');
const PermissionModel       = require('./Permission');
const RolePermissionModel   = require('./RolePermission');
const UserModel             = require('./User');
const SessionModel          = require('./Session');
const ActivityLogModel      = require('./ActivityLog');

// ── Instantiate Models ─────────────────────────────────────
const Task               = TaskModel(sequelize, Sequelize.DataTypes);
const Subtask            = SubtaskModel(sequelize, Sequelize.DataTypes);
const TaskCollaborator   = TaskCollaboratorModel(sequelize, Sequelize.DataTypes);
const Role               = RoleModel(sequelize, Sequelize.DataTypes);
const Permission         = PermissionModel(sequelize, Sequelize.DataTypes);
const RolePermission     = RolePermissionModel(sequelize, Sequelize.DataTypes);
const User               = UserModel(sequelize, Sequelize.DataTypes);
const Session            = SessionModel(sequelize, Sequelize.DataTypes);
const ActivityLog        = ActivityLogModel(sequelize, Sequelize.DataTypes);

// ── Run associate() for each model ─────────────────────────
const models = {
  Task, Subtask, TaskCollaborator,
  Role, Permission, RolePermission,
  User, Session,
  ActivityLog,
};

Object.values(models).forEach(model => {
  if (typeof model.associate === 'function') {
    model.associate(models);
  }
});

// ── Associations ────────────────────────────────────────────
// Task 1──M Subtask
Task.hasMany(Subtask, { foreignKey: 'TaskId', as: 'subtasks', onDelete: 'CASCADE' });
Subtask.belongsTo(Task,  { foreignKey: 'TaskId', as: 'task' });

// Task 1──M TaskCollaborator
Task.hasMany(TaskCollaborator, { foreignKey: 'TaskId', as: 'collaborators', onDelete: 'CASCADE' });
TaskCollaborator.belongsTo(Task, { foreignKey: 'TaskId', as: 'task' });

// ── Exports ─────────────────────────────────────────────────
module.exports = {
  sequelize,
  Sequelize,
  Task,
  Subtask,
  TaskCollaborator,
  Role,
  Permission,
  RolePermission,
  User,
  Session,
  ActivityLog,
};
