// ──────────────────────────────────────────────────────────────
// Migration: Create RolePermissions join table
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('RolePermissions', {
      RolePermissionId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      RoleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Roles', key: 'RoleId' },
        onDelete: 'CASCADE',
      },
      PermissionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Permissions', key: 'PermissionId' },
        onDelete: 'CASCADE',
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

    // Unique constraint on RoleId + PermissionId
    await queryInterface.addIndex('RolePermissions', ['RoleId', 'PermissionId'], {
      name: 'UQ_RolePermissions_RoleId_PermissionId',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('RolePermissions');
  },
};
