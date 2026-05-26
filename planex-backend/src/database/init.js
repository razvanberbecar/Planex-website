// ──────────────────────────────────────────────────────────────
// Database Initialization
// Connects Sequelize to PostgreSQL and authenticates.
// ──────────────────────────────────────────────────────────────

const { sequelize } = require('./models');

async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('[DB] Connected to PlanexDB on PostgreSQL');
    return true;
  } catch (err) {
    console.error('[DB] Failed to connect:', err.message);
    throw err;
  }
}

async function closeDatabase() {
  try {
    await sequelize.close();
    console.log('[DB] Connection closed');
  } catch (err) {
    console.error('[DB] Error closing connection:', err.message);
  }
}

module.exports = { initDatabase, closeDatabase };
