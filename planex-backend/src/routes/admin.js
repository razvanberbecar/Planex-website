const { Router }     = require('express');
const { User, Role } = require('../database/models');
const logService     = require('../services/logService');
const { authenticate, updateLastActivity, requireAdmin } = require('../middleware/auth');

const router = Router();

router.use(authenticate, updateLastActivity, requireAdmin);

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['Password', 'ApiKey', 'PasswordResetToken', 'PasswordResetExpires', 'TwoFactorSecret'] },
      include: [{ model: Role, as: 'role', attributes: ['RoleId', 'Name'] }],
      order: [['CreatedAt', 'DESC']],
    });

    await logService.log({
      userId: req.adminUser.UserId,
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

// GET /api/admin/roles
router.get('/roles', async (req, res, next) => {
  try {
    const roles = await Role.findAll({ attributes: ['RoleId', 'Name'], order: [['Name', 'ASC']] });
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/role
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
      userId: req.adminUser.UserId,
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

module.exports = router;
