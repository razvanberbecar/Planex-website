// ──────────────────────────────────────────────────────────────
// Authentication & Authorization Middleware
// Supports three authentication methods:
//   1. JWT (Bearer token) — primary method
//   2. API Key (X-API-Key header) — for programmatic access
//   3. OAuth2 (via social login providers)
// Includes persistent session management, inactivity tracking,
// role-based and permission-based authorization.
// ──────────────────────────────────────────────────────────────

const jwt           = require('jsonwebtoken');
const crypto        = require('crypto');
const { User, Role, Permission, Session } = require('../database/models');
const { Op }        = require('sequelize');

// ── JWT Configuration ───────────────────────────────────────

const JWT_SECRET            = process.env.JWT_SECRET            || 'planex-jwt-secret-dev-only-change-in-production';
const JWT_REFRESH_SECRET    = process.env.JWT_REFRESH_SECRET    || 'planex-refresh-secret-dev-only-change-in-production';
const ACCESS_TOKEN_EXPIRY   = process.env.ACCESS_TOKEN_EXPIRY   || '15m';
const REFRESH_TOKEN_EXPIRY  = process.env.REFRESH_TOKEN_EXPIRY  || '7d';
const INACTIVITY_TIMEOUT_MS = Number(process.env.INACTIVITY_TIMEOUT_MS) || 30 * 60 * 1000;

// ── Account Lockout Configuration ──────────────────────────
const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_DURATION_MS       = Number(process.env.LOCKOUT_DURATION_MS) || 15 * 60 * 1000; // 15 min

// ── Token Generation ────────────────────────────────────────

/**
 * Generate an access token (short-lived JWT).
 * @param {object} payload - { UserId, RoleId, roleName }
 * @returns {string} JWT access token
 */
function generateAccessToken(payload) {
  const tokenPayload = { ...payload, jti: crypto.randomUUID() };
  return jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Generate a refresh token (long-lived JWT).
 * @param {object} payload - { UserId }
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(payload) {
  const tokenPayload = { ...payload, jti: crypto.randomUUID() };
  return jwt.sign(tokenPayload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

/**
 * Verify a refresh token and generate a new access/refresh token pair.
 * @param {string} token - The refresh JWT to verify
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function refreshAccessToken(token) {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  const tokenPayload = {
    UserId: decoded.UserId,
    RoleId: decoded.RoleId,
    roleName: decoded.roleName || 'user',
  };
  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken({ UserId: decoded.UserId });
  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

/**
 * Generate a unique API key.
 * @returns {string} api_key_{random hex}
 */
function generateApiKey() {
  return 'planex_api_' + crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a password reset token.
 * @returns {string} random hex token
 */
function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Session Management ─────────────────────────────────────

/**
 * Create a persistent session record in the database.
 * @param {object} opts - { userId, accessToken, refreshToken, ipAddress, userAgent, deviceName }
 * @returns {Promise<object>} created Session
 */
async function createSession(opts) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return Session.create({
    UserId:       opts.userId,
    Token:        opts.accessToken,
    RefreshToken: opts.refreshToken || null,
    IpAddress:    opts.ipAddress || null,
    UserAgent:    opts.userAgent || null,
    DeviceName:   opts.deviceName || null,
    LastActivity: new Date(),
    ExpiresAt:    expiresAt,
    IsRevoked:    false,
  });
}

/**
 * Revoke a specific session by token.
 * @param {string} token - JWT access token (hashed lookup)
 * @returns {Promise<void>}
 */
async function revokeSession(token) {
  await Session.update(
    { IsRevoked: true, RevokedAt: new Date() },
    { where: { Token: token } }
  );
}

/**
 * Revoke all sessions for a user (used on password change / full logout).
 * @param {number} userId
 * @param {number} [excludeSessionId] - optional session ID to keep
 * @returns {Promise<void>}
 */
async function revokeAllUserSessions(userId, excludeSessionId) {
  const where = { UserId: userId, IsRevoked: false };
  if (excludeSessionId) {
    where.SessionId = { [Op.ne]: excludeSessionId };
  }
  await Session.update(
    { IsRevoked: true, RevokedAt: new Date() },
    { where }
  );
}

/**
 * Get all active (non-revoked, non-expired) sessions for a user.
 * @param {number} userId
 * @returns {Promise<Array>} active sessions
 */
async function getUserSessions(userId) {
  return Session.findAll({
    where: {
      UserId: userId,
      IsRevoked: false,
      ExpiresAt: { [Op.gt]: new Date() },
    },
    attributes: ['SessionId', 'IpAddress', 'UserAgent', 'DeviceName', 'LastActivity', 'CreatedAt'],
    order: [['LastActivity', 'DESC']],
  });
}

/**
 * Clean up expired sessions from the database.
 * @returns {Promise<number>} number of deleted sessions
 */
async function cleanExpiredSessions() {
  const deleted = await Session.destroy({
    where: {
      ExpiresAt: { [Op.lte]: new Date() },
    },
  });
  return deleted;
}

// ── Authentication Strategies ──────────────────────────────

/**
 * Authenticate via JWT Bearer token.
 * @param {string} token
 * @returns {Promise<object|null>} decoded payload or null
 */
async function authenticateJwt(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Check if session is still valid (not revoked)
    const session = await Session.findOne({
      where: { Token: token, IsRevoked: false },
    });
    if (!session) {
      return null;
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Authenticate via API Key.
 * @param {string} apiKey
 * @returns {Promise<object|null>} { UserId, RoleId, roleName } or null
 */
async function authenticateApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('planex_api_')) return null;
  const user = await User.findOne({
    where: { ApiKey: apiKey },
    include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name'] }],
  });
  if (!user) return null;
  return {
    UserId:   user.UserId,
    RoleId:   user.RoleId,
    roleName: user.role?.Name || 'user',
  };
}

/**
 * Authenticate via OAuth provider.
 * @param {string} provider - e.g. 'google', 'github'
 * @param {string} oauthId  - the provider's user ID
 * @returns {Promise<object|null>} { UserId, RoleId, roleName } or null
 */
async function authenticateOAuth(provider, oauthId) {
  if (!provider || !oauthId) return null;
  const user = await User.findOne({
    where: { OAuthProvider: provider, OAuthId: oauthId },
    include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name'] }],
  });
  if (!user) return null;
  return {
    UserId:   user.UserId,
    RoleId:   user.RoleId,
    roleName: user.role?.Name || 'user',
  };
}

// ── Main Authentication Middleware ─────────────────────────

/**
 * Main authentication middleware.
 * Tries JWT Bearer token first, then API Key, then OAuth (via headers).
 * Attaches decoded user to req.user on success.
 *
 * Headers checked:
 *   Authorization: Bearer <jwt>          (JWT auth)
 *   X-API-Key: <api_key>                 (API key auth)
 *   X-OAuth-Provider: <provider>         (OAuth auth - requires also X-OAuth-Id)
 *   X-OAuth-Id: <oauth_user_id>
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey     = req.headers['x-api-key'];
  const oauthProv  = req.headers['x-oauth-provider'];
  const oauthId    = req.headers['x-oauth-id'];

  let userPayload = null;

  // ── Strategy 1: JWT Bearer token ─────────────────────────
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    userPayload = await authenticateJwt(token);
    if (userPayload) {
      req.token = token;
      return attachUser(req, res, next, userPayload);
    }
  }

  // ── Strategy 2: API Key ─────────────────────────────────
  if (apiKey) {
    userPayload = await authenticateApiKey(apiKey);
    if (userPayload) {
      req.authMethod = 'api_key';
      return attachUser(req, res, next, userPayload);
    }
  }

  // ── Strategy 3: OAuth ────────────────────────────────────
  if (oauthProv && oauthId) {
    userPayload = await authenticateOAuth(oauthProv, oauthId);
    if (userPayload) {
      req.authMethod = 'oauth';
      return attachUser(req, res, next, userPayload);
    }
  }

  // ── No valid authentication found ────────────────────────
  return res.status(401).json({ error: 'Authentication required. Provide a valid JWT, API Key, or OAuth credentials.' });
}

/**
 * Attach user payload to request and proceed.
 */
function attachUser(req, res, next, userPayload) {
  req.user = {
    UserId:   userPayload.UserId,
    RoleId:   userPayload.RoleId,
    roleName: userPayload.roleName,
  };
  next();
}

/**
 * Optional authentication - tries all strategies but does NOT block
 * if none succeeds. Attaches null to req.user if unauthenticated.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey     = req.headers['x-api-key'];
  const oauthProv  = req.headers['x-oauth-provider'];
  const oauthId    = req.headers['x-oauth-id'];

  let userPayload = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    userPayload = await authenticateJwt(token);
    if (userPayload) req.token = token;
  }

  if (!userPayload && apiKey) {
    userPayload = await authenticateApiKey(apiKey);
    if (userPayload) req.authMethod = 'api_key';
  }

  if (!userPayload && oauthProv && oauthId) {
    userPayload = await authenticateOAuth(oauthProv, oauthId);
    if (userPayload) req.authMethod = 'oauth';
  }

  if (userPayload) {
    req.user = {
      UserId:   userPayload.UserId,
      RoleId:   userPayload.RoleId,
      roleName: userPayload.roleName,
    };
  } else {
    req.user = null;
  }

  next();
}

// ── Authorization Middleware ─────────────────────────────────

/**
 * Require the authenticated user to have a specific role.
 * @param  {...string} allowedRoles
 * @returns {function} Express middleware
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.roleName)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.roleName}.`,
      });
    }
    next();
  };
}

/**
 * Require a specific permission (looked up via User's Role).
 * @param {string} permissionName
 * @returns {function} Express middleware
 */
function requirePermission(permissionName) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const user = await User.findByPk(req.user.UserId, {
        include: [{
          model: Role,
          as: 'role',
          include: [{
            model: Permission,
            as: 'permissions',
            attributes: ['Name'],
            through: { attributes: [] },
          }],
        }],
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found.' });
      }

      const permissions = user.role?.permissions || [];
      const hasPermission = permissions.some(p => p.Name === permissionName);

      if (!hasPermission) {
        return res.status(403).json({ error: `Access denied. Required permission: ${permissionName}.` });
      }

      next();
    } catch (err) {
      console.error('[Auth Middleware] Permission check error:', err.message);
      res.status(500).json({ error: 'Authorization check failed.' });
    }
  };
}

/**
 * Middleware that requires admin role.
 * Uses the roleName from JWT for fast check, plus a DB lookup for security.
 */
async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Fast check from JWT payload
  if (req.user.roleName !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  // Verify from database
  const user = await User.findByPk(req.user.UserId, {
    include: [{ model: Role, as: 'role', attributes: ['Name'] }],
  });

  if (!user || !user.role || user.role.Name !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  req.adminUser = user;
  next();
}

// ── Inactivity Tracking ─────────────────────────────────────

const lastActivity = new Map();

function updateLastActivity(req, res, next) {
  if (req.user) {
    lastActivity.set(req.user.UserId, Date.now());
    // Also update DB session LastActivity if we have a token
    if (req.token) {
      Session.update(
        { LastActivity: new Date() },
        { where: { Token: req.token } }
      ).catch(() => {});
    }
  }
  next();
}

function isInactive(userId) {
  const last = lastActivity.get(userId);
  if (!last) return true;
  return (Date.now() - last) > INACTIVITY_TIMEOUT_MS;
}

function clearActivity(userId) {
  lastActivity.delete(userId);
}

// ── Account Lockout ─────────────────────────────────────────

/**
 * Check if a user's account is locked.
 * @param {object} user - User model instance
 * @returns {boolean}
 */
function isAccountLocked(user) {
  if (!user.LockedUntil) return false;
  return new Date() < new Date(user.LockedUntil);
}

/**
 * Record a failed login attempt and lock account if threshold exceeded.
 * @param {object} user - User model instance
 * @returns {Promise<boolean>} true if account is now locked
 */
async function recordFailedLogin(user) {
  const attempts = (user.FailedLoginAttempts || 0) + 1;
  const updateData = { FailedLoginAttempts: attempts };

  if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    updateData.LockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }

  await User.update(updateData, { where: { UserId: user.UserId } });
  return attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
}

/**
 * Reset failed login counter on successful login.
 * @param {number} userId
 */
async function resetFailedLogin(userId) {
  await User.update(
    { FailedLoginAttempts: 0, LockedUntil: null },
    { where: { UserId: userId } }
  );
}

// ── Token Matching for Session ↔ JWT ──────────────────────

/**
 * Hash a token for secure storage comparison.
 * @param {string} token
 * @returns {string} sha256 hash
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Exports ─────────────────────────────────────────────────

module.exports = {
  // Token generation
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  generateApiKey,
  generatePasswordResetToken,

  // Main auth middleware
  authenticate,
  optionalAuth,

  // Authorization middleware
  authorize,
  requirePermission,
  requireAdmin,

  // Inactivity tracking
  updateLastActivity,
  isInactive,
  clearActivity,
  INACTIVITY_TIMEOUT_MS,

  // Session management
  createSession,
  revokeSession,
  revokeAllUserSessions,
  getUserSessions,
  cleanExpiredSessions,

  // Account lockout
  isAccountLocked,
  recordFailedLogin,
  resetFailedLogin,
  MAX_FAILED_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,

  // Token helpers
  hashToken,

  // Config
  JWT_SECRET,
  JWT_REFRESH_SECRET,
};
