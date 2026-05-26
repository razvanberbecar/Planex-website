// ──────────────────────────────────────────────────────────────
// Migration: Create Users table
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      UserId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      Name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      Email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      Password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      RoleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2, // default to 'user' role
        references: { model: 'Roles', key: 'RoleId' },
        onDelete: 'NO ACTION',
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

    // Index on Email for fast login lookups
    await queryInterface.addIndex('Users', ['Email'], { name: 'IX_Users_Email' });
    await queryInterface.addIndex('Users', ['RoleId'], { name: 'IX_Users_RoleId' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Users');
  },
};
