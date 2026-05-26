// ──────────────────────────────────────────────────────────────
// Migration: Add Performance Indexes for Statistics & Detection
//
// These indexes optimize the heavy statistics computations and
// the detection engine queries, reducing full table scans.
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const safeAddIndex = async (table, fields, options) => {
      try {
        await queryInterface.addIndex(table, fields, options);
        console.log(`  ✓ Index ${options.name} created on ${table}`);
      } catch (err) {
        // Index may already exist — that's fine
        console.log(`  ~ Index ${options.name} on ${table}: ${err.message}`);
      }
    };

    // ── Tasks Indexes ───────────────────────────────────────
    await safeAddIndex('Tasks', ['CreatedBy', 'IsCompleted'], {
      name: 'IX_Tasks_CreatedBy_IsCompleted',
    });
    await safeAddIndex('Tasks', ['Priority', 'DueDate'], {
      name: 'IX_Tasks_Priority_DueDate',
    });
    await safeAddIndex('Tasks', ['IsCompleted'], {
      name: 'IX_Tasks_IsCompleted',
    });
    await safeAddIndex('Tasks', ['DueDate'], {
      name: 'IX_Tasks_DueDate',
    });

    // ── TaskCollaborators Indexes ───────────────────────────
    await safeAddIndex('TaskCollaborators', ['Username'], {
      name: 'IX_TC_Username',
    });
    await safeAddIndex('TaskCollaborators', ['TaskId', 'Username'], {
      name: 'IX_TC_TaskId_Username',
      unique: true,
    });

    // ── ActivityLogs Indexes (augment existing) ─────────────
    await safeAddIndex('ActivityLogs', ['UserId', 'Action', 'Timestamp'], {
      name: 'IX_AL_UserId_Action_Timestamp',
    });
    await safeAddIndex('ActivityLogs', ['Action', 'Timestamp'], {
      name: 'IX_AL_Action_Timestamp',
    });

    // ── Users Indexes ───────────────────────────────────────
    await safeAddIndex('Users', ['Name'], {
      name: 'IX_Users_Name',
    });

    // ── Subtasks Indexes ────────────────────────────────────
    await safeAddIndex('Subtasks', ['TaskId', 'IsCompleted'], {
      name: 'IX_Subtasks_TaskId_IsCompleted',
    });
  },

  async down(queryInterface) {
    const safeRemoveIndex = async (table, name) => {
      try {
        await queryInterface.removeIndex(table, name);
        console.log(`  ✓ Index ${name} removed from ${table}`);
      } catch (err) {
        console.log(`  ~ Index ${name} on ${table}: ${err.message}`);
      }
    };

    await safeRemoveIndex('Tasks', 'IX_Tasks_CreatedBy_IsCompleted');
    await safeRemoveIndex('Tasks', 'IX_Tasks_Priority_DueDate');
    await safeRemoveIndex('Tasks', 'IX_Tasks_IsCompleted');
    await safeRemoveIndex('Tasks', 'IX_Tasks_DueDate');
    await safeRemoveIndex('TaskCollaborators', 'IX_TC_Username');
    await safeRemoveIndex('TaskCollaborators', 'IX_TC_TaskId_Username');
    await safeRemoveIndex('ActivityLogs', 'IX_AL_UserId_Action_Timestamp');
    await safeRemoveIndex('ActivityLogs', 'IX_AL_Action_Timestamp');
    await safeRemoveIndex('Users', 'IX_Users_Name');
    await safeRemoveIndex('Subtasks', 'IX_Subtasks_TaskId_IsCompleted');
  },
};
