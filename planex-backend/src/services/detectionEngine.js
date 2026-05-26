// ──────────────────────────────────────────────────────────────
// Malicious Behaviour Detection Engine
//
// Analyses user actions in real-time and flags suspicious
// patterns. When a rule is triggered, a SuspiciousActivity
// record is created and the user is automatically placed
// in the ObservationList for admin review.
//
// Detection rules:
//   1. RAPID_SUCCESSIVE_ACTIONS  — > 30 actions in 5 minutes
//   2. MASS_DELETION             — > 5 DELETE actions in 1 minute
//   3. UNUSUAL_HOURS             — Any action between 02:00-05:00
//   4. EXCESSIVE_FAILED_LOGINS   — > 5 LOGIN_FAILED in 10 minutes
//   5. RAPID_CREATE_DELETE       — Create + delete same resource type within 30 seconds
//   6. MASS_STATUS_TOGGLE        — > 10 TOGGLE_TASK actions in 2 minutes
//   7. MASS_VIEW                 — > 50 VIEW_TASK in 5 minutes
//   8. RAPID_PROFILE_CHANGES     — > 3 PROFILE_UPDATED in 1 minute
//   9. CROSS_RESOURCE_ABUSE      — 3+ resource types in 30 seconds (API scraping)
//  10. AI_LLM_ANALYSIS           — LLM-based pattern classification (when enabled)
// ──────────────────────────────────────────────────────────────

const { Op }                      = require('sequelize');
const { ActivityLog, SuspiciousActivity, ObservationList, User, Role } = require('../database/models');
const llmDetector                 = require('./llmDetector');

// ── Configuration thresholds (tunable) ──────────────────────
const CONFIG = Object.freeze({
  RAPID_ACTIONS_THRESHOLD:     30,   // actions
  RAPID_ACTIONS_WINDOW_MS:     5 * 60 * 1000,  // 5 minutes
  MASS_DELETION_THRESHOLD:     5,    // deletes
  MASS_DELETION_WINDOW_MS:     1 * 60 * 1000,  // 1 minute
  UNUSUAL_HOURS_START:         2,    // 02:00
  UNUSUAL_HOURS_END:           5,    // 05:00
  FAILED_LOGIN_THRESHOLD:      5,    // failed logins
  FAILED_LOGIN_WINDOW_MS:      10 * 60 * 1000, // 10 minutes
  CREATE_DELETE_WINDOW_MS:     30 * 1000, // 30 seconds
  MASS_TOGGLE_THRESHOLD:       10,   // toggles
  MASS_TOGGLE_WINDOW_MS:       2 * 60 * 1000, // 2 minutes
  MASS_VIEW_THRESHOLD:         50,   // views
  MASS_VIEW_WINDOW_MS:         5 * 60 * 1000, // 5 minutes
  RAPID_PROFILE_CHANGES_THRESHOLD: 3,   // changes
  RAPID_PROFILE_CHANGES_WINDOW_MS: 1 * 60 * 1000, // 1 minute
  CROSS_RESOURCE_ABUSE_THRESHOLD:  3,   // resource types
  CROSS_RESOURCE_ABUSE_WINDOW_MS:  30 * 1000, // 30 seconds
});

/**
 * Check if the user is an admin (admins are not flagged).
 */
async function isAdmin(userId) {
  try {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: 'role', attributes: ['Name'] }],
    });
    return user && user.role && user.role.Name.toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

/**
 * Check if the user is already under observation.
 */
async function isUnderObservation(userId) {
  const existing = await ObservationList.findOne({
    where: { UserId: userId, Status: 'UNDER_OBSERVATION' },
  });
  return !!existing;
}

/**
 * Auto-place a user in the observation list.
 */
async function placeInObservationList(userId, reason, suspiciousActivityId, severity) {
  // Don't add if already under observation
  if (await isUnderObservation(userId)) return;

  // Find an admin user to set as AddedBy
  const adminRole = await Role.findOne({ where: { Name: 'admin' } });
  let adminUser = null;
  if (adminRole) {
    adminUser = await User.findOne({ where: { RoleId: adminRole.RoleId } });
  }

  await ObservationList.create({
    UserId:               userId,
    AddedBy:              adminUser ? adminUser.UserId : 1, // fallback to user 1
    Reason:               reason,
    Status:               'UNDER_OBSERVATION',
    SuspiciousActivityId: suspiciousActivityId,
    StartedAt:            new Date(),
    Notes:                `Automatically flagged — severity: ${severity}`,
  });
}

/**
 * Count actions of a specific type in a time window.
 */
async function countActions(userId, action, windowMs) {
  const since = new Date(Date.now() - windowMs);
  return ActivityLog.count({
    where: {
      UserId: userId,
      Action: action,
      Timestamp: { [Op.gte]: since },
    },
  });
}

/**
 * Count actions matching a pattern in a time window.
 */
async function countActionsLike(userId, actionPattern, windowMs) {
  const since = new Date(Date.now() - windowMs);
  return ActivityLog.count({
    where: {
      UserId: userId,
      Action: { [Op.like]: actionPattern },
      Timestamp: { [Op.gte]: since },
    },
  });
}

/**
 * Get the most recent log entry for a user (excluding the current one).
 */
async function getPreviousLog(userId, currentLogId) {
  return ActivityLog.findOne({
    where: {
      UserId: userId,
      LogId:  { [Op.ne]: currentLogId },
    },
    order: [['Timestamp', 'DESC']],
  });
}

/**
 * Create a SuspiciousActivity record.
 */
async function createSuspiciousActivity(userId, activityLogId, ruleTriggered, severity, details) {
  return SuspiciousActivity.create({
    UserId:       userId,
    ActivityLogId: activityLogId,
    RuleTriggered: ruleTriggered,
    Severity:      severity,
    Details:       typeof details === 'object' ? JSON.stringify(details) : details,
    IsReviewed:    false,
    DetectedAt:    new Date(),
  });
}

// ── Rule Implementations ────────────────────────────────────

/**
 * Rule 1: RAPID_SUCCESSIVE_ACTIONS
 * Detects when a user performs > threshold actions within the time window.
 */
async function ruleRapidActions(userId, logEntry) {
  const count = await ActivityLog.count({
    where: {
      UserId: userId,
      Timestamp: {
        [Op.gte]: new Date(Date.now() - CONFIG.RAPID_ACTIONS_WINDOW_MS),
      },
    },
  });

  if (count > CONFIG.RAPID_ACTIONS_THRESHOLD) {
    const severity = count > CONFIG.RAPID_ACTIONS_THRESHOLD * 2 ? 'CRITICAL' : 'HIGH';
    const sa = await createSuspiciousActivity(
      userId, logEntry.LogId, 'RAPID_SUCCESSIVE_ACTIONS', severity,
      { actionCount: count, windowMinutes: CONFIG.RAPID_ACTIONS_WINDOW_MS / 60000 }
    );
    await placeInObservationList(
      userId,
      `Rapid successive actions: ${count} actions in ${CONFIG.RAPID_ACTIONS_WINDOW_MS / 60000} minutes`,
      sa.SuspiciousActivityId,
      severity
    );
    return sa;
  }
  return null;
}

/**
 * Rule 2: MASS_DELETION
 * Detects when a user deletes > threshold resources in a short period.
 */
async function ruleMassDeletion(userId, logEntry) {
  const count = await countActionsLike(userId, 'DELETE_%', CONFIG.MASS_DELETION_WINDOW_MS);

  if (count > CONFIG.MASS_DELETION_THRESHOLD) {
    const severity = count > CONFIG.MASS_DELETION_THRESHOLD * 2 ? 'CRITICAL' : 'HIGH';
    const sa = await createSuspiciousActivity(
      userId, logEntry.LogId, 'MASS_DELETION', severity,
      { deleteCount: count, windowMinutes: CONFIG.MASS_DELETION_WINDOW_MS / 60000 }
    );
    await placeInObservationList(
      userId,
      `Mass deletion detected: ${count} delete actions in ${CONFIG.MASS_DELETION_WINDOW_MS / 60000} minute(s)`,
      sa.SuspiciousActivityId,
      severity
    );
    return sa;
  }
  return null;
}

/**
 * Rule 3: UNUSUAL_HOURS
 * Flags actions performed between configurable unusual hours (default 02:00-05:00).
 */
async function ruleUnusualHours(userId, logEntry) {
  const hour = new Date().getHours();

  // Handle wrap-around (e.g., 23:00-02:00)
  if (CONFIG.UNUSUAL_HOURS_START <= CONFIG.UNUSUAL_HOURS_END) {
    if (hour >= CONFIG.UNUSUAL_HOURS_START && hour < CONFIG.UNUSUAL_HOURS_END) {
      const sa = await createSuspiciousActivity(
        userId, logEntry.LogId, 'UNUSUAL_HOURS', 'LOW',
        { actionHour: hour, actionTime: new Date().toISOString() }
      );
      await placeInObservationList(
        userId,
        `Unusual activity hours: action performed at ${hour}:00 (${CONFIG.UNUSUAL_HOURS_START}:00-${CONFIG.UNUSUAL_HOURS_END}:00)`,
        sa.SuspiciousActivityId,
        'LOW'
      );
      return sa;
    }
  }
  return null;
}

/**
 * Rule 4: EXCESSIVE_FAILED_LOGINS
 * Flags > threshold failed login attempts in the time window.
 */
async function ruleExcessiveFailedLogins(userId, logEntry) {
  const count = await countActions(userId, 'LOGIN_FAILED', CONFIG.FAILED_LOGIN_WINDOW_MS);

  if (count > CONFIG.FAILED_LOGIN_THRESHOLD) {
    const severity = count > CONFIG.FAILED_LOGIN_THRESHOLD * 2 ? 'CRITICAL' : 'HIGH';
    const sa = await createSuspiciousActivity(
      userId, logEntry.LogId, 'EXCESSIVE_FAILED_LOGINS', severity,
      { failedLoginCount: count, windowMinutes: CONFIG.FAILED_LOGIN_WINDOW_MS / 60000 }
    );
    await placeInObservationList(
      userId,
      `Excessive failed logins: ${count} failures in ${CONFIG.FAILED_LOGIN_WINDOW_MS / 60000} minutes`,
      sa.SuspiciousActivityId,
      severity
    );
    return sa;
  }
  return null;
}

/**
 * Rule 5: RAPID_CREATE_DELETE
 * Detects when a user creates and then quickly deletes the same resource type.
 */
async function ruleRapidCreateDelete(userId, logEntry) {
  // Only analyze if this is a CREATE action
  if (!logEntry.Action || !logEntry.Action.startsWith('CREATE_')) return null;

  const resourceType = logEntry.ResourceType;
  if (!resourceType) return null;

  // Look for a DELETE action of the same resource type within the window
  const deleteAction = `DELETE_${resourceType.split('_')[0]}`.toUpperCase();
  const recentDeletes = await ActivityLog.findAll({
    where: {
      UserId:      userId,
      Action:      { [Op.like]: 'DELETE_%' },
      ResourceType: resourceType,
      Timestamp: {
        [Op.gte]: new Date(Date.now() - CONFIG.CREATE_DELETE_WINDOW_MS),
      },
    },
    order: [['Timestamp', 'DESC']],
    limit: 1,
  });

  if (recentDeletes.length > 0) {
    const sa = await createSuspiciousActivity(
      userId, logEntry.LogId, 'RAPID_CREATE_DELETE', 'MEDIUM',
      {
        createLogId: logEntry.LogId,
        deleteLogId: recentDeletes[0].LogId,
        resourceType,
        windowSeconds: CONFIG.CREATE_DELETE_WINDOW_MS / 1000,
      }
    );
    await placeInObservationList(
      userId,
      `Rapid create/delete pattern detected on ${resourceType} within ${CONFIG.CREATE_DELETE_WINDOW_MS / 1000}s`,
      sa.SuspiciousActivityId,
      'MEDIUM'
    );
    return sa;
  }
  return null;
}

/**
 * Rule 6: MASS_STATUS_TOGGLE
 * Flags excessive toggling of task completion status.
 */
async function ruleMassStatusToggle(userId, logEntry) {
  const count = await countActions(userId, 'TOGGLE_TASK', CONFIG.MASS_TOGGLE_WINDOW_MS);

  if (count > CONFIG.MASS_TOGGLE_THRESHOLD) {
    const severity = count > CONFIG.MASS_TOGGLE_THRESHOLD * 2 ? 'HIGH' : 'MEDIUM';
    const sa = await createSuspiciousActivity(
      userId, logEntry.LogId, 'MASS_STATUS_TOGGLE', severity,
      { toggleCount: count, windowMinutes: CONFIG.MASS_TOGGLE_WINDOW_MS / 60000 }
    );
    await placeInObservationList(
      userId,
      `Mass status toggling: ${count} toggles in ${CONFIG.MASS_TOGGLE_WINDOW_MS / 60000} minutes`,
      sa.SuspiciousActivityId,
      severity
    );
    return sa;
  }
  return null;
}

// ── New Rule 7: MASS_VIEW ──────────────────────────────────
/**
 * Rule 7: MASS_VIEW
 * Detects when a user views > threshold tasks in the time window
 * (indicates scraping/unauthorised bulk access).
 */
async function ruleMassView(userId, logEntry) {
  // Only analyze VIEW_TASK or VIEW_TASKS actions
  if (logEntry.Action !== 'VIEW_TASK' && logEntry.Action !== 'VIEW_TASKS') return null;

  // Count both VIEW_TASK and VIEW_TASKS actions
  const count = await ActivityLog.count({
    where: {
      UserId: userId,
      Action: { [Op.in]: ['VIEW_TASK', 'VIEW_TASKS'] },
      Timestamp: { [Op.gte]: new Date(Date.now() - CONFIG.MASS_VIEW_WINDOW_MS) },
    },
  });

  if (count > CONFIG.MASS_VIEW_THRESHOLD) {
    const severity = count > CONFIG.MASS_VIEW_THRESHOLD * 2 ? 'CRITICAL' : 'HIGH';
    const sa = await createSuspiciousActivity(
      userId, logEntry.LogId, 'MASS_VIEW', severity,
      { viewCount: count, windowMinutes: CONFIG.MASS_VIEW_WINDOW_MS / 60000 }
    );
    await placeInObservationList(
      userId,
      `Mass view detected: ${count} views in ${CONFIG.MASS_VIEW_WINDOW_MS / 60000} minutes`,
      sa.SuspiciousActivityId,
      severity
    );
    return sa;
  }
  return null;
}

// ── New Rule 8: RAPID_PROFILE_CHANGES ──────────────────────
/**
 * Rule 8: RAPID_PROFILE_CHANGES
 * Flags rapid profile/account changes (indicates account takeover).
 */
async function ruleRapidProfileChanges(userId, logEntry) {
  // Only analyze PROFILE_UPDATED or PASSWORD_CHANGED actions
  if (logEntry.Action !== 'PROFILE_UPDATED' && logEntry.Action !== 'PASSWORD_CHANGED') return null;

  const count = await ActivityLog.count({
    where: {
      UserId: userId,
      Action: { [Op.in]: ['PROFILE_UPDATED', 'PASSWORD_CHANGED'] },
      Timestamp: { [Op.gte]: new Date(Date.now() - CONFIG.RAPID_PROFILE_CHANGES_WINDOW_MS) },
    },
  });

  if (count > CONFIG.RAPID_PROFILE_CHANGES_THRESHOLD) {
    const sa = await createSuspiciousActivity(
      userId, logEntry.LogId, 'RAPID_PROFILE_CHANGES', 'HIGH',
      { changeCount: count, windowMinutes: CONFIG.RAPID_PROFILE_CHANGES_WINDOW_MS / 60000 }
    );
    await placeInObservationList(
      userId,
      `Rapid profile changes: ${count} changes in ${CONFIG.RAPID_PROFILE_CHANGES_WINDOW_MS / 60000} minute(s)`,
      sa.SuspiciousActivityId,
      'HIGH'
    );
    return sa;
  }
  return null;
}

// ── New Rule 9: CROSS_RESOURCE_ABUSE ───────────────────────
/**
 * Rule 9: CROSS_RESOURCE_ABUSE
 * Detects when a user accesses many different resource types in a short window
 * (indicates API reconnaissance / scraping).
 */
async function ruleCrossResourceAbuse(userId, logEntry) {
  const since = new Date(Date.now() - CONFIG.CROSS_RESOURCE_ABUSE_WINDOW_MS);
  const recentLogs = await ActivityLog.findAll({
    where: {
      UserId: userId,
      Timestamp: { [Op.gte]: since },
      LogId: { [Op.ne]: logEntry.LogId },
    },
    attributes: ['ResourceType'],
    raw: true,
  });

  const resourceTypes = new Set();
  for (const log of recentLogs) {
    if (log.ResourceType) resourceTypes.add(log.ResourceType);
  }
  // Add the current log's resource type
  if (logEntry.ResourceType) resourceTypes.add(logEntry.ResourceType);

  if (resourceTypes.size >= CONFIG.CROSS_RESOURCE_ABUSE_THRESHOLD) {
    const severity = resourceTypes.size >= 5 ? 'CRITICAL' : 'HIGH';
    const sa = await createSuspiciousActivity(
      userId, logEntry.LogId, 'CROSS_RESOURCE_ABUSE', severity,
      {
        resourceTypesAccessed: Array.from(resourceTypes),
        uniqueResourceCount: resourceTypes.size,
        windowSeconds: CONFIG.CROSS_RESOURCE_ABUSE_WINDOW_MS / 1000,
      }
    );
    await placeInObservationList(
      userId,
      `Cross-resource abuse: ${resourceTypes.size} different resource types in ${CONFIG.CROSS_RESOURCE_ABUSE_WINDOW_MS / 1000}s`,
      sa.SuspiciousActivityId,
      severity
    );
    return sa;
  }
  return null;
}

// ── Public API ──────────────────────────────────────────────

/**
 * Analyze a user action for malicious behaviour.
 * Called automatically by LogService after each logged action.
 *
 * @param {number} userId
 * @param {object} logEntry  — The ActivityLog row that was just created.
 */
async function analyze(userId, logEntry) {
  // Note: All users are monitored, including admins (insider threat detection).
  // The high rule thresholds prevent false positives from normal activity.

  // Run all rules in parallel for efficiency
  const rules = [
    ruleRapidActions(userId, logEntry),
    ruleMassDeletion(userId, logEntry),
    ruleUnusualHours(userId, logEntry),
    ruleRapidCreateDelete(userId, logEntry),
    ruleMassStatusToggle(userId, logEntry),
    ruleMassView(userId, logEntry),
    ruleRapidProfileChanges(userId, logEntry),
    ruleCrossResourceAbuse(userId, logEntry),
  ];

  // EXCESSIVE_FAILED_LOGINS only triggers on LOGIN_FAILED actions
  if (logEntry.Action === 'LOGIN_FAILED') {
    rules.push(ruleExcessiveFailedLogins(userId, logEntry));
  }

  const results = await Promise.allSettled(rules);

  // Log any rule errors
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[DetectionEngine] Rule error:', result.reason?.message || result.reason);
    }
  }

  // ── LLM-based analysis (non-blocking, fire-and-forget) ──
  if (llmDetector.isEnabled()) {
    // Gather recent logs for LLM context
    try {
      const recentLogs = await ActivityLog.findAll({
        where: { UserId: userId },
        order: [['Timestamp', 'DESC']],
        limit: 50,
        raw: true,
      });

      const existingFlags = await SuspiciousActivity.findAll({
        where: { UserId: userId },
        attributes: ['Severity'],
        raw: true,
      });

      const llmResult = await llmDetector.classifyActivity(userId, recentLogs, existingFlags);

      if (llmResult.flagged) {
        // Create a SuspiciousActivity for the LLM detection
        const sa = await createSuspiciousActivity(
          userId, logEntry.LogId, 'AI_LLM_ANALYSIS', llmResult.severity,
          { llmConfidence: llmResult.confidence, llmReason: llmResult.reason }
        );
        await placeInObservationList(
          userId,
          `AI-LLM flagged suspicious pattern: ${llmResult.reason}`,
          sa.SuspiciousActivityId,
          llmResult.severity
        );
        console.log(`[DetectionEngine] LLM flagged user ${userId} (confidence: ${llmResult.confidence})`);
      }
    } catch (llmErr) {
      console.error('[DetectionEngine] LLM analysis error:', llmErr.message);
      // Non-blocking: rule results are still returned regardless
    }
  }
}

/**
 * Get all suspicious activities (for admin view).
 */
async function getSuspiciousActivities(options = {}) {
  const where = {};
  if (options.unreviewedOnly) where.IsReviewed = false;
  if (options.severity) where.Severity = options.severity;

  return SuspiciousActivity.findAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['UserId', 'Name', 'Email'] },
      { model: User, as: 'reviewer', attributes: ['UserId', 'Name'] },
    ],
    order: [['DetectedAt', 'DESC']],
  });
}

/**
 * Get the full observation list.
 */
async function getObservationList(options = {}) {
  const where = {};
  if (options.status) where.Status = options.status;

  return ObservationList.findAll({
    where,
    include: [
      { model: User, as: 'observedUser', attributes: ['UserId', 'Name', 'Email'] },
      { model: User, as: 'addedByAdmin', attributes: ['UserId', 'Name'] },
      { model: SuspiciousActivity, as: 'suspiciousActivity' },
    ],
    order: [['StartedAt', 'DESC']],
  });
}

/**
 * Review a suspicious activity.
 */
async function reviewSuspiciousActivity(suspiciousActivityId, reviewedBy) {
  const sa = await SuspiciousActivity.findByPk(suspiciousActivityId);
  if (!sa) throw new Error('Suspicious activity not found.');

  sa.IsReviewed = true;
  sa.ReviewedBy = reviewedBy;
  sa.ReviewedAt = new Date();
  await sa.save();
  return sa;
}

/**
 * Clear a user from the observation list.
 */
async function clearObservation(observationId, notes = null) {
  const entry = await ObservationList.findByPk(observationId);
  if (!entry) throw new Error('Observation entry not found.');

  entry.Status = 'CLEARED';
  entry.EndedAt = new Date();
  if (notes) entry.Notes = notes;
  await entry.save();
  return entry;
}

/**
 * Restrict a user in the observation list.
 * Restriction is user-level: ALL observation entries for the same user
 * are set to RESTRICTED. If the user is already restricted, this is a no-op.
 */
async function restrictUser(observationId, notes = null) {
  const entry = await ObservationList.findByPk(observationId);
  if (!entry) throw new Error('Observation entry not found.');

  // If this specific entry is already finalized (CLEARED or RESTRICTED), no-op
  if (entry.Status !== 'UNDER_OBSERVATION') {
    return { alreadyFinalized: true, entry };
  }

  // Get all UNDER_OBSERVATION entries for this user and restrict them all
  const affected = await ObservationList.findAll({
    where: { UserId: entry.UserId, Status: 'UNDER_OBSERVATION' },
  });

  if (affected.length === 0) {
    return { alreadyFinalized: true, entry };
  }

  const now = new Date();
  for (const obs of affected) {
    obs.Status = 'RESTRICTED';
    obs.EndedAt = now;
    if (notes) obs.Notes = notes;
    await obs.save();
  }

  return { restricted: true, userId: entry.UserId, entriesCount: affected.length };
}

/**
 * Unrestrict a user in the observation list.
 * User-level: ALL RESTRICTED entries for the same user revert to UNDER_OBSERVATION.
 * If the user has no RESTRICTED entries, this is a no-op.
 */
async function unrestrictUser(observationId, notes = null) {
  const entry = await ObservationList.findByPk(observationId);
  if (!entry) throw new Error('Observation entry not found.');

  // Only operate on RESTRICTED entries
  if (entry.Status !== 'RESTRICTED') {
    return { notRestricted: true, entry };
  }

  // Get all RESTRICTED entries for this user and revert them all
  const affected = await ObservationList.findAll({
    where: { UserId: entry.UserId, Status: 'RESTRICTED' },
  });

  if (affected.length === 0) {
    return { notRestricted: true, entry };
  }

  for (const obs of affected) {
    obs.Status = 'UNDER_OBSERVATION';
    obs.EndedAt = null;
    if (notes) obs.Notes = notes;
    await obs.save();
  }

  return { unrestricted: true, userId: entry.UserId, entriesCount: affected.length };
}

module.exports = {
  analyze,
  getSuspiciousActivities,
  getObservationList,
  reviewSuspiciousActivity,
  clearObservation,
  restrictUser,
  unrestrictUser,
  CONFIG,
};
