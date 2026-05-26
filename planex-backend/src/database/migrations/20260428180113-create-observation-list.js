// ──────────────────────────────────────────────────────────────
// Migration: Create ObservationList table
// Tracks users placed under observation due to suspicious activity.
// Admin can view, manage, and clear users from this list on the frontend.
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ObservationList', {
      ObservationId: {
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
        comment: 'The user being observed',
      },
      AddedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'UserId' },
        onDelete: 'NO ACTION',
        comment: 'Admin who added the user to observation',
      },
      Reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      Status: {
        type: Sequelize.ENUM('UNDER_OBSERVATION', 'CLEARED', 'RESTRICTED'),
        allowNull: false,
        defaultValue: 'UNDER_OBSERVATION',
      },
      SuspiciousActivityId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'SuspiciousActivities', key: 'SuspiciousActivityId' },
        onDelete: 'SET NULL',
      },
      StartedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      EndedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      Notes: {
        type: Sequelize.TEXT,
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
    await queryInterface.addIndex('ObservationList', ['UserId'], { name: 'IX_OL_UserId' });
    await queryInterface.addIndex('ObservationList', ['Status'], { name: 'IX_OL_Status' });
    await queryInterface.addIndex('ObservationList', ['StartedAt'], { name: 'IX_OL_StartedAt' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ObservationList');
  },
};
