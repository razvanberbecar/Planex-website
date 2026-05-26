// ──────────────────────────────────────────────────────────────
// Seeder: Seed roles, permissions, and demo users
// Idempotent — safe to re-run; uses queryInterface for reliability.
// Supports roles: admin, manager, editor, viewer, user
// ──────────────────────────────────────────────────────────────

'use strict';

const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql, opts) => queryInterface.sequelize.query(sql, opts);

    // ── Helper: find a single row by a simple WHERE clause ────
    const findOne = async (table, column, value) => {
      const [rows] = await q(
        `SELECT * FROM ${table} WHERE ${column} = :value`,
        { replacements: { value }, type: Sequelize.QueryTypes.SELECT }
      );
      return rows || null;
    };

    // ── Permission Definitions ────────────────────────────────
    const permDefs = [
      // Task permissions
      ['tasks:create',   'Create new tasks'],
      ['tasks:read',     'View tasks'],
      ['tasks:update',   'Update existing tasks'],
      ['tasks:delete',   'Delete tasks'],
      ['tasks:assign',   'Assign tasks to users'],
      ['tasks:manage',   'Full task management (manager+)'],

      // Subtask permissions
      ['subtasks:create', 'Create subtasks'],
      ['subtasks:update', 'Update subtasks'],
      ['subtasks:delete', 'Delete subtasks'],

      // User management
      ['users:view',     'View user list'],
      ['users:manage',   'Manage users (admin only)'],
      ['users:roles',    'Change user roles'],

      // System settings
      ['settings:view',  'View system settings'],
      ['settings:edit',  'Modify system settings'],

      // Admin / Monitoring
      ['admin:access',   'Access admin panel'],
      ['admin:audit',    'View audit logs'],
      ['admin:suspicious','Manage suspicious activities'],

      // Reports
      ['reports:view',   'View reports and statistics'],
      ['reports:export', 'Export reports'],

      // API access
      ['api:keys',       'Manage API keys'],
      ['api:access',     'Access via API'],

      // Collaboration
      ['collaboration:invite', 'Invite collaborators'],
      ['collaboration:manage', 'Manage collaborators'],
    ];

    // ── Create Permissions ────────────────────────────────────
    const permMap = {};
    for (const [name, desc] of permDefs) {
      let existing = await findOne('Permissions', 'Name', name);
      if (!existing) {
        await q(
          `INSERT INTO Permissions (Name, Description, CreatedAt, UpdatedAt) VALUES (:name, :desc, NOW(), NOW())`,
          { replacements: { name, desc } }
        );
        existing = await findOne('Permissions', 'Name', name);
      }
      permMap[name] = existing.PermissionId;
    }

    // ── Roles with Descriptions ───────────────────────────────
    const roleDefs = [
      ['admin',   'System administrator with unrestricted access'],
      ['manager', 'Manager with elevated task and user management permissions'],
      ['editor',  'Editor who can create and modify tasks and subtasks'],
      ['viewer',  'Read-only access to tasks and reports'],
      ['user',    'Standard user with basic task management permissions'],
    ];

    const roleMap = {};
    for (const [name, desc] of roleDefs) {
      let existing = await findOne('Roles', 'Name', name);
      if (!existing) {
        await q(
          `INSERT INTO Roles (Name, Description, CreatedAt, UpdatedAt) VALUES (:name, :desc, NOW(), NOW())`,
          { replacements: { name, desc } }
        );
        existing = await findOne('Roles', 'Name', name);
      }
      roleMap[name] = existing.RoleId;
    }

    // ── Clear existing role-permission mappings ──────────────
    await q(`DELETE FROM RolePermissions`, { type: Sequelize.QueryTypes.DELETE });

    // ── Role → Permission Mappings ──────────────────────────
    const addRp = async (roleName, permName) => {
      const roleId = roleMap[roleName];
      const permId = permMap[permName];
      if (roleId && permId) {
        const existing = await findOne('RolePermissions', 'RoleId', roleId);
        // Check both columns
        const [rows] = await q(
          `SELECT 1 FROM RolePermissions WHERE RoleId = :roleId AND PermissionId = :permId`,
          { replacements: { roleId, permId }, type: Sequelize.QueryTypes.SELECT }
        );
        if (!rows) {
          await q(
            `INSERT INTO RolePermissions (RoleId, PermissionId, CreatedAt, UpdatedAt) VALUES (:roleId, :permId, NOW(), NOW())`,
            { replacements: { roleId, permId } }
          );
        }
      }
    };

    // ── Admin: ALL permissions ──────────────────────────────
    for (const [name] of permDefs) {
      await addRp('admin', name);
    }

    // ── Manager: Elevated permissions ───────────────────────
    const managerPerms = [
      'tasks:create', 'tasks:read', 'tasks:update', 'tasks:delete',
      'tasks:assign', 'tasks:manage',
      'subtasks:create', 'subtasks:update', 'subtasks:delete',
      'users:view',
      'settings:view',
      'reports:view', 'reports:export',
      'api:access',
      'collaboration:invite', 'collaboration:manage',
      'admin:access',
    ];
    for (const p of managerPerms) await addRp('manager', p);

    // ── Editor: Task + Subtask CRUD ─────────────────────────
    const editorPerms = [
      'tasks:create', 'tasks:read', 'tasks:update', 'tasks:assign',
      'subtasks:create', 'subtasks:update', 'subtasks:delete',
      'reports:view',
      'api:access',
      'collaboration:invite',
      'settings:view',
    ];
    for (const p of editorPerms) await addRp('editor', p);

    // ── Viewer: Read-only ───────────────────────────────────
    const viewerPerms = [
      'tasks:read',
      'reports:view',
      'settings:view',
      'api:access',
    ];
    for (const p of viewerPerms) await addRp('viewer', p);

    // ── User: Basic task management ─────────────────────────
    const userPerms = [
      'tasks:create', 'tasks:read', 'tasks:update', 'tasks:assign',
      'subtasks:create', 'subtasks:update', 'subtasks:delete',
      'reports:view',
      'api:access',
      'collaboration:invite',
    ];
    for (const p of userPerms) await addRp('user', p);

    // ── Demo Users ──────────────────────────────────────────
    const adminPassword = await bcrypt.hash('admin123', 12);
    const managerPassword = await bcrypt.hash('manager123', 12);
    const editorPassword = await bcrypt.hash('editor123', 12);
    const viewerPassword = await bcrypt.hash('viewer123', 12);
    const userPassword  = await bcrypt.hash('user123', 12);

    const userDefs = [
      ['Admin User',   'admin@planex.com',   adminPassword,   'admin'],
      ['Manager User', 'manager@planex.com', managerPassword, 'manager'],
      ['Editor User',  'editor@planex.com',  editorPassword,  'editor'],
      ['Viewer User',  'viewer@planex.com',  viewerPassword,  'viewer'],
      ['Normal User',  'user@planex.com',    userPassword,    'user'],
    ];

    for (const [name, email, pass, roleName] of userDefs) {
      const roleId = roleMap[roleName];
      const existing = await findOne('Users', 'Email', email);
      if (!existing) {
        await q(
          `INSERT INTO Users (Name, Email, Password, RoleId, CreatedAt, UpdatedAt) VALUES (:name, :email, :pass, :roleId, NOW(), NOW())`,
          { replacements: { name, email, pass, roleId } }
        );
        console.log(`  [Seed] Created user ${email}`);
      } else {
        await q(
          `UPDATE Users SET Password = :pass, RoleId = :roleId, UpdatedAt = NOW() WHERE Email = :email`,
          { replacements: { pass, roleId, email } }
        );
        console.log(`  [Seed] Updated password/role for existing user ${email}`);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('DELETE FROM Users', { type: Sequelize.QueryTypes.DELETE });
    await queryInterface.sequelize.query('DELETE FROM RolePermissions', { type: Sequelize.QueryTypes.DELETE });
    await queryInterface.sequelize.query('DELETE FROM Permissions', { type: Sequelize.QueryTypes.DELETE });
    await queryInterface.sequelize.query('DELETE FROM Roles', { type: Sequelize.QueryTypes.DELETE });
  },
};
