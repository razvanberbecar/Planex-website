const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserFlag extends Model {
    static associate(models) {
      UserFlag.belongsTo(models.User, { foreignKey: 'UserId', as: 'user' });
    }
  }

  UserFlag.init({
    FlagId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    Reason: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    Detail: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    tableName: 'UserFlags',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: false,
  });

  return UserFlag;
};
