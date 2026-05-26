// ──────────────────────────────────────────────────────────────
// Sequelize Configuration — PostgreSQL
// Connection details for PlanexDB on PostgreSQL.
// Uses environment variables with sensible defaults for local dev.
// ──────────────────────────────────────────────────────────────

module.exports = {
  development: {
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'planex_dev',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false,
      } : false,
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 5,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      freezeTableName: true,
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    },
    logging: false,
  },
  test: {
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'planex_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false,
      } : false,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      freezeTableName: true,
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    },
    logging: false,
  },
  production: {
    // In production, prefer DATABASE_URL for simplicity (e.g., Render, Railway, Fly.io)
    // or set individual DB_* env vars.
    use_env_variable: process.env.DATABASE_URL ? 'DATABASE_URL' : undefined,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'planex_prod',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      freezeTableName: true,
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    },
    logging: false,
  },
};
