// ──────────────────────────────────────────────────────────────
// Model: ActivityLog
// Persists every action performed by a logged-in user.
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ActivityLog extends Model {
    static associate(models) {
      // ActivityLog belongs to User
      ActivityLog.belongsTo(models.User, { foreignKey: 'UserId', as: 'user' });

      // ActivityLog has many SuspiciousActivities (optional)
      ActivityLog.hasMany(models.SuspiciousActivity, { foreignKey: 'ActivityLogId', as: 'suspiciousActivities' });
    }
  }

  ActivityLog.init(
    {
      LogId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      UserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      Action: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      ResourceType: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      ResourceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      Details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      IpAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      UserAgent: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      Timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'ActivityLogs',
      timestamps: false, // We manage Timestamp manually
    }
  );

  return ActivityLog;
};
