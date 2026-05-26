// ──────────────────────────────────────────────────────────────
// MongoDB Connection  —  used for Real-Time Chat persistence
// ──────────────────────────────────────────────────────────────

const { MongoClient } = require('mongodb');

const MONGO_URI  = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME    = 'planex_chat';

let client   = null;
let db       = null;

/**
 * Connect to MongoDB and return the database handle.
 * Creates the connection once and reuses it on subsequent calls.
 */
async function connectMongo() {
  if (db) return db;

  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);

    // Ensure indexes on the messages collection
    const messages = db.collection('messages');
    await messages.createIndex({ timestamp: -1 });
    await messages.createIndex({ room: 1, timestamp: -1 });

    console.log('[MongoDB] Connected to', DB_NAME);
    return db;
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message);
    throw err;
  }
}

/**
 * Get the current MongoDB database handle.
 */
function getDb() {
  return db;
}

/**
 * Gracefully close the MongoDB connection.
 */
async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db     = null;
    console.log('[MongoDB] Connection closed');
  }
}

module.exports = { connectMongo, getDb, closeMongo };
