// ──────────────────────────────────────────────────────────────
// Migration: Create Subtasks table
// FK: TaskId → Tasks.TaskId (CASCADE on delete)
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Subtasks', {
      SubtaskId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      TaskId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tasks', key: 'TaskId' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      Title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      IsCompleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      CreatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      UpdatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('Subtasks', ['TaskId'], { name: 'IX_Subtasks_TaskId' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Subtasks');
  },
};
