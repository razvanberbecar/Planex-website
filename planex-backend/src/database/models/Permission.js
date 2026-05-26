// ──────────────────────────────────────────────────────────────
// Model: Permission
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Permission extends Model {
    static associate(models) {
      // Permission M──M Role (through RolePermissions)
      Permission.belongsToMany(models.Role, {
        through: 'RolePermissions',
        foreignKey: 'PermissionId',
        otherKey: 'RoleId',
        as: 'roles',
      });
    }
  }

  Permission.init(
    {
      PermissionId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      Name: {
        type: DataTypes.STRING(100),
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
      tableName: 'Permissions',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    }
  );

  return Permission;
};
