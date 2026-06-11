// ──────────────────────────────────────────────────────────────
// Flag Service — records suspicious user behaviour for admin review
// Reasons: 'toxic_chat' | 'brute_force'
// ──────────────────────────────────────────────────────────────

const { UserFlag, User, Role } = require('../database/models')
const { Op } = require('sequelize')

/**
 * Record a flag against a user.
 * Silently ignores unknown userIds (0 / null) so callers don't need to guard.
 */
async function flagUser(userId, reason, detail = null) {
  if (!userId) return
  try {
    await UserFlag.create({ UserId: userId, Reason: reason, Detail: detail || null })
    console.log(`[FlagService] User ${userId} flagged for: ${reason}`)
  } catch (err) {
    console.error('[FlagService] Failed to create flag:', err.message)
  }
}

/**
 * Remove all flags for a given user.
 */
async function clearFlags(userId) {
  await UserFlag.destroy({ where: { UserId: userId } })
}

/**
 * Return all flags joined with user info, newest first.
 * Groups into: [ { user: {...}, flags: [...] } ]
 */
async function getAllFlags() {
  const flags = await UserFlag.findAll({
    order: [['CreatedAt', 'DESC']],
    include: [{
      model: User,
      as: 'user',
      attributes: ['UserId', 'Name', 'Email'],
      include: [{ model: Role, as: 'role', attributes: ['Name'] }],
    }],
    raw: false,
  })
  return flags.map(f => ({
    flagId:    f.FlagId,
    userId:    f.UserId,
    userName:  f.user?.Name  || 'Unknown',
    userEmail: f.user?.Email || '',
    userRole:  f.user?.role?.Name || 'user',
    reason:    f.Reason,
    detail:    f.Detail,
    createdAt: f.CreatedAt,
  }))
}

module.exports = { flagUser, clearFlags, getAllFlags }
