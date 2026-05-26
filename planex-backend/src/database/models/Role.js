// ──────────────────────────────────────────────────────────────
// Model: Role
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    static associate(models) {
      // Role 1──M User
      Role.hasMany(models.User, { foreignKey: 'RoleId', as: 'users' });

      // Role M──M Permission (through RolePermissions)
      Role.belongsToMany(models.Permission, {
        through: 'RolePermissions',
        foreignKey: 'RoleId',
        otherKey: 'PermissionId',
        as: 'permissions',
      });
    }
  }

  Role.init(
    {
      RoleId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      Name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      Description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'Roles',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    }
  );

  return Role;
};
