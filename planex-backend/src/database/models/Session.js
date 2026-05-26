// ──────────────────────────────────────────────────────────────
// Model: Session
// Persistent session storage for JWT refresh tokens.
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Session extends Model {
    static associate(models) {
      // Session belongs to User
      Session.belongsTo(models.User, { foreignKey: 'UserId', as: 'user' });
    }
  }

  Session.init(
    {
      SessionId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      UserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'UserId' },
      },
      Token: {
        type: DataTypes.STRING(512),
        allowNull: false,
      },
      RefreshToken: {
        type: DataTypes.STRING(512),
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
      DeviceName: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      LastActivity: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      ExpiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      IsRevoked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      RevokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'Sessions',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    }
  );

  return Session;
};
