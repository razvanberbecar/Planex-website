const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TaskDependency extends Model {}

  TaskDependency.init({
    DependencyId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    TaskId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'The task that is BLOCKED',
    },
    BlockedById: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'The task it is blocked BY',
    },
  }, {
    sequelize,
    tableName: 'TaskDependencies',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: false,
  });

  return TaskDependency;
};
