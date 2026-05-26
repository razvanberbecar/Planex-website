// ──────────────────────────────────────────────────────────────
// Cache Service — In-memory LRU cache with TTL
// Used by the optimized statistics endpoint to reduce DB load.
// ──────────────────────────────────────────────────────────────

const NodeCache = require('node-cache');

// Default TTL: 60 seconds, check period: 120 seconds
const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false,
});

/**
 * Get a value from cache.
 * @param {string} key
 * @returns {*} Cached value or undefined
 */
function get(key) {
  const value = cache.get(key);
  if (value !== undefined) {
    console.log(`[Cache] HIT for key: ${key}`);
  }
  return value;
}

/**
 * Set a value in cache with optional custom TTL.
 * @param {string} key
 * @param {*} value
 * @param {number} [ttlSeconds] — Custom TTL, defaults to 60
 */
function set(key, value, ttlSeconds = 60) {
  cache.set(key, value, ttlSeconds);
  console.log(`[Cache] SET key: ${key} (TTL: ${ttlSeconds}s)`);
}

/**
 * Delete a specific key from cache.
 * @param {string} key
 */
function del(key) {
  cache.del(key);
  console.log(`[Cache] DEL key: ${key}`);
}

/**
 * Flush entire cache.
 */
function flush() {
  cache.flushAll();
  console.log('[Cache] FLUSHED all entries');
}

/**
 * Get cache statistics.
 * @returns {object} { keys, hits, misses, kbps }
 */
function stats() {
  const s = cache.getStats();
  return {
    keys: cache.keys().length,
    hits: s.hits,
    misses: s.misses,
    hitRate: s.hits + s.misses > 0
      ? ((s.hits / (s.hits + s.misses)) * 100).toFixed(1) + '%'
      : '0%',
  };
}

module.exports = { get, set, del, flush, stats };
