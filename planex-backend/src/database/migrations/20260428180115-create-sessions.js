// ──────────────────────────────────────────────────────────────
// Migration: Create Sessions table
// Persistent session storage for tracking active sessions.
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Sessions', {
      SessionId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      UserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'UserId' },
        onDelete: 'CASCADE',
      },
      Token: {
        type: Sequelize.STRING(512),
        allowNull: false,
      },
      RefreshToken: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      IpAddress: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      UserAgent: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      DeviceName: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      LastActivity: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      ExpiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      IsRevoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      RevokedAt: {
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

    await queryInterface.addIndex('Sessions', ['UserId'], { name: 'IX_Sessions_UserId' });
    await queryInterface.addIndex('Sessions', ['Token'], { name: 'IX_Sessions_Token', unique: true });
    await queryInterface.addIndex('Sessions', ['RefreshToken'], { name: 'IX_Sessions_RefreshToken' });
    await queryInterface.addIndex('Sessions', ['ExpiresAt'], { name: 'IX_Sessions_ExpiresAt' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Sessions');
  },
};
