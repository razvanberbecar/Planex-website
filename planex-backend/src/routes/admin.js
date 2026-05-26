// ──────────────────────────────────────────────────────────────
// Admin Routes  —  Suspicious Activity & Observation List
// All routes require admin role authentication.
// ──────────────────────────────────────────────────────────────

const { Router }        = require('express');
const { User, Role }    = require('../database/models');
const detectionEngine   = require('../services/detectionEngine');
const logService        = require('../services/logService');
const { authenticate, updateLastActivity, requireAdmin } = require('../middleware/auth');

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, updateLastActivity, requireAdmin);

// ══════════════════════════════════════════════════════════════
// GET /api/admin/users — List all users (admin only)
// ══════════════════════════════════════════════════════════════
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['Password', 'ApiKey', 'PasswordResetToken', 'PasswordResetExpires', 'TwoFactorSecret'] },
      include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name'] }],
      order: [['CreatedAt', 'DESC']],
    });

    await logService.log({
      userId: req.user.UserId,
      action: logService.Actions.VIEW_USERS,
      resourceType: 'User',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/admin/users/:id/role — Change user role (admin only)
// ══════════════════════════════════════════════════════════════
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const { roleId } = req.body;

    if (!roleId) return res.status(400).json({ error: 'RoleId is required.' });

    const role = await Role.findByPk(roleId);
    if (!role) return res.status(404).json({ error: 'Role not found.' });

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await User.update({ RoleId: roleId }, { where: { UserId: userId } });

    await logService.log({
      userId: req.user.UserId,
      action: logService.Actions.UPDATE_USER_ROLE,
      resourceType: 'User',
      resourceId: userId,
      details: { newRoleId: roleId, newRoleName: role.Name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({ message: `User role updated to ${role.Name}.` });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/admin/suspicious-activities
// ══════════════════════════════════════════════════════════════
router.get('/suspicious-activities', async (req, res, next) => {
  try {
    const options = {};
    if (req.query.unreviewedOnly === 'true') options.unreviewedOnly = true;
    if (req.query.severity) options.severity = req.query.severity;

    const activities = await detectionEngine.getSuspiciousActivities(options);

    await logService.log({
      userId: req.adminUser.UserId,
      action: logService.Actions.VIEW_OBSERVATION_LIST,
      resourceType: 'SuspiciousActivity',
      details: { filter: options },
    });

    res.json(activities);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/admin/observation-list
// ══════════════════════════════════════════════════════════════
router.get('/observation-list', async (req, res, next) => {
  try {
    const options = {};
    if (req.query.status) options.status = req.query.status;

    const list = await detectionEngine.getObservationList(options);

    await logService.log({
      userId: req.adminUser.UserId,
      action: logService.Actions.VIEW_OBSERVATION_LIST,
      resourceType: 'ObservationList',
    });

    res.json(list);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/admin/suspicious-activities/:id/review
// ══════════════════════════════════════════════════════════════
router.patch('/suspicious-activities/:id/review', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sa = await detectionEngine.reviewSuspiciousActivity(id, req.adminUser.UserId);

    await logService.log({
      userId: req.adminUser.UserId,
      action: logService.Actions.REVIEW_SUSPICIOUS_ACTIVITY,
      resourceType: 'SuspiciousActivity',
      resourceId: id,
    });

    res.json(sa);
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/admin/observation-list/:id/clear
// ══════════════════════════════════════════════════════════════
router.patch('/observation-list/:id/clear', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const notes = req.body.notes || null;
    const entry = await detectionEngine.clearObservation(id, notes);

    await logService.log({
      userId: req.adminUser.UserId,
      action: logService.Actions.CLEAR_OBSERVATION,
      resourceType: 'ObservationList',
      resourceId: id,
      details: { clearedUserId: entry.UserId },
    });

    res.json(entry);
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/admin/observation-list/:id/restrict
// ══════════════════════════════════════════════════════════════
router.patch('/observation-list/:id/restrict', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const notes = req.body.notes || null;
    const result = await detectionEngine.restrictUser(id, notes);

    if (result.alreadyFinalized) {
      return res.json({ message: 'User already restricted or cleared.', restricted: false });
    }

    await logService.log({
      userId: req.adminUser.UserId,
      action: logService.Actions.RESTRICT_USER,
      resourceType: 'ObservationList',
      resourceId: id,
      details: { restrictedUserId: result.userId, entriesAffected: result.entriesCount },
    });

    res.json({ message: `User restricted. ${result.entriesCount} entry(ies) updated.`, restricted: true });
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/admin/observation-list/:id/unrestrict
// ══════════════════════════════════════════════════════════════
router.patch('/observation-list/:id/unrestrict', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const notes = req.body.notes || null;
    const result = await detectionEngine.unrestrictUser(id, notes);

    if (result.notRestricted) {
      return res.json({ message: 'User is not restricted.', unrestricted: false });
    }

    await logService.log({
      userId: req.adminUser.UserId,
      action: logService.Actions.UNRESTRICT_USER,
      resourceType: 'ObservationList',
      resourceId: id,
      details: { unrestrictedUserId: result.userId, entriesAffected: result.entriesCount },
    });

    res.json({ message: `User unrestricted. ${result.entriesCount} entry(ies) reverted.`, unrestricted: true });
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
