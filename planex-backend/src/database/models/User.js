// ──────────────────────────────────────────────────────────────
// Model: User
// Supports local auth (email/password), OAuth, API key auth,
// password reset, account lockout, and 2FA.
// ──────────────────────────────────────────────────────────────

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // User belongs to Role
      User.belongsTo(models.Role, { foreignKey: 'RoleId', as: 'role' });

      // User has many Tasks (as creator/owner)
      User.hasMany(models.Task, { foreignKey: 'CreatedBy', as: 'tasks' });

      // User has many Sessions
      User.hasMany(models.Session, { foreignKey: 'UserId', as: 'sessions' });
    }
  }

  User.init(
    {
      UserId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      Name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      Email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      Password: {
        type: DataTypes.STRING(255),
        allowNull: true, // nullable for OAuth users
      },
      RoleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
      },
      // ── API Key ──────────────────────────────────────────
      ApiKey: {
        type: DataTypes.STRING(128),
        allowNull: true,
        unique: true,
      },
      // ── OAuth ────────────────────────────────────────────
      OAuthProvider: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      OAuthId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      // ── Password Reset ───────────────────────────────────
      PasswordResetToken: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      PasswordResetExpires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // ── Account Lockout ──────────────────────────────────
      FailedLoginAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      LockedUntil: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // ── 2FA ──────────────────────────────────────────────
      TwoFactorSecret: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      TwoFactorEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // ── Last Login ───────────────────────────────────────
      LastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      LastLoginIp: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'Users',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    }
  );

  return User;
};
