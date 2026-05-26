// ──────────────────────────────────────────────────────────────
// Model: ObservationList
// Tracks users placed under observation due to suspicious activity.
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ObservationList extends Model {
    static associate(models) {
      // ObservationList belongs to User (the observed user)
      ObservationList.belongsTo(models.User, { foreignKey: 'UserId', as: 'observedUser' });

      // ObservationList belongs to User (the admin who added)
      ObservationList.belongsTo(models.User, { foreignKey: 'AddedBy', as: 'addedByAdmin' });

      // ObservationList belongs to SuspiciousActivity (optional)
      ObservationList.belongsTo(models.SuspiciousActivity, { foreignKey: 'SuspiciousActivityId', as: 'suspiciousActivity' });
    }
  }

  ObservationList.init(
    {
      ObservationId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      UserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      AddedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      Reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      Status: {
        type: DataTypes.ENUM('UNDER_OBSERVATION', 'CLEARED', 'RESTRICTED'),
        allowNull: false,
        defaultValue: 'UNDER_OBSERVATION',
      },
      SuspiciousActivityId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      StartedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      EndedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      Notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'ObservationList',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    }
  );

  return ObservationList;
};
