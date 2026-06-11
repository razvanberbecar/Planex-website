'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('TaskDependencies', {
      DependencyId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      // The task that is BLOCKED
      TaskId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      // The task it is blocked BY
      BlockedById: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      CreatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('TaskDependencies', ['TaskId']);
    await queryInterface.addIndex('TaskDependencies', ['BlockedById']);
    await queryInterface.addConstraint('TaskDependencies', {
      fields: ['TaskId', 'BlockedById'],
      type: 'unique',
      name: 'unique_task_dependency',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('TaskDependencies');
  },
};
