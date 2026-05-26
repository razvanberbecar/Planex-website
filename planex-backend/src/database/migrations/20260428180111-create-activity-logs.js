// ──────────────────────────────────────────────────────────────
// Migration: Create ActivityLogs table
// Persists every action performed by a logged-in user.
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ActivityLogs', {
      LogId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      UserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'UserId' },
        onDelete: 'NO ACTION',
      },
      Action: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'e.g. CREATE_TASK, UPDATE_TASK, DELETE_TASK, LOGIN, LOGIN_FAILED, REGISTER, VIEW_TASK, etc.',
      },
      ResourceType: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'e.g. Task, Subtask, User',
      },
      ResourceId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID of the affected resource (if applicable)',
      },
      Details: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON string with additional context about the action',
      },
      IpAddress: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'Client IP address (supports IPv6)',
      },
      UserAgent: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      Timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Indexes for fast lookups
    await queryInterface.addIndex('ActivityLogs', ['UserId'], { name: 'IX_ActivityLogs_UserId' });
    await queryInterface.addIndex('ActivityLogs', ['Action'], { name: 'IX_ActivityLogs_Action' });
    await queryInterface.addIndex('ActivityLogs', ['Timestamp'], { name: 'IX_ActivityLogs_Timestamp' });
    await queryInterface.addIndex('ActivityLogs', ['UserId', 'Timestamp'], { name: 'IX_ActivityLogs_User_Timestamp' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ActivityLogs');
  },
};
