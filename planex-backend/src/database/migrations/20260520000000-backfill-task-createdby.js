// ──────────────────────────────────────────────────────────────
// Migration: Backfill CreatedBy for unowned tasks
// Seed data tasks were created without a CreatedBy (NULL).
// This migration assigns them to the Admin user.
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Assign all unowned tasks to the Admin user
    await queryInterface.sequelize.query(`
      UPDATE "Tasks"
      SET "CreatedBy" = (
        SELECT u."UserId"
        FROM "Users" u
        INNER JOIN "Roles" r ON u."RoleId" = r."RoleId"
        WHERE r."Name" = 'Admin'
        LIMIT 1
      )
      WHERE "CreatedBy" IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert: set CreatedBy back to NULL for tasks that were originally unowned
    // We can't reliably know which ones were originally unowned after backfill,
    // so this is intentionally a no-op to prevent data loss.
    // To restore, re-run the seed migration.
  },
};
