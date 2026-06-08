// ──────────────────────────────────────────────────────────────
// Log Service
// Core service for logging every user action to the ActivityLogs
// table and triggering the malicious behaviour detection engine.
//
// Usage:
//   const logService = require('./services/logService');
//   await logService.log(userId, 'CREATE_TASK', { resourceType: 'Task', resourceId: 123, ... });
// ──────────────────────────────────────────────────────────────

const { ActivityLog } = require('../database/models');

/**
 * Known action constants — use these instead of raw strings.
 * @readonly
 * @enum {string}
 */
const Actions = Object.freeze({
  // ── Auth ──
  LOGIN:              'LOGIN',
  LOGIN_FAILED:       'LOGIN_FAILED',
  REGISTER:           'REGISTER',
  LOGOUT:             'LOGOUT',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET:         'PASSWORD_RESET',
  PASSWORD_CHANGED:       'PASSWORD_CHANGED',
  PROFILE_UPDATED:        'PROFILE_UPDATED',
  API_KEY_GENERATED:      'API_KEY_GENERATED',
  API_KEY_REVOKED:        'API_KEY_REVOKED',
  SESSION_REVOKED:        'SESSION_REVOKED',
  ALL_SESSIONS_REVOKED:   'ALL_SESSIONS_REVOKED',

  // ── Tasks ──
  CREATE_TASK:        'CREATE_TASK',
  VIEW_TASK:          'VIEW_TASK',
  VIEW_TASKS:         'VIEW_TASKS',
  UPDATE_TASK:        'UPDATE_TASK',
  DELETE_TASK:        'DELETE_TASK',
  TOGGLE_TASK:        'TOGGLE_TASK',

  // ── Subtasks ──
  CREATE_SUBTASK:     'CREATE_SUBTASK',
  UPDATE_SUBTASK:     'UPDATE_SUBTASK',
  DELETE_SUBTASK:     'DELETE_SUBTASK',

  // ── Statistics ──
  VIEW_STATISTICS:    'VIEW_STATISTICS',

  // ── Admin / Observation ──
  VIEW_OBSERVATION_LIST:    'VIEW_OBSERVATION_LIST',
  REVIEW_SUSPICIOUS_ACTIVITY: 'REVIEW_SUSPICIOUS_ACTIVITY',
  CLEAR_OBSERVATION:         'CLEAR_OBSERVATION',
  RESTRICT_USER:             'RESTRICT_USER',
  UNRESTRICT_USER:           'UNRESTRICT_USER',
  VIEW_USERS:                'VIEW_USERS',
  UPDATE_USER_ROLE:          'UPDATE_USER_ROLE',

  // ── WebSocket ──
  WS_JOIN:            'WS_JOIN',
  WS_CHAT_MESSAGE:    'WS_CHAT_MESSAGE',
});

/**
 * Log a user action to the database and run the detection engine.
 *
 * @param {object} options
 * @param {number} options.userId        — Required. ID of the user performing the action.
 * @param {string} options.action        — Required. One of Actions.* constants.
 * @param {string} [options.resourceType] — e.g. 'Task', 'Subtask', 'User'
 * @param {number} [options.resourceId]   — ID of the affected resource.
 * @param {object|string} [options.details] — Additional context (will be JSON-stringified if object).
 * @param {string} [options.ipAddress]    — Client IP address.
 * @param {string} [options.userAgent]    — User-Agent header.
 * @returns {Promise<object>} The created ActivityLog row.
 */
async function log({
  userId,
  action,
  resourceType = null,
  resourceId   = null,
  details      = null,
  ipAddress    = null,
  userAgent    = null,
}) {
  if (!userId) {
    console.warn('[LogService] log() called without userId — skipping.');
    return null;
  }
  if (!action) {
    console.warn('[LogService] log() called without action — skipping.');
    return null;
  }

  // Stringify details if it's an object
  const detailsStr = details !== null && typeof details === 'object'
    ? JSON.stringify(details)
    : details;

  // Create the log entry
  const logEntry = await ActivityLog.create({
    UserId:       userId,
    Action:       action,
    ResourceType: resourceType,
    ResourceId:   resourceId,
    Details:      detailsStr,
    IpAddress:    ipAddress,
    UserAgent:    userAgent,
    Timestamp:    new Date(),
  });

  return logEntry;
}

/**
 * Convenience wrapper: log and return a middleware-compatible function.
 * Useful for inline logging in route handlers.
 */
function logMiddleware(action, resourceType = null) {
  return async (req, res, next) => {
    // Extract userId from wherever it's available (query, body, future JWT)
    const userId = req.query.userId || req.body.userId || req.headers['x-user-id'];
    if (userId) {
      log({
        userId:       Number(userId),
        action,
        resourceType,
        ipAddress:    req.ip || req.connection?.remoteAddress,
        userAgent:    req.headers['user-agent'],
      }).catch(err => console.error('[LogService] Middleware log error:', err.message));
    }
    next();
  };
}

module.exports = {
  log,
  logMiddleware,
  Actions,
};
