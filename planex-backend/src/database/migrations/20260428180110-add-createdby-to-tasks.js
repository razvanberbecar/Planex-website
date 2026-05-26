// ──────────────────────────────────────────────────────────────
// Migration: Add CreatedBy FK (Users) to Tasks table
// Enables per-user task scoping — each task belongs to one user.
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add CreatedBy column — nullable to allow existing rows to migrate
    await queryInterface.addColumn('Tasks', 'CreatedBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'FK to Users.UserId — the user who created this task',
    });

    // Add foreign key constraint
    await queryInterface.addConstraint('Tasks', {
      fields: ['CreatedBy'],
      type: 'foreign key',
      name: 'FK_Tasks_CreatedBy',
      references: {
        table: 'Users',
        field: 'UserId',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // Add index for filtering tasks by user
    await queryInterface.addIndex('Tasks', ['CreatedBy'], {
      name: 'IX_Tasks_CreatedBy',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Tasks', 'IX_Tasks_CreatedBy');
    await queryInterface.removeConstraint('Tasks', 'FK_Tasks_CreatedBy');
    await queryInterface.removeColumn('Tasks', 'CreatedBy');
  },
};
