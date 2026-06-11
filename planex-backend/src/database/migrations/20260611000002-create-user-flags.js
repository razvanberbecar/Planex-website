'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('UserFlags', {
      FlagId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      UserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      Reason: {
        // 'toxic_chat' | 'brute_force'
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      Detail: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      CreatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('UserFlags', ['UserId']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('UserFlags');
  },
};
