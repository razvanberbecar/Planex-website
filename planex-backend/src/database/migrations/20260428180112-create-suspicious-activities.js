// ──────────────────────────────────────────────────────────────
// Migration: Create SuspiciousActivities table
// Stores detected malicious/suspicious behaviour per user.
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SuspiciousActivities', {
      SuspiciousActivityId: {
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
      ActivityLogId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'ActivityLogs', key: 'LogId' },
        onDelete: 'SET NULL',
      },
      RuleTriggered: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'e.g. RAPID_SUCCESSIVE_ACTIONS, MASS_DELETION, UNUSUAL_HOURS, EXCESSIVE_FAILED_LOGINS, RAPID_CREATE_DELETE',
      },
      Severity: {
        type: Sequelize.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
        allowNull: false,
        defaultValue: 'MEDIUM',
      },
      Details: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON string with evidence context',
      },
      IsReviewed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      DetectedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      ReviewedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'UserId' },
        onDelete: 'SET NULL',
      },
      ReviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    // Indexes
    await queryInterface.addIndex('SuspiciousActivities', ['UserId'], { name: 'IX_SA_UserId' });
    await queryInterface.addIndex('SuspiciousActivities', ['RuleTriggered'], { name: 'IX_SA_RuleTriggered' });
    await queryInterface.addIndex('SuspiciousActivities', ['IsReviewed'], { name: 'IX_SA_IsReviewed' });
    await queryInterface.addIndex('SuspiciousActivities', ['Severity'], { name: 'IX_SA_Severity' });
    await queryInterface.addIndex('SuspiciousActivities', ['DetectedAt'], { name: 'IX_SA_DetectedAt' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SuspiciousActivities');
  },
};
