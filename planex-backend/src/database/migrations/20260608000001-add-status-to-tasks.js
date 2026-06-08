'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Tasks', 'Status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'todo',
    });
    await queryInterface.sequelize.query(
      `UPDATE "Tasks" SET "Status" = 'done' WHERE "IsCompleted" = true`
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Tasks', 'Status');
  },
};
