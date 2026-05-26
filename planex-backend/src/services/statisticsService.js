// ──────────────────────────────────────────────────────────────
// Statistics Service — Heavily Computational Analytics
//
// Computes complex statistics across the Tasks-TaskCollaborators
// many-to-many relationship. Two modes:
//   - "naive":     N+1 queries, no indices, O(n³) loops (intentionally slow)
//   - "optimized": Single SQL with JOINs, indexed lookups, aggregate functions
// ──────────────────────────────────────────────────────────────

const { Op } = require('sequelize');
const { Task, TaskCollaborator, Subtask, User, ActivityLog, sequelize } = require('../database/models');
const cache = require('./cacheService');

// ── Type Definitions ─────────────────────────────────────────
// Each compute function returns { result, timing: { db, compute } }

// ══════════════════════════════════════════════════════════════
// NAIVE IMPLEMENTATIONS (intentionally inefficient)
// ══════════════════════════════════════════════════════════════

/**
 * NAIVE: Collaboration Density Matrix
 * For each pair of users, count how many tasks they co-collaborate on.
 * O(n * m * k) where n=users, m=tasks, k=collaborators per task
 */
async function computeDensityNaive() {
  const t0 = Date.now();

  // N+1: Fetch all data separately
  const tasks = await Task.findAll({ raw: true });
  const allCollabs = await TaskCollaborator.findAll({ raw: true });
  const users = await User.findAll({ attributes: ['UserId', 'Name'], raw: true });

  const t1 = Date.now();

  // O(n²) loops: Build collaboration pairs
  const collabByTask = {};
  for (const c of allCollabs) {
    if (!collabByTask[c.TaskId]) collabByTask[c.TaskId] = [];
    collabByTask[c.TaskId].push(c.Username);
  }

  // O(n³): For each pair of users, count shared tasks
  const pairs = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      let shared = 0;
      for (const taskId of Object.keys(collabByTask)) {
        const collabs = collabByTask[taskId];
        if (collabs.includes(users[i].Name) && collabs.includes(users[j].Name)) {
          shared++;
        }
      }
      if (shared > 0) {
        pairs.push({ user1: users[i].Name, user2: users[j].Name, sharedTasks: shared });
      }
    }
  }

  // Sort by most collaborations
  pairs.sort((a, b) => b.sharedTasks - a.sharedTasks);

  const t2 = Date.now();
  return {
    result: {
      type: 'density',
      mode: 'naive',
      totalPairs: pairs.length,
      topPairs: pairs.slice(0, 20),
      totalTasks: tasks.length,
      totalUsers: users.length,
      totalCollaboratorLinks: allCollabs.length,
    },
    timing: {
      db: t1 - t0,
      compute: t2 - t1,
      total: t2 - t0,
    },
  };
}

/**
 * NAIVE: User Productivity Score
 * Weighted score based on completed tasks, collaborator count, subtask completion
 */
async function computeProductivityNaive() {
  const t0 = Date.now();

  const tasks = await Task.findAll({ raw: true });
  const allCollabs = await TaskCollaborator.findAll({ raw: true });
  const allSubtasks = await Subtask.findAll({ raw: true });
  const users = await User.findAll({ attributes: ['UserId', 'Name'], raw: true });

  const t1 = Date.now();

  // Build lookup maps (N+1 style)
  const collabsByTask = {};
  for (const c of allCollabs) {
    if (!collabsByTask[c.TaskId]) collabsByTask[c.TaskId] = [];
    collabsByTask[c.TaskId].push(c.Username);
  }

  const subtasksByTask = {};
  for (const s of allSubtasks) {
    if (!subtasksByTask[s.TaskId]) subtasksByTask[s.TaskId] = [];
    subtasksByTask[s.TaskId].push(s);
  }

  // O(n * m): For each user, compute productivity score
  const scores = [];
  for (const user of users) {
    const userTasks = tasks.filter(t => t.CreatedBy === user.UserId);
    const completedTasks = userTasks.filter(t => t.IsCompleted);
    const completionRate = userTasks.length > 0 ? completedTasks.length / userTasks.length : 0;

    let totalCollaborators = 0;
    let subtaskCompletionRate = 0;
    let totalSubtasks = 0;
    let completedSubtasks = 0;

    for (const t of userTasks) {
      const collabs = collabsByTask[t.TaskId] || [];
      totalCollaborators += collabs.length;

      const subs = subtasksByTask[t.TaskId] || [];
      totalSubtasks += subs.length;
      completedSubtasks += subs.filter(s => s.IsCompleted).length;
    }

    subtaskCompletionRate = totalSubtasks > 0 ? completedSubtasks / totalSubtasks : 0;

    // Weighted score
    const score = (
      completionRate * 40 +
      (totalCollaborators / Math.max(userTasks.length, 1)) * 20 +
      subtaskCompletionRate * 25 +
      Math.log(userTasks.length + 1) * 15
    );

    scores.push({
      userName: user.Name,
      userId: user.UserId,
      score: Math.round(score * 100) / 100,
      totalTasks: userTasks.length,
      completedTasks: completedTasks.length,
      completionRate: Math.round(completionRate * 100),
      avgCollaborators: userTasks.length > 0 ? Math.round(totalCollaborators / userTasks.length) : 0,
      subtaskCompletionRate: Math.round(subtaskCompletionRate * 100),
    });
  }

  scores.sort((a, b) => b.score - a.score);
  const t2 = Date.now();

  return {
    result: {
      type: 'productivity',
      mode: 'naive',
      topUsers: scores.slice(0, 20),
      totalUsers: scores.length,
    },
    timing: {
      db: t1 - t0,
      compute: t2 - t1,
      total: t2 - t0,
    },
  };
}

/**
 * NAIVE: Priority Distribution Heatmap
 * 3D grouping: Priority × Completion Status × Month
 */
async function computeHeatmapNaive() {
  const t0 = Date.now();
  const tasks = await Task.findAll({ raw: true });
  const t1 = Date.now();

  const heatmap = {};
  for (const t of tasks) {
    const date = new Date(t.DueDate);
    const month = isNaN(date.getTime())
      ? 'Unknown'
      : date.toLocaleString('default', { month: 'short', year: '2-digit' });
    const priority = t.Priority;
    const status = t.IsCompleted ? 'Completed' : 'Active';

    const key = `${priority}|${status}|${month}`;
    if (!heatmap[key]) {
      heatmap[key] = { priority, status, month, count: 0 };
    }
    heatmap[key].count++;
  }

  const t2 = Date.now();
  return {
    result: {
      type: 'heatmap',
      mode: 'naive',
      cells: Object.values(heatmap).sort((a, b) => b.count - a.count),
      totalCells: Object.keys(heatmap).length,
    },
    timing: {
      db: t1 - t0,
      compute: t2 - t1,
      total: t2 - t0,
    },
  };
}

/**
 * NAIVE: Network Centrality
 * Which users are central collaborators (most cross-team involvement)
 */
async function computeCentralityNaive() {
  const t0 = Date.now();
  const allCollabs = await TaskCollaborator.findAll({ raw: true });
  const tasks = await Task.findAll({ raw: true });
  const users = await User.findAll({ attributes: ['UserId', 'Name'], raw: true });
  const t1 = Date.now();

  // Count unique collaborators per user's tasks
  const taskCreatorMap = {};
  for (const t of tasks) {
    taskCreatorMap[t.TaskId] = t.CreatedBy;
  }

  const centrality = {};
  for (const user of users) {
    const userTaskIds = tasks.filter(t => t.CreatedBy === user.UserId).map(t => t.TaskId);
    const collaboratedWith = new Set();
    const uniqueTeams = new Set();

    for (const c of allCollabs) {
      if (userTaskIds.includes(c.TaskId)) {
        collaboratedWith.add(c.Username);
      }
      // Also count if this user is a collaborator on someone else's task
      if (c.Username === user.Name) {
        uniqueTeams.add(taskCreatorMap[c.TaskId]);
      }
    }

    centrality[user.Name] = {
      userName: user.Name,
      userId: user.UserId,
      collaboratorsCount: collaboratedWith.size,
      teamsInvolved: uniqueTeams.size,
      centralityScore: Math.round((collaboratedWith.size + uniqueTeams.size * 2) * 100) / 100,
    };
  }

  const sorted = Object.values(centrality).sort((a, b) => b.centralityScore - a.centralityScore);
  const t2 = Date.now();

  return {
    result: {
      type: 'centrality',
      mode: 'naive',
      topUsers: sorted.slice(0, 20),
      totalUsers: sorted.length,
    },
    timing: {
      db: t1 - t0,
      compute: t2 - t1,
      total: t2 - t0,
    },
  };
}

/**
 * NAIVE: Activity Rhythm Analysis
 * Time-of-day patterns per user
 */
async function computeRhythmNaive() {
  const t0 = Date.now();
  const logs = await ActivityLog.findAll({ raw: true });
  const users = await User.findAll({ attributes: ['UserId', 'Name'], raw: true });
  const t1 = Date.now();

  const hourBuckets = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  const userPatterns = {};

  for (const log of logs) {
    if (!log.Timestamp) continue;
    const hour = new Date(log.Timestamp).getHours();
    hourBuckets[hour].count++;

    const userName = users.find(u => u.UserId === log.UserId)?.Name || `User ${log.UserId}`;
    if (!userPatterns[userName]) {
      userPatterns[userName] = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    }
    userPatterns[userName][hour].count++;
  }

  const t2 = Date.now();
  return {
    result: {
      type: 'rhythm',
      mode: 'naive',
      globalPattern: hourBuckets,
      peakHour: hourBuckets.reduce((a, b) => (b.count > a.count ? b : a)).hour,
      userPatterns: Object.entries(userPatterns)
        .map(([name, hours]) => ({
          userName: name,
          peakHour: hours.reduce((a, b) => (b.count > a.count ? b : a)).hour,
          totalActions: hours.reduce((s, h) => s + h.count, 0),
        }))
        .sort((a, b) => b.totalActions - a.totalActions)
        .slice(0, 20),
    },
    timing: {
      db: t1 - t0,
      compute: t2 - t1,
      total: t2 - t0,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// OPTIMIZED IMPLEMENTATIONS (single SQL queries, caching)
// ══════════════════════════════════════════════════════════════

/**
 * OPTIMIZED: Collaboration Density Matrix
 * Single SQL query with GROUP BY and JOINs
 */
async function computeDensityOptimized() {
  const cacheKey = 'stats:density:optimized';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const t0 = Date.now();

  // Single optimized query using Sequelize aggregation
  const [pairs] = await sequelize.query(`
    SELECT
      tc1.Username AS user1,
      tc2.Username AS user2,
      COUNT(DISTINCT tc1.TaskId) AS sharedTasks
    FROM TaskCollaborators tc1
    INNER JOIN TaskCollaborators tc2
      ON tc1.TaskId = tc2.TaskId
      AND tc1.Username < tc2.Username
    GROUP BY tc1.Username, tc2.Username
    HAVING COUNT(DISTINCT tc1.TaskId) > 0
    ORDER BY sharedTasks DESC
    OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
  `);

  const [countResult] = await sequelize.query(`
    SELECT COUNT(DISTINCT tc1.Username + '<>' + tc2.Username) AS total
    FROM TaskCollaborators tc1
    INNER JOIN TaskCollaborators tc2
      ON tc1.TaskId = tc2.TaskId
      AND tc1.Username < tc2.Username
  `);

  const [taskCount] = await sequelize.query(`SELECT COUNT(*) AS cnt FROM Tasks`);
  const [userCount] = await sequelize.query(`SELECT COUNT(*) AS cnt FROM Users`);
  const [linkCount] = await sequelize.query(`SELECT COUNT(*) AS cnt FROM TaskCollaborators`);

  const t1 = Date.now();

  const result = {
    result: {
      type: 'density',
      mode: 'optimized',
      totalPairs: countResult[0]?.total || 0,
      topPairs: pairs,
      totalTasks: taskCount[0]?.cnt || 0,
      totalUsers: userCount[0]?.cnt || 0,
      totalCollaboratorLinks: linkCount[0]?.cnt || 0,
    },
    timing: {
      db: t1 - t0,
      compute: 0,
      total: t1 - t0,
    },
  };

  cache.set(cacheKey, result, 60);
  return result;
}

/**
 * OPTIMIZED: User Productivity Score
 * Single aggregated query with subqueries
 */
async function computeProductivityOptimized() {
  const cacheKey = 'stats:productivity:optimized';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const t0 = Date.now();

  const [scores] = await sequelize.query(`
    SELECT
      u.UserId,
      u.Name AS userName,
      COUNT(DISTINCT t.TaskId) AS totalTasks,
      COUNT(DISTINCT CASE WHEN t.IsCompleted = 1 THEN t.TaskId END) AS completedTasks,
      ROUND(
        CASE WHEN COUNT(DISTINCT t.TaskId) > 0
          THEN CAST(COUNT(DISTINCT CASE WHEN t.IsCompleted = 1 THEN t.TaskId END) AS FLOAT)
               / COUNT(DISTINCT t.TaskId) * 100
          ELSE 0 END, 0
      ) AS completionRate,
      COALESCE(
        ROUND(
          CASE WHEN COUNT(DISTINCT t.TaskId) > 0
            THEN CAST(COUNT(DISTINCT tc.CollaboratorId) AS FLOAT) / COUNT(DISTINCT t.TaskId)
            ELSE 0 END, 0
        ), 0
      ) AS avgCollaborators,
      COALESCE(
        ROUND(
          CASE WHEN COUNT(DISTINCT s.SubtaskId) > 0
            THEN CAST(COUNT(DISTINCT CASE WHEN s.IsCompleted = 1 THEN s.SubtaskId END) AS FLOAT)
                 / COUNT(DISTINCT s.SubtaskId) * 100
            ELSE 0 END, 0
        ), 0
      ) AS subtaskCompletionRate,
      ROUND(
        COALESCE(
          CASE WHEN COUNT(DISTINCT t.TaskId) > 0
            THEN CAST(COUNT(DISTINCT CASE WHEN t.IsCompleted = 1 THEN t.TaskId END) AS FLOAT)
                 / COUNT(DISTINCT t.TaskId) * 40
            ELSE 0 END, 0
        ) +
        COALESCE(
          CASE WHEN COUNT(DISTINCT t.TaskId) > 0
            THEN CAST(COUNT(DISTINCT tc.CollaboratorId) AS FLOAT) / COUNT(DISTINCT t.TaskId) * 20
            ELSE 0 END, 0
        ) +
        COALESCE(
          CASE WHEN COUNT(DISTINCT s.SubtaskId) > 0
            THEN CAST(COUNT(DISTINCT CASE WHEN s.IsCompleted = 1 THEN s.SubtaskId END) AS FLOAT)
                 / COUNT(DISTINCT s.SubtaskId) * 25
            ELSE 0 END, 0
        ) +
        COALESCE(LOG(COUNT(DISTINCT t.TaskId) + 1) * 15, 0)
      , 2) AS score
    FROM Users u
    LEFT JOIN Tasks t ON t.CreatedBy = u.UserId
    LEFT JOIN TaskCollaborators tc ON tc.TaskId = t.TaskId
    LEFT JOIN Subtasks s ON s.TaskId = t.TaskId
    GROUP BY u.UserId, u.Name
    ORDER BY score DESC
    OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
  `);

  const [countResult] = await sequelize.query(`SELECT COUNT(*) AS cnt FROM Users`);

  const t1 = Date.now();

  const result = {
    result: {
      type: 'productivity',
      mode: 'optimized',
      topUsers: scores,
      totalUsers: countResult[0]?.cnt || 0,
    },
    timing: {
      db: t1 - t0,
      compute: 0,
      total: t1 - t0,
    },
  };

  cache.set(cacheKey, result, 60);
  return result;
}

/**
 * OPTIMIZED: Priority Distribution Heatmap
 * Single GROUP BY query with date formatting
 */
async function computeHeatmapOptimized() {
  const cacheKey = 'stats:heatmap:optimized';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const t0 = Date.now();

  const [cells] = await sequelize.query(`
    SELECT
      Priority AS priority,
      CASE WHEN IsCompleted = 1 THEN 'Completed' ELSE 'Active' END AS status,
      TO_CHAR("DueDate", 'Mon-YY') AS month,
      COUNT(*) AS count
    FROM Tasks
    GROUP BY Priority,
      CASE WHEN IsCompleted = 1 THEN 'Completed' ELSE 'Active' END,
      TO_CHAR("DueDate", 'Mon-YY')
    ORDER BY count DESC
  `);

  const t1 = Date.now();

  const result = {
    result: {
      type: 'heatmap',
      mode: 'optimized',
      cells,
      totalCells: cells.length,
    },
    timing: {
      db: t1 - t0,
      compute: 0,
      total: t1 - t0,
    },
  };

  cache.set(cacheKey, result, 60);
  return result;
}

/**
 * OPTIMIZED: Network Centrality
 * Single query using self-joins on TaskCollaborators
 */
async function computeCentralityOptimized() {
  const cacheKey = 'stats:centrality:optimized';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const t0 = Date.now();

  const [scores] = await sequelize.query(`
    SELECT
      u.UserId,
      u.Name AS userName,
      (
        SELECT COUNT(DISTINCT tc2.Username)
        FROM TaskCollaborators tc2
        WHERE tc2.TaskId IN (
          SELECT t.TaskId FROM Tasks t WHERE t.CreatedBy = u.UserId
        )
        AND tc2.Username != u.Name
      ) AS collaboratorsCount,
      (
        SELECT COUNT(DISTINCT t2.CreatedBy)
        FROM TaskCollaborators tc3
        INNER JOIN Tasks t2 ON t2.TaskId = tc3.TaskId
        WHERE tc3.Username = u.Name
        AND t2.CreatedBy != u.UserId
      ) AS teamsInvolved,
      ROUND(
        COALESCE(
          (SELECT COUNT(DISTINCT tc2.Username)
           FROM TaskCollaborators tc2
           WHERE tc2.TaskId IN (SELECT t.TaskId FROM Tasks t WHERE t.CreatedBy = u.UserId)
           AND tc2.Username != u.Name), 0
        ) * 1.0 +
        COALESCE(
          (SELECT COUNT(DISTINCT t2.CreatedBy)
           FROM TaskCollaborators tc3
           INNER JOIN Tasks t2 ON t2.TaskId = tc3.TaskId
           WHERE tc3.Username = u.Name
           AND t2.CreatedBy != u.UserId), 0
        ) * 2.0
      , 2) AS centralityScore
    FROM Users u
    ORDER BY centralityScore DESC
    OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
  `);

  const [countResult] = await sequelize.query(`SELECT COUNT(*) AS cnt FROM Users`);

  const t1 = Date.now();

  const result = {
    result: {
      type: 'centrality',
      mode: 'optimized',
      topUsers: scores,
      totalUsers: countResult[0]?.cnt || 0,
    },
    timing: {
      db: t1 - t0,
      compute: 0,
      total: t1 - t0,
    },
  };

  cache.set(cacheKey, result, 60);
  return result;
}

/**
 * OPTIMIZED: Activity Rhythm Analysis
 * Single aggregated query with DATEPART
 */
async function computeRhythmOptimized() {
  const cacheKey = 'stats:rhythm:optimized';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const t0 = Date.now();

  const [globalPattern] = await sequelize.query(`
    SELECT
      EXTRACT(HOUR FROM "Timestamp")::INT AS hour,
      COUNT(*) AS count
    FROM "ActivityLogs"
    GROUP BY EXTRACT(HOUR FROM "Timestamp")
    ORDER BY hour
  `);

  // Pad missing hours
  const fullPattern = Array.from({ length: 24 }, (_, i) => {
    const existing = globalPattern.find(g => g.hour === i);
    return { hour: i, count: existing ? existing.count : 0 };
  });

  const [userPatterns] = await sequelize.query(`
    SELECT
      u.Name AS userName,
      EXTRACT(HOUR FROM al."Timestamp")::INT AS hour,
      COUNT(*) AS count
    FROM "ActivityLogs" al
    INNER JOIN "Users" u ON u."UserId" = al."UserId"
    GROUP BY u."Name", EXTRACT(HOUR FROM al."Timestamp")
    ORDER BY u."Name", hour
  `);

  // Aggregate user patterns
  const userMap = {};
  for (const row of userPatterns) {
    if (!userMap[row.userName]) {
      userMap[row.userName] = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    }
    userMap[row.userName][row.hour].count = row.count;
  }

  const aggregated = Object.entries(userMap)
    .map(([name, hours]) => ({
      userName: name,
      peakHour: hours.reduce((a, b) => (b.count > a.count ? b : a)).hour,
      totalActions: hours.reduce((s, h) => s + h.count, 0),
    }))
    .sort((a, b) => b.totalActions - a.totalActions)
    .slice(0, 20);

  const peakHour = fullPattern.reduce((a, b) => (b.count > a.count ? b : a)).hour;

  const t1 = Date.now();

  const result = {
    result: {
      type: 'rhythm',
      mode: 'optimized',
      globalPattern: fullPattern,
      peakHour,
      userPatterns: aggregated,
    },
    timing: {
      db: t1 - t0,
      compute: 0,
      total: t1 - t0,
    },
  };

  cache.set(cacheKey, result, 60);
  return result;
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

const COMPUTATIONS = {
  density:      { naive: computeDensityNaive,      optimized: computeDensityOptimized },
  productivity: { naive: computeProductivityNaive, optimized: computeProductivityOptimized },
  heatmap:      { naive: computeHeatmapNaive,      optimized: computeHeatmapOptimized },
  centrality:   { naive: computeCentralityNaive,   optimized: computeCentralityOptimized },
  rhythm:       { naive: computeRhythmNaive,       optimized: computeRhythmOptimized },
};

/**
 * Compute a heavy statistic.
 * @param {string} type — One of: 'density', 'productivity', 'heatmap', 'centrality', 'rhythm'
 * @param {string} mode — 'naive' or 'optimized'
 * @returns {object} { result, timing }
 */
async function compute(type, mode) {
  const computation = COMPUTATIONS[type];
  if (!computation) throw new Error(`Unknown computation type: ${type}`);

  const fn = computation[mode];
  if (!fn) throw new Error(`Unknown mode: ${mode} (use 'naive' or 'optimized')`);

  return fn();
}

/**
 * Run all computations in both modes and return comparison.
 */
async function benchmark() {
  const types = ['density', 'productivity', 'heatmap', 'centrality', 'rhythm'];
  const results = [];

  for (const type of types) {
    console.log(`[StatsBenchmark] Running ${type} (naive)...`);
    const naiveResult = await compute(type, 'naive');
    console.log(`[StatsBenchmark] Running ${type} (optimized)...`);
    const optimizedResult = await compute(type, 'optimized');

    results.push({
      type,
      naive: {
        totalMs: naiveResult.timing.total,
        dbMs: naiveResult.timing.db,
        computeMs: naiveResult.timing.compute,
      },
      optimized: {
        totalMs: optimizedResult.timing.total,
        dbMs: optimizedResult.timing.db,
        computeMs: optimizedResult.timing.compute,
      },
      speedup: naiveResult.timing.total > 0
        ? (naiveResult.timing.total / Math.max(optimizedResult.timing.total, 1)).toFixed(1) + 'x'
        : 'N/A',
    });
  }

  return results;
}

module.exports = { compute, benchmark };
