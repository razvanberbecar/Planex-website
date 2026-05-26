// ──────────────────────────────────────────────────────────────
// Faker Data Generation Script
// Generates 50,000+ records across all tables for benchmarking.
// Run: npm run db:faker
// ──────────────────────────────────────────────────────────────

const { faker } = require('@faker-js/faker');
const { sequelize, User, Role, Task, Subtask, TaskCollaborator, ActivityLog, SuspiciousActivity, ObservationList } = require('../database/models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

// ── Configuration ───────────────────────────────────────────
const CONFIG = {
  USERS: 500,
  TASKS: 20000,
  COLLABORATOR_LINKS: 40000,
  SUBTASKS: 30000,
  ACTIVITY_LOGS: 100000,
  SUSPICIOUS_ACTIVITIES: 1000,
  BATCH_SIZE: 1000, // Insert in batches
};

const PRIORITIES = ['High', 'Medium', 'Low'];
const ACTIONS = [
  'CREATE_TASK', 'VIEW_TASK', 'UPDATE_TASK', 'DELETE_TASK', 'TOGGLE_TASK',
  'CREATE_SUBTASK', 'UPDATE_SUBTASK', 'DELETE_SUBTASK',
  'LOGIN', 'LOGOUT', 'VIEW_STATISTICS',
  'CREATE_TASK', 'VIEW_TASK', 'UPDATE_TASK', 'TOGGLE_TASK',
  'CREATE_SUBTASK', 'VIEW_TASK', 'VIEW_STATISTICS',
];
const SUSPICIOUS_RULES = [
  'RAPID_SUCCESSIVE_ACTIONS', 'MASS_DELETION', 'UNUSUAL_HOURS',
  'EXCESSIVE_FAILED_LOGINS', 'RAPID_CREATE_DELETE', 'MASS_STATUS_TOGGLE',
];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const OBSERVATION_STATUSES = ['UNDER_OBSERVATION', 'CLEARED', 'RESTRICTED'];

// ── Helpers ─────────────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Progress Logger ─────────────────────────────────────────
let lastProgress = 0;
function logProgress(label, current, total) {
  const pct = Math.round((current / total) * 100);
  if (pct >= lastProgress + 10 || current === total) {
    lastProgress = pct;
    console.log(`  [${String(pct).padStart(3)}%] ${label}: ${current}/${total}`);
  }
}

// ── Batch Inserter ──────────────────────────────────────────
async function batchInsert(tableName, rows, options = {}) {
  const batchSize = options.batchSize || CONFIG.BATCH_SIZE;
  const identityColumn = options.identityColumn || null;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const columns = Object.keys(batch[0]);
    const colList = columns.map(k => `"${k}"`).join(', ');
    const valuesSql = batch.map(row => {
      const vals = Object.values(row).map(v => {
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return v;
        if (typeof v === 'boolean') return v ? '1' : '0';
        if (v instanceof Date) return `'${v.toISOString().slice(0, 19)}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      return `(${vals.join(', ')})`;
    }).join(', ');

    let sql = '';
    if (identityColumn) {
      sql += `SET IDENTITY_INSERT "${tableName}" ON; `;
    }
    sql += `INSERT INTO "${tableName}" (${colList}) VALUES ${valuesSql}`;
    if (identityColumn) {
      sql += `; SET IDENTITY_INSERT "${tableName}" OFF`;
    }

    await sequelize.query(sql);
  }
}

// ── Main Seed Function ──────────────────────────────────────
async function seed() {
  const startTime = Date.now();
  console.log('\n  ╔═══════════════════════════════════════════════╗');
  console.log('  ║     🌱 FAKER DATA GENERATION                  ║');
  console.log('  ╚═══════════════════════════════════════════════╝\n');

  // ── Clear existing data (in reverse FK order) ─────────────
  console.log('  [---] Clearing existing data...');
  await sequelize.query('DELETE FROM ObservationList');
  await sequelize.query('DELETE FROM SuspiciousActivities');
  await sequelize.query('DELETE FROM ActivityLogs');
  await sequelize.query('DELETE FROM Subtasks');
  await sequelize.query('DELETE FROM TaskCollaborators');
  await sequelize.query('DELETE FROM Tasks');
  await sequelize.query('DELETE FROM Sessions');
  await sequelize.query('DELETE FROM Users WHERE UserId > 10'); // Keep seed users (admins)
  console.log('  ✅ Existing data cleared\n');

  // ──────────────────────────────────────────────────────────
  // 1. Users (500)
  // ──────────────────────────────────────────────────────────
  console.log('  [---] Generating Users...');
  const roles = await Role.findAll({ raw: true });
  const roleIds = roles.map(r => r.RoleId);
  
  const users = [];
  const userNames = [];
  for (let i = 0; i < CONFIG.USERS; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    userNames.push(name);
    users.push({
      Name: name,
      Email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      Password: await bcrypt.hash('password123', 6),
      RoleId: pickRandom(roleIds),
      CreatedAt: randomDate(new Date('2024-01-01'), new Date('2026-05-01')),
      UpdatedAt: new Date(),
    });
    logProgress('Users', i + 1, CONFIG.USERS);
  }
  // Use raw INSERT for MSSQL compatibility (ignoreDuplicates not supported)
  await sequelize.query(
    `INSERT INTO Users (Name, Email, Password, RoleId, CreatedAt, UpdatedAt) VALUES ${users.map(u =>
      `(N'${u.Name.replace(/'/g, "''")}', N'${u.Email.replace(/'/g, "''")}', '${u.Password}', ${u.RoleId}, '${u.CreatedAt.toISOString()}', '${u.UpdatedAt.toISOString()}')`
    ).join(',')}`
  );
  const dbUsers = await User.findAll({ raw: true, attributes: ['UserId', 'Name'] });
  const userIds = dbUsers.map(u => u.UserId);
  const userNameMap = new Map(dbUsers.map(u => [u.Name, u.UserId]));
  console.log(`  ✅ ${dbUsers.length} users created\n`);

  // ──────────────────────────────────────────────────────────
  // 2. Tasks (20,000)
  // ──────────────────────────────────────────────────────────
  console.log('  [---] Generating Tasks...');
  const taskRows = [];
  const taskIds = [];
  for (let i = 0; i < CONFIG.TASKS; i++) {
    const taskId = i + 1;
    taskIds.push(taskId);
    taskRows.push({
      TaskId: taskId,
      Title: faker.lorem.sentence({ min: 3, max: 8 }).slice(0, 100),
      Description: Math.random() > 0.3 ? faker.lorem.paragraph() : '',
      DueDate: faker.date.between({ from: '2024-06-01', to: '2026-12-31' }).toISOString().slice(0, 10),
      IsCompleted: Math.random() > 0.4,
      Priority: pickRandom(PRIORITIES),
      CreatedBy: pickRandom(userIds),
      CreatedAt: randomDate(new Date('2024-01-01'), new Date('2026-05-01')),
      UpdatedAt: new Date(),
    });
    logProgress('Tasks', i + 1, CONFIG.TASKS);
  }
  await batchInsert('Tasks', taskRows, { identityColumn: 'TaskId' });
  console.log(`  ✅ ${taskIds.length} tasks created\n`);

  // ──────────────────────────────────────────────────────────
  // 3. TaskCollaborators (40,000 links)
  // ──────────────────────────────────────────────────────────
  console.log('  [---] Generating Collaborator Links...');
  const collabRows = [];
  const usedPairs = new Set();
  for (let i = 0; i < CONFIG.COLLABORATOR_LINKS; i++) {
    const taskId = pickRandom(taskIds);
    const userName = pickRandom(userNames);
    const key = `${taskId}-${userName}`;
    if (usedPairs.has(key)) continue;
    usedPairs.add(key);
    collabRows.push({
      TaskId: taskId,
      Username: userName,
    });
    logProgress('Collaborators', i + 1, CONFIG.COLLABORATOR_LINKS);
  }
  await batchInsert('TaskCollaborators', collabRows);
  console.log(`  ✅ ${collabRows.length} collaborator links created\n`);

  // ──────────────────────────────────────────────────────────
  // 4. Subtasks (30,000)
  // ──────────────────────────────────────────────────────────
  console.log('  [---] Generating Subtasks...');
  const subtaskRows = [];
  for (let i = 0; i < CONFIG.SUBTASKS; i++) {
    subtaskRows.push({
      TaskId: pickRandom(taskIds),
      Title: faker.lorem.sentence({ min: 2, max: 6 }).slice(0, 100),
      IsCompleted: Math.random() > 0.5,
    });
    logProgress('Subtasks', i + 1, CONFIG.SUBTASKS);
  }
  await batchInsert('Subtasks', subtaskRows);
  console.log(`  ✅ ${subtaskRows.length} subtasks created\n`);

  // ──────────────────────────────────────────────────────────
  // 5. ActivityLogs (100,000)
  // ──────────────────────────────────────────────────────────
  console.log('  [---] Generating Activity Logs...');
  const logRows = [];
  for (let i = 0; i < CONFIG.ACTIVITY_LOGS; i++) {
    const userId = pickRandom(userIds);
    const action = pickRandom(ACTIONS);
    logRows.push({
      UserId: userId,
      Action: action,
      ResourceType: action.includes('TASK') ? 'Task' : action.includes('SUBTASK') ? 'Subtask' : null,
      ResourceId: Math.random() > 0.3 ? pickRandom(taskIds) : null,
      Details: Math.random() > 0.7 ? JSON.stringify({ extra: faker.lorem.word() }) : null,
      IpAddress: faker.internet.ip(),
      UserAgent: faker.internet.userAgent(),
      Timestamp: randomDate(new Date('2025-01-01'), new Date('2026-05-16')),
    });
    logProgress('ActivityLogs', i + 1, CONFIG.ACTIVITY_LOGS);
  }
  await batchInsert('ActivityLogs', logRows);
  console.log(`  ✅ ${logRows.length} activity logs created\n`);

  // ──────────────────────────────────────────────────────────
  // 6. SuspiciousActivities (1,000)
  // ──────────────────────────────────────────────────────────
  console.log('  [---] Generating Suspicious Activities...');
  const saRows = [];
  for (let i = 0; i < CONFIG.SUSPICIOUS_ACTIVITIES; i++) {
    const userId = pickRandom(userIds);
    const logEntries = await ActivityLog.findAll({
      where: { UserId: userId },
      limit: 1,
      order: sequelize.random(),
      raw: true,
    });
    saRows.push({
      UserId: userId,
      ActivityLogId: logEntries.length > 0 ? logEntries[0].LogId : null,
      RuleTriggered: pickRandom(SUSPICIOUS_RULES),
      Severity: pickRandom(SEVERITIES),
      Details: JSON.stringify({
        detectedAt: new Date().toISOString(),
        evidence: faker.lorem.sentence(),
        count: randomInt(5, 50),
      }),
      IsReviewed: Math.random() > 0.6,
      DetectedAt: randomDate(new Date('2025-06-01'), new Date('2026-05-16')),
      ReviewedBy: Math.random() > 0.6 ? pickRandom(userIds) : null,
      ReviewedAt: Math.random() > 0.6 ? new Date() : null,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
    });
    logProgress('SuspiciousActivities', i + 1, CONFIG.SUSPICIOUS_ACTIVITIES);
  }
  await batchInsert('SuspiciousActivities', saRows);
  console.log(`  ✅ ${saRows.length} suspicious activities created\n`);

  // ──────────────────────────────────────────────────────────
  // 7. ObservationList (some users under observation)
  // ──────────────────────────────────────────────────────────
  console.log('  [---] Generating Observation List...');
  const obsRows = [];
  const observedUserIds = new Set();
  const suspiciousIds = await SuspiciousActivity.findAll({ attributes: ['SuspiciousActivityId'], raw: true });
  const saIds = suspiciousIds.map(s => s.SuspiciousActivityId);
  const adminUsers = dbUsers.slice(0, 3).map(u => u.UserId); // first 3 users are "admins"

  for (let i = 0; i < 200; i++) {
    const userId = pickRandom(userIds);
    if (observedUserIds.has(userId)) continue;
    observedUserIds.add(userId);
    obsRows.push({
      UserId: userId,
      AddedBy: pickRandom(adminUsers),
      Reason: faker.lorem.sentence(),
      Status: pickRandom(OBSERVATION_STATUSES),
      SuspiciousActivityId: Math.random() > 0.3 && saIds.length > 0 ? pickRandom(saIds) : null,
      StartedAt: randomDate(new Date('2025-06-01'), new Date('2026-05-16')),
      EndedAt: Math.random() > 0.5 ? new Date() : null,
      Notes: Math.random() > 0.5 ? faker.lorem.sentence() : null,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
    });
    logProgress('ObservationList', i + 1, 200);
  }
  await batchInsert('ObservationList', obsRows);
  console.log(`  ✅ ${obsRows.length} observation entries created\n`);

  // ── Summary ───────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('  ╔═══════════════════════════════════════════════╗');
  console.log(`  ║   ✅ GENERATION COMPLETE in ${elapsed}s            ║`);
  console.log('  ╚═══════════════════════════════════════════════╝');
  console.log(`  Users:                ${dbUsers.length}`);
  console.log(`  Tasks:                ${taskIds.length}`);
  console.log(`  Collaborator Links:   ${collabRows.length}`);
  console.log(`  Subtasks:             ${subtaskRows.length}`);
  console.log(`  Activity Logs:        ${logRows.length}`);
  console.log(`  Suspicious Activities: ${saRows.length}`);
  console.log(`  Observation List:     ${obsRows.length}`);
  console.log('');
}

// ── Run ─────────────────────────────────────────────────────
seed()
  .then(() => {
    console.log('  🎉 Seeding complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('  ❌ Seeding failed:', err);
    process.exit(1);
  });
