// ──────────────────────────────────────────────────────────────
// Task Model — planex.Tasks
// PK: TaskId (INT, auto-increment)
// FK: CreatedBy → Users.UserId (task owner)
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    static associate(models) {
      // Task belongs to a User (creator/owner)
      Task.belongsTo(models.User, { foreignKey: 'CreatedBy', as: 'creator' });
    }
  }

  Task.init({
    TaskId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    Title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Title is required.' },
        len: { args: [1, 100], msg: 'Title must be at most 100 characters.' },
      },
    },
    Description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    DueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: { msg: 'Due date must be a valid date.' },
      },
    },
    IsCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    Priority: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'Medium',
      validate: {
        isIn: { args: [['High', 'Medium', 'Low']], msg: 'Priority must be High, Medium, or Low.' },
      },
    },
    CreatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'FK to Users.UserId — task owner',
    },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'todo',
      validate: {
        isIn: { args: [['todo', 'in_progress', 'done']], msg: 'Status must be todo, in_progress, or done.' },
      },
    },
  }, {
    sequelize,
    modelName: 'Task',
    tableName: 'Tasks',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
  });

  return Task;
};
