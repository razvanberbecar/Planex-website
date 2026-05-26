// ──────────────────────────────────────────────────────────────
// Model: RolePermission (Join Table)
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RolePermission extends Model {
    static associate(models) {
      // RolePermission belongs to Role
      RolePermission.belongsTo(models.Role, { foreignKey: 'RoleId', as: 'role' });
      // RolePermission belongs to Permission
      RolePermission.belongsTo(models.Permission, { foreignKey: 'PermissionId', as: 'permission' });
    }
  }

  RolePermission.init(
    {
      RolePermissionId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      RoleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Roles', key: 'RoleId' },
      },
      PermissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Permissions', key: 'PermissionId' },
      },
    },
    {
      sequelize,
      tableName: 'RolePermissions',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    }
  );

  return RolePermission;
};
