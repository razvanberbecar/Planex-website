// ──────────────────────────────────────────────────────────────
// Model: SuspiciousActivity
// Stores detected malicious/suspicious behaviour per user.
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SuspiciousActivity extends Model {
    static associate(models) {
      // SuspiciousActivity belongs to User (the suspect)
      SuspiciousActivity.belongsTo(models.User, { foreignKey: 'UserId', as: 'user' });

      // SuspiciousActivity belongs to ActivityLog (optional)
      SuspiciousActivity.belongsTo(models.ActivityLog, { foreignKey: 'ActivityLogId', as: 'activityLog' });

      // SuspiciousActivity belongs to Reviewer (User)
      SuspiciousActivity.belongsTo(models.User, { foreignKey: 'ReviewedBy', as: 'reviewer' });
    }
  }

  SuspiciousActivity.init(
    {
      SuspiciousActivityId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      UserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      ActivityLogId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      RuleTriggered: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      Severity: {
        type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
        allowNull: false,
        defaultValue: 'MEDIUM',
      },
      Details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      IsReviewed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      DetectedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      ReviewedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ReviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'SuspiciousActivities',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    }
  );

  return SuspiciousActivity;
};
