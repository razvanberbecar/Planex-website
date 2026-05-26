// ──────────────────────────────────────────────────────────────
// Migration: Create Roles table
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Roles', {
      RoleId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      Name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      Description: {
        type: Sequelize.STRING(255),
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Roles');
  },
};
