// ──────────────────────────────────────────────────────────────
// Migration: Seed initial data (5 tasks + subtasks + collaborators)
// Matches the seed data from the original in-memory repository.
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // ── Tasks ────────────────────────────────────────────────
    await queryInterface.bulkInsert('Tasks', [
      { Title: 'task 1', Description: 'description for task 1', DueDate: '2026-06-30', IsCompleted: false, Priority: 'High'   },
      { Title: 'task 2', Description: 'description for task 2', DueDate: '2026-07-15', IsCompleted: true,  Priority: 'Low'    },
      { Title: 'task 3', Description: 'description for task 3', DueDate: '2027-01-01', IsCompleted: false, Priority: 'Medium' },
      { Title: 'task 4', Description: 'description for task 4', DueDate: '2027-02-01', IsCompleted: true,  Priority: 'Low'    },
      { Title: 'task 5', Description: 'description for task 5', DueDate: '2026-12-01', IsCompleted: false, Priority: 'Medium' },
    ]);

    // ── Subtasks ─────────────────────────────────────────────
    await queryInterface.bulkInsert('Subtasks', [
      { TaskId: 1, Title: 'Research topic',    IsCompleted: false },
      { TaskId: 1, Title: 'Write draft',        IsCompleted: true  },
      { TaskId: 3, Title: 'Invite collaborators', IsCompleted: false },
    ]);

    // ── Task Collaborators ───────────────────────────────────
    await queryInterface.bulkInsert('TaskCollaborators', [
      { TaskId: 1, Username: 'user1' },
      { TaskId: 3, Username: 'user1' },
      { TaskId: 3, Username: 'user2' },
      { TaskId: 4, Username: 'user5' },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('TaskCollaborators', null, {});
    await queryInterface.bulkDelete('Subtasks', null, {});
    await queryInterface.bulkDelete('Tasks', null, {});
  },
};

