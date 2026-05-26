// ──────────────────────────────────────────────────────────────
// Migration: Create Tasks table
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Tasks', {
      TaskId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      Title: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      Description: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '',
      },
      DueDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      IsCompleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      Priority: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'Medium',
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

    // Add index on Priority for filtering
    await queryInterface.addIndex('Tasks', ['Priority'], { name: 'IX_Tasks_Priority' });
    await queryInterface.addIndex('Tasks', ['IsCompleted'], { name: 'IX_Tasks_IsCompleted' });
    await queryInterface.addIndex('Tasks', ['DueDate'], { name: 'IX_Tasks_DueDate' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Tasks');
  },
};
