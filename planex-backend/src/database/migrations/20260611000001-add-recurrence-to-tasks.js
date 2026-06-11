'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Tasks', 'RecurrenceType', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'none',
    });
    await queryInterface.addColumn('Tasks', 'RecurrenceStart', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Tasks', 'RecurrenceEnd', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      defaultValue: null,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Tasks', 'RecurrenceType');
    await queryInterface.removeColumn('Tasks', 'RecurrenceStart');
    await queryInterface.removeColumn('Tasks', 'RecurrenceEnd');
  },
};
