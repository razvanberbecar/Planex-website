// ──────────────────────────────────────────────────────────────
// Auth Routes
// Provides three-way authentication:
//   1. Local (email/password with bcrypt)
//   2. OAuth2 (Google, GitHub)
//   3. API Key authentication
// Plus password recovery, session management, 2FA setup,
// and email-based verification code authentication.
// ──────────────────────────────────────────────────────────────

const { Router }     = require('express');
const bcrypt         = require('bcryptjs');
const crypto         = require('crypto');
const rateLimit      = require('express-rate-limit');
const { User, Role, Session } = require('../database/models');
const logService     = require('../services/logService');
const auth           = require('../middleware/auth');
const { sendVerificationCode, sendPasswordResetEmail } = require('../services/emailService');

const router = Router();

// ── Rate Limiting ───────────────────────────────────────────

// Increase limits during Vitest runs so tests can create multiple users
const IS_TEST = !!process.env.VITEST;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_TEST ? 1000 : 20,
  message: { error: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: IS_TEST ? 1000 : 5,
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: IS_TEST ? 1000 : 3,
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const SALT_ROUNDS = 12;

// ══════════════════════════════════════════════════════════════
// 1. LOCAL AUTHENTICATION
// ══════════════════════════════════════════════════════════════

// ── POST /api/auth/register ─────────────────────────────────
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const existing = await User.findOne({ where: { Email: email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const userRole = await Role.findOne({ where: { Name: 'user' } });
    if (!userRole) {
      return res.status(500).json({ error: 'Default user role not found. Please run the seeder.' });
    }

    const user = await User.create({
      Name:     name,
      Email:    email,
      Password: hashedPassword,
      RoleId:   userRole.RoleId,
    });

    const tokenPayload = { UserId: user.UserId, RoleId: user.RoleId, roleName: 'user' };
    const accessToken  = auth.generateAccessToken(tokenPayload);
    const refreshToken = auth.generateRefreshToken({ UserId: user.UserId });

    // Create persistent session
    await auth.createSession({
      userId:    user.UserId,
      accessToken,
      refreshToken,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await logService.log({
      userId: user.UserId,
      action: logService.Actions.REGISTER,
      resourceType: 'User',
      resourceId: user.UserId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(err => console.error('[Auth] Log error:', err.message));

    // Mark user as active so isInactive() returns false for /me etc.
    auth.updateLastActivity({ user: { UserId: user.UserId } }, null, () => {});

    res.status(201).json({
      message: 'Registration successful.',
      user: {
        UserId: user.UserId,
        Name:   user.Name,
        Email:  user.Email,
        RoleId: user.RoleId,
        role:   { RoleId: userRole.RoleId, Name: 'user', Description: userRole.Description },
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({
      where: { Email: email },
      include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name', 'Description'] }],
    });

    if (!user) {
      await logService.log({
        userId: 0,
        action: logService.Actions.LOGIN_FAILED,
        resourceType: 'User',
        details: { attemptedEmail: email, reason: 'user_not_found' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(() => {});
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check account lockout
    if (auth.isAccountLocked(user)) {
      const lockedUntil = new Date(user.LockedUntil);
      const minutesLeft = Math.ceil((lockedUntil - new Date()) / 60000);
      return res.status(423).json({
        error: `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.Password);
    if (!passwordMatch) {
      // Record failed attempt
      const locked = await auth.recordFailedLogin(user);
      await logService.log({
        userId: user.UserId,
        action: logService.Actions.LOGIN_FAILED,
        resourceType: 'User',
        resourceId: user.UserId,
        details: { reason: 'wrong_password', attemptsLeft: locked ? 0 : auth.MAX_FAILED_LOGIN_ATTEMPTS - (user.FailedLoginAttempts + 1) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(() => {});
      if (locked) {
        return res.status(423).json({
          error: 'Account locked due to too many failed attempts. Try again in 15 minutes.',
          code: 'ACCOUNT_LOCKED',
        });
      }
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Reset failed login counter
    await auth.resetFailedLogin(user.UserId);

    // Generate tokens
    const roleName = user.role?.Name || 'user';
    const tokenPayload = { UserId: user.UserId, RoleId: user.RoleId, roleName };
    const accessToken  = auth.generateAccessToken(tokenPayload);
    const refreshToken = auth.generateRefreshToken({ UserId: user.UserId });

    // Create persistent session
    const session = await auth.createSession({
      userId:    user.UserId,
      accessToken,
      refreshToken,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Update last login
    await User.update(
      { LastLoginAt: new Date(), LastLoginIp: req.ip },
      { where: { UserId: user.UserId } }
    );

    auth.updateLastActivity({ user: { UserId: user.UserId } }, null, () => {});

    await logService.log({
      userId: user.UserId,
      action: logService.Actions.LOGIN,
      resourceType: 'User',
      resourceId: user.UserId,
      details: { role: roleName, sessionId: session.SessionId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    const { Password, ...userData } = user.toJSON();
    res.json({
      message: 'Login successful.',
      user: userData,
      accessToken,
      refreshToken,
      sessionId: session.SessionId,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message || '(no message)');
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ── POST /api/auth/logout ───────────────────────────────────
router.post('/logout', auth.authenticate, async (req, res) => {
  try {
    // Revoke the session
    if (req.token) {
      await auth.revokeSession(req.token);
    }

    auth.clearActivity(req.user.UserId);

    await logService.log({
      userId: req.user.UserId,
      action: logService.Actions.LOGOUT,
      resourceType: 'User',
      resourceId: req.user.UserId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({ message: 'Logout successful.' });
  } catch (err) {
    console.error('[Auth] Logout error:', err.message);
    res.status(500).json({ error: 'Logout failed.' });
  }
});

// ── POST /api/auth/refresh ──────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    const tokens = auth.refreshAccessToken(refreshToken);

    // Update session with new tokens
    // Find the session by old refresh token (hashed)
    const session = await Session.findOne({
      where: { RefreshToken: refreshToken, IsRevoked: false },
    });
    if (session) {
      await Session.update(
        { Token: tokens.accessToken, RefreshToken: tokens.refreshToken, LastActivity: new Date() },
        { where: { SessionId: session.SessionId } }
      );
    }

    res.json({
      message: 'Token refreshed successfully.',
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired. Please login again.', code: 'REFRESH_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }
    console.error('[Auth] Refresh error:', err.message);
    res.status(500).json({ error: 'Token refresh failed.' });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────
router.get('/me', auth.authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.UserId, {
      attributes: { exclude: ['Password', 'ApiKey', 'PasswordResetToken', 'PasswordResetExpires', 'TwoFactorSecret'] },
      include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name', 'Description'] }],
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (auth.isInactive(user.UserId)) {
      return res.status(401).json({ error: 'Session expired due to inactivity. Please login again.', code: 'INACTIVITY_TIMEOUT' });
    }

    auth.updateLastActivity({ user: { UserId: user.UserId } }, null, () => {});
    res.json(user);
  } catch (err) {
    console.error('[Auth] Me error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// ── POST /api/auth/check-inactivity ─────────────────────────
router.post('/check-inactivity', auth.authenticate, (req, res) => {
  const inactive = auth.isInactive(req.user.UserId);
  if (inactive) {
    auth.clearActivity(req.user.UserId);
    return res.json({ inactive: true, message: 'Session expired due to inactivity.' });
  }
  auth.updateLastActivity({ user: { UserId: req.user.UserId } }, null, () => {});
  res.json({ inactive: false });
});

// ══════════════════════════════════════════════════════════════
// 2. PASSWORD RECOVERY
// ══════════════════════════════════════════════════════════════

// ── POST /api/auth/forgot-password ──────────────────────────
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await User.findOne({ where: { Email: email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = auth.generatePasswordResetToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await User.update(
      { PasswordResetToken: resetToken, PasswordResetExpires: resetExpires },
      { where: { UserId: user.UserId } }
    );

    // Build the frontend reset URL using Origin header, env var, or default
    const frontendUrl = req.get('Origin') || process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send the reset link by email (logs to console in dev, sends via SMTP in production)
    await sendPasswordResetEmail(email, user.Name, resetUrl, resetExpires);

    // Log the password reset request
    await logService.log({
      userId: user.UserId,
      action: logService.Actions.PASSWORD_RESET_REQUEST,
      resourceType: 'User',
      resourceId: user.UserId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    // In dev mode, also return the reset URL so the frontend can display it
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    res.json({
      message: 'If that email exists, a password reset link has been sent.',
      ...(isDev && { devResetUrl: resetUrl, devMode: true }),
    });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err.message);
    res.status(500).json({ error: 'Password reset request failed.' });
  }
});

// ── POST /api/auth/reset-password ───────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      return res.status(400).json({ error: 'Token, email, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const user = await User.findOne({
      where: { Email: email, PasswordResetToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token or email.' });
    }

    if (!user.PasswordResetExpires || new Date() > new Date(user.PasswordResetExpires)) {
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await User.update(
      {
        Password: hashedPassword,
        PasswordResetToken: null,
        PasswordResetExpires: null,
        FailedLoginAttempts: 0,
        LockedUntil: null,
      },
      { where: { UserId: user.UserId } }
    );

    // Revoke all existing sessions (force re-login)
    await auth.revokeAllUserSessions(user.UserId);

    await logService.log({
      userId: user.UserId,
      action: logService.Actions.PASSWORD_RESET,
      resourceType: 'User',
      resourceId: user.UserId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({ message: 'Password has been reset successfully. Please login with your new password.' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err.message);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

// ── GET /api/auth/verify-reset-token ────────────────────────
// Validate a reset token without consuming it
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token, email } = req.query;
    if (!token || !email) {
      return res.status(400).json({ error: 'Token and email are required.' });
    }

    const user = await User.findOne({
      where: { Email: email, PasswordResetToken: token },
    });

    if (!user) {
      return res.status(400).json({ valid: false, error: 'Invalid token.' });
    }

    if (!user.PasswordResetExpires || new Date() > new Date(user.PasswordResetExpires)) {
      return res.status(400).json({ valid: false, error: 'Token expired.' });
    }

    res.json({ valid: true });
  } catch (err) {
    console.error('[Auth] Verify reset token error:', err.message);
    res.status(500).json({ error: 'Token verification failed.' });
  }
});

// ══════════════════════════════════════════════════════════════
// 3. OAUTH2 AUTHENTICATION
// ══════════════════════════════════════════════════════════════

// ── POST /api/auth/oauth/:provider ─────────────────────────
// Authenticate or link an OAuth account.
// Body: { code, redirectUri } or { accessToken }
// For development, accepts a mock OAuth login with { email, name, oauthId }
router.post('/oauth/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { email, name, oauthId: providedOauthId } = req.body;

    const validProviders = ['google', 'github', 'microsoft', 'facebook', 'twitter'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: `Unsupported OAuth provider. Supported: ${validProviders.join(', ')}` });
    }

    // ── Development mode: accept mock OAuth data ───────────
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.OAUTH_DEV_MODE === 'true';
    if (isDev) {
      if (!email || !name || !providedOauthId) {
        return res.status(400).json({
          error: 'OAuth development mode requires email, name, and oauthId in body.',
          providers: validProviders,
        });
      }

      // Find or create user by OAuth provider + OAuth ID
      let user = await User.findOne({
        where: { OAuthProvider: provider, OAuthId: String(providedOauthId) },
        include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name', 'Description'] }],
      });

      if (!user) {
        // Check if email already exists (link OAuth to existing account)
        user = await User.findOne({
          where: { Email: email },
          include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name', 'Description'] }],
        });

        if (user) {
          // Link OAuth to existing account
          await User.update(
            { OAuthProvider: provider, OAuthId: String(providedOauthId) },
            { where: { UserId: user.UserId } }
          );
        } else {
          // Create new user with OAuth
          const userRole = await Role.findOne({ where: { Name: 'user' } });
          if (!userRole) {
            return res.status(500).json({ error: 'Default user role not found.' });
          }
          user = await User.create({
            Name: name,
            Email: email,
            Password: null, // OAuth users have no password
            RoleId: userRole.RoleId,
            OAuthProvider: provider,
            OAuthId: String(providedOauthId),
          });
          user = await User.findByPk(user.UserId, {
            include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name', 'Description'] }],
          });
        }
      }

      const roleName = user.role?.Name || 'user';
      const tokenPayload = { UserId: user.UserId, RoleId: user.RoleId, roleName };
      const accessToken  = auth.generateAccessToken(tokenPayload);
      const refreshToken = auth.generateRefreshToken({ UserId: user.UserId });

      await auth.createSession({
        userId: user.UserId,
        accessToken,
        refreshToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        deviceName: `OAuth:${provider}`,
      });

      await User.update(
        { LastLoginAt: new Date(), LastLoginIp: req.ip },
        { where: { UserId: user.UserId } }
      );

      await logService.log({
        userId: user.UserId,
        action: logService.Actions.LOGIN,
        resourceType: 'User',
        resourceId: user.UserId,
        details: { oauthProvider: provider },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(() => {});

      const { Password, ...userData } = user.toJSON();
      return res.json({
        message: `OAuth login via ${provider} successful.`,
        user: userData,
        accessToken,
        refreshToken,
      });
    }

    // ── Production: exchange authorization code for tokens ──
    // This would integrate with Passport.js or a provider SDK
    res.status(501).json({ error: 'Production OAuth flow not yet implemented. Enable OAUTH_DEV_MODE for development.' });
  } catch (err) {
    console.error('[Auth] OAuth error:', err.message);
    res.status(500).json({ error: 'OAuth authentication failed.' });
  }
});

// ── GET /api/auth/oauth/:provider/url ───────────────────────
// Returns the OAuth authorization URL for the given provider
router.get('/oauth/:provider/url', (req, res) => {
  const { provider } = req.params;
  const redirectUri = req.query.redirectUri || `${req.protocol}://${req.get('host')}/api/auth/oauth/${provider}/callback`;

  // In development, return a mock URL
  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.OAUTH_DEV_MODE === 'true';
  if (isDev) {
    return res.json({
      provider,
      authorizationUrl: `${req.protocol}://${req.get('host')}/api/auth/oauth/${provider}/dev-mock`,
      redirectUri,
      devMode: true,
      note: 'Use POST /api/auth/oauth/:provider with { email, name, oauthId } for dev authentication.',
    });
  }

  // Production OAuth URLs would be configured here
  const providerUrls = {
    google:    'https://accounts.google.com/o/oauth2/v2/auth',
    github:    'https://github.com/login/oauth/authorize',
    microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  };

  const baseUrl = providerUrls[provider];
  if (!baseUrl) {
    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  }

  const clientId = process.env[`OAUTH_${provider.toUpperCase()}_CLIENT_ID`];
  if (!clientId) {
    return res.status(500).json({ error: `OAuth client ID not configured for ${provider}.` });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
  });

  res.json({
    provider,
    authorizationUrl: `${baseUrl}?${params.toString()}`,
    redirectUri,
  });
});

// ══════════════════════════════════════════════════════════════
// 4. API KEY MANAGEMENT
// ══════════════════════════════════════════════════════════════

// ── POST /api/auth/api-key ──────────────────────────────────
// Generate a new API key for the authenticated user
router.post('/api-key', auth.authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.UserId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Check if user already has an API key
    if (user.ApiKey) {
      return res.status(409).json({
        error: 'You already have an API key. Revoke it first to generate a new one.',
        hasApiKey: true,
      });
    }

    const apiKey = auth.generateApiKey();
    await User.update({ ApiKey: apiKey }, { where: { UserId: user.UserId } });

    await logService.log({
      userId: user.UserId,
      action: logService.Actions.API_KEY_GENERATED,
      resourceType: 'User',
      resourceId: user.UserId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({
      message: 'API key generated successfully.',
      apiKey,
      warning: 'Store this key securely. It will not be shown again.',
    });
  } catch (err) {
    console.error('[Auth] API key generation error:', err.message);
    res.status(500).json({ error: 'API key generation failed.' });
  }
});

// ── GET /api/auth/api-key ───────────────────────────────────
// Check if user has an API key (returns masked version)
router.get('/api-key', auth.authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.UserId, {
      attributes: ['ApiKey'],
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const hasKey = !!user.ApiKey;
    const maskedKey = user.ApiKey
      ? user.ApiKey.substring(0, 12) + '...' + user.ApiKey.slice(-4)
      : null;

    res.json({ hasApiKey: hasKey, maskedApiKey: maskedKey });
  } catch (err) {
    console.error('[Auth] API key check error:', err.message);
    res.status(500).json({ error: 'Failed to check API key.' });
  }
});

// ── DELETE /api/auth/api-key ────────────────────────────────
// Revoke the user's API key
router.delete('/api-key', auth.authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.UserId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!user.ApiKey) {
      return res.status(404).json({ error: 'No API key to revoke.' });
    }

    await User.update({ ApiKey: null }, { where: { UserId: user.UserId } });

    await logService.log({
      userId: user.UserId,
      action: logService.Actions.API_KEY_REVOKED,
      resourceType: 'User',
      resourceId: user.UserId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({ message: 'API key revoked successfully.' });
  } catch (err) {
    console.error('[Auth] API key revocation error:', err.message);
    res.status(500).json({ error: 'API key revocation failed.' });
  }
});

// ══════════════════════════════════════════════════════════════
// 5. SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════

// ── GET /api/auth/sessions ───────────────────────────────────
// List all active sessions for the authenticated user
router.get('/sessions', auth.authenticate, async (req, res) => {
  try {
    const sessions = await auth.getUserSessions(req.user.UserId);
    res.json({ sessions, total: sessions.length });
  } catch (err) {
    console.error('[Auth] List sessions error:', err.message);
    res.status(500).json({ error: 'Failed to list sessions.' });
  }
});

// ── DELETE /api/auth/sessions/:sessionId ────────────────────
// Revoke a specific session
router.delete('/sessions/:sessionId', auth.authenticate, async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const session = await Session.findOne({
      where: { SessionId: sessionId, UserId: req.user.UserId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    await auth.revokeSession(session.Token);

    await logService.log({
      userId: req.user.UserId,
      action: logService.Actions.SESSION_REVOKED,
      resourceType: 'Session',
      resourceId: sessionId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({ message: 'Session revoked successfully.' });
  } catch (err) {
    console.error('[Auth] Revoke session error:', err.message);
    res.status(500).json({ error: 'Failed to revoke session.' });
  }
});

// ── DELETE /api/auth/sessions ───────────────────────────────
// Revoke all sessions except current one
router.delete('/sessions', auth.authenticate, async (req, res) => {
  try {
    // Find current session to exclude it
    const currentSession = await Session.findOne({
      where: { Token: req.token, UserId: req.user.UserId },
    });

    await auth.revokeAllUserSessions(req.user.UserId, currentSession?.SessionId);

    await logService.log({
      userId: req.user.UserId,
      action: logService.Actions.ALL_SESSIONS_REVOKED,
      resourceType: 'Session',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({ message: 'All other sessions revoked successfully.' });
  } catch (err) {
    console.error('[Auth] Revoke all sessions error:', err.message);
    res.status(500).json({ error: 'Failed to revoke sessions.' });
  }
});

// ══════════════════════════════════════════════════════════════
// 6. ACCOUNT MANAGEMENT
// ══════════════════════════════════════════════════════════════

// ── PUT /api/auth/password ──────────────────────────────────
// Change password (requires current password verification)
router.put('/password', auth.authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await User.findByPk(req.user.UserId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // OAuth users may not have a password
    if (!user.Password) {
      return res.status(400).json({ error: 'This account uses OAuth and has no password. Set a password via OAuth unlinking first.' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.Password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await User.update(
      { Password: hashedPassword },
      { where: { UserId: user.UserId } }
    );

    // Revoke all sessions except current one (force re-login on other devices)
    const currentSession = await Session.findOne({
      where: { Token: req.token, UserId: req.user.UserId },
    });
    await auth.revokeAllUserSessions(req.user.UserId, currentSession?.SessionId);

    await logService.log({
      userId: user.UserId,
      action: logService.Actions.PASSWORD_CHANGED,
      resourceType: 'User',
      resourceId: user.UserId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({ message: 'Password changed successfully. Other sessions have been logged out.' });
  } catch (err) {
    console.error('[Auth] Change password error:', err.message);
    res.status(500).json({ error: 'Password change failed.' });
  }
});

// ── PUT /api/auth/profile ───────────────────────────────────
// Update profile (name, email)
router.put('/profile', auth.authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    }

    await User.update({ Name: name }, { where: { UserId: req.user.UserId } });

    await logService.log({
      userId: req.user.UserId,
      action: logService.Actions.PROFILE_UPDATED,
      resourceType: 'User',
      resourceId: req.user.UserId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    const user = await User.findByPk(req.user.UserId, {
      attributes: { exclude: ['Password', 'ApiKey', 'PasswordResetToken', 'PasswordResetExpires', 'TwoFactorSecret'] },
      include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name', 'Description'] }],
    });

    res.json({ message: 'Profile updated.', user });
  } catch (err) {
    console.error('[Auth] Update profile error:', err.message);
    res.status(500).json({ error: 'Profile update failed.' });
  }
});

// ══════════════════════════════════════════════════════════════
// 7. THREE-WAY AUTHENTICATION (Email Verification Code)
// ══════════════════════════════════════════════════════════════

// ── In-memory verification code store ────────────────────────
// Maps email -> { code, expiresAt, userId, name }
const verificationCodes = new Map();

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Generate a 6-digit numeric verification code.
 */
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Rate limiter for 3-way auth ─────────────────────────────
const threeWayLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_TEST ? 1000 : 10,
  message: { error: 'Too many 3-way authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── POST /api/auth/three-way/init ───────────────────────────
// Step 1: User provides email + password.
// If credentials are valid, send a verification code to the email.
router.post('/three-way/init', threeWayLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({
      where: { Email: email },
      include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name', 'Description'] }],
    });

    if (!user) {
      // Don't reveal whether the email exists
      await logService.log({
        userId: 0,
        action: logService.Actions.LOGIN_FAILED,
        resourceType: 'User',
        details: { attemptedEmail: email, reason: 'user_not_found', method: 'three-way' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(() => {});
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check account lockout
    if (auth.isAccountLocked(user)) {
      const lockedUntil = new Date(user.LockedUntil);
      const minutesLeft = Math.ceil((lockedUntil - new Date()) / 60000);
      return res.status(423).json({
        error: `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.Password);
    if (!passwordMatch) {
      const locked = await auth.recordFailedLogin(user);
      await logService.log({
        userId: user.UserId,
        action: logService.Actions.LOGIN_FAILED,
        resourceType: 'User',
        resourceId: user.UserId,
        details: { reason: 'wrong_password', method: 'three-way', attemptsLeft: locked ? 0 : auth.MAX_FAILED_LOGIN_ATTEMPTS - (user.FailedLoginAttempts + 1) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(() => {});
      if (locked) {
        return res.status(423).json({
          error: 'Account locked due to too many failed attempts. Try again in 15 minutes.',
          code: 'ACCOUNT_LOCKED',
        });
      }
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Reset failed login counter (partial - we'll full reset on code verification)
    await auth.resetFailedLogin(user.UserId);

    // Generate and store verification code
    const code = generateCode();
    verificationCodes.set(email.toLowerCase(), {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      userId: user.UserId,
      name: user.Name,
    });

    // Send the code via email
    await sendVerificationCode(email, code, user.Name).catch((err) => {
      console.error('[ThreeWay] Failed to send email:', err.message);
      // If email fails, still return success (user can see code in console in dev)
    });

    await logService.log({
      userId: user.UserId,
      action: 'THREE_WAY_CODE_SENT',
      resourceType: 'User',
      resourceId: user.UserId,
      details: { method: 'three-way', email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    // Return masked email so user knows where the code was sent
    const [localPart, domain] = email.split('@');
    const maskedEmail = localPart[0] + '***@' + domain;

    res.json({
      message: 'Verification code sent to your email.',
      maskedEmail,
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (err) {
    console.error('[ThreeWay] Init error:', err.message);
    res.status(500).json({ error: 'Failed to initiate three-way authentication.' });
  }
});

// ── POST /api/auth/three-way/verify ─────────────────────────
// Step 2: User provides the verification code received via email.
// If valid, return JWT tokens and complete login.
router.post('/three-way/verify', threeWayLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const stored = verificationCodes.get(email.toLowerCase());

    if (!stored) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.', code: 'CODE_NOT_FOUND' });
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(email.toLowerCase());
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.', code: 'CODE_EXPIRED' });
    }

    if (stored.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code. Please try again.', code: 'CODE_INVALID' });
    }

    // Code is valid — clean up the stored code
    verificationCodes.delete(email.toLowerCase());

    // Fetch user with role
    const user = await User.findByPk(stored.userId, {
      include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name', 'Description'] }],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Generate tokens
    const roleName = user.role?.Name || 'user';
    const tokenPayload = { UserId: user.UserId, RoleId: user.RoleId, roleName };
    const accessToken  = auth.generateAccessToken(tokenPayload);
    const refreshToken = auth.generateRefreshToken({ UserId: user.UserId });

    // Create persistent session
    const session = await auth.createSession({
      userId:    user.UserId,
      accessToken,
      refreshToken,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceName: '3-way-auth',
    });

    // Update last login
    await User.update(
      { LastLoginAt: new Date(), LastLoginIp: req.ip },
      { where: { UserId: user.UserId } }
    );

    auth.updateLastActivity({ user: { UserId: user.UserId } }, null, () => {});

    await logService.log({
      userId: user.UserId,
      action: logService.Actions.LOGIN,
      resourceType: 'User',
      resourceId: user.UserId,
      details: { role: roleName, sessionId: session.SessionId, method: 'three-way' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    const { Password, ...userData } = user.toJSON();
    res.json({
      message: 'Authentication successful.',
      user: userData,
      accessToken,
      refreshToken,
      sessionId: session.SessionId,
    });
  } catch (err) {
    console.error('[ThreeWay] Verify error:', err.message);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

module.exports = router;
