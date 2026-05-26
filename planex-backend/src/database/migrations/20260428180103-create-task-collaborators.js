// ──────────────────────────────────────────────────────────────
// Migration: Create TaskCollaborators table
// Normalizes the collaborators array (1NF compliance).
// FK: TaskId → Tasks.TaskId (CASCADE on delete)
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TaskCollaborators', {
      CollaboratorId: {
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
      Username: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
    });

    await queryInterface.addIndex('TaskCollaborators', ['TaskId'], { name: 'IX_TaskCollaborators_TaskId' });
    await queryInterface.addIndex('TaskCollaborators', ['Username'], { name: 'IX_TaskCollaborators_Username' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TaskCollaborators');
  },
};
