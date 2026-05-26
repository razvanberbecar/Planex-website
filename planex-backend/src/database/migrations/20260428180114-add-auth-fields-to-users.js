// ──────────────────────────────────────────────────────────────
// Migration: Add authentication fields to Users table
// Adds ApiKey, OAuth fields, PasswordReset fields, and
// FailedLoginAttempts for account lockout.
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── API Key for API key authentication ─────────────────
    await queryInterface.addColumn('Users', 'ApiKey', {
      type: Sequelize.STRING(128),
      allowNull: true,
      unique: true,
    });

    await queryInterface.addIndex('Users', ['ApiKey'], {
      name: 'IX_Users_ApiKey',
      unique: true,
    });

    // ── OAuth fields ────────────────────────────────────────
    await queryInterface.addColumn('Users', 'OAuthProvider', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'OAuthId', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addIndex('Users', ['OAuthProvider', 'OAuthId'], {
      name: 'IX_Users_OAuth',
      unique: true,
    });

    // ── Password Reset fields ───────────────────────────────
    await queryInterface.addColumn('Users', 'PasswordResetToken', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'PasswordResetExpires', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // ── Account lockout fields ──────────────────────────────
    await queryInterface.addColumn('Users', 'FailedLoginAttempts', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('Users', 'LockedUntil', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // ── 2FA fields ─────────────────────────────────────────
    await queryInterface.addColumn('Users', 'TwoFactorSecret', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'TwoFactorEnabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // ── Last login tracking ─────────────────────────────────
    await queryInterface.addColumn('Users', 'LastLoginAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'LastLoginIp', {
      type: Sequelize.STRING(45),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'ApiKey');
    await queryInterface.removeColumn('Users', 'OAuthProvider');
    await queryInterface.removeColumn('Users', 'OAuthId');
    await queryInterface.removeColumn('Users', 'PasswordResetToken');
    await queryInterface.removeColumn('Users', 'PasswordResetExpires');
    await queryInterface.removeColumn('Users', 'FailedLoginAttempts');
    await queryInterface.removeColumn('Users', 'LockedUntil');
    await queryInterface.removeColumn('Users', 'TwoFactorSecret');
    await queryInterface.removeColumn('Users', 'TwoFactorEnabled');
    await queryInterface.removeColumn('Users', 'LastLoginAt');
    await queryInterface.removeColumn('Users', 'LastLoginIp');
  },
};
