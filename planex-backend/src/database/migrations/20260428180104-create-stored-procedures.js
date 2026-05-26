// ──────────────────────────────────────────────────────────────
// Migration: Create PostgreSQL Functions & Triggers
// ──────────────────────────────────────────────────────────────

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── FUNCTION: Auto-update UpdatedAt on Tasks ──────────────
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION trg_tasks_updatedat()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."UpdatedAt" = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for Tasks
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tasks_updatedat_trigger') THEN
          CREATE TRIGGER trg_tasks_updatedat_trigger
            BEFORE UPDATE ON "Tasks"
            FOR EACH ROW
            EXECUTE FUNCTION trg_tasks_updatedat();
        END IF;
      END;
      $$;
    `);

    // ── FUNCTION: Auto-update UpdatedAt on Subtasks ──────────
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION trg_subtasks_updatedat()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."UpdatedAt" = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subtasks_updatedat_trigger') THEN
          CREATE TRIGGER trg_subtasks_updatedat_trigger
            BEFORE UPDATE ON "Subtasks"
            FOR EACH ROW
            EXECUTE FUNCTION trg_subtasks_updatedat();
        END IF;
      END;
      $$;
    `);

    // ── FUNCTION: Get Task Statistics ─────────────────────────
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION sp_gettaskstatistics()
      RETURNS TABLE(
        "Total" INT,
        "Completed" INT,
        "Active" INT,
        "Collaborative" INT,
        "Solo" INT,
        "CompletionRate" INT,
        "CollaborativeRate" INT,
        "PeakMonth" TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        WITH task_stats AS (
          SELECT
            COUNT(*)::INT AS total,
            COUNT(*) FILTER (WHERE "IsCompleted" = true)::INT AS completed,
            COUNT(*) FILTER (WHERE "IsCompleted" = false)::INT AS active
          FROM "Tasks"
        ),
        collab_stats AS (
          SELECT
            COUNT(DISTINCT t."TaskId")::INT AS collaborative
          FROM "Tasks" t
          INNER JOIN "TaskCollaborators" tc ON t."TaskId" = tc."TaskId"
        ),
        monthly AS (
          SELECT
            TO_CHAR("DueDate", 'Mon-YY') AS month,
            COUNT(*)::INT AS tasks
          FROM "Tasks"
          GROUP BY TO_CHAR("DueDate", 'Mon-YY')
        )
        SELECT
          ts.total,
          ts.completed,
          ts.active,
          COALESCE(cs.collaborative, 0) AS collaborative,
          (ts.total - COALESCE(cs.collaborative, 0)) AS solo,
          CASE WHEN ts.total > 0 THEN ROUND((ts.completed::NUMERIC / ts.total * 100))::INT ELSE 0 END AS "CompletionRate",
          CASE WHEN ts.total > 0 THEN ROUND((COALESCE(cs.collaborative, 0)::NUMERIC / ts.total * 100))::INT ELSE 0 END AS "CollaborativeRate",
          COALESCE(
            (SELECT month FROM monthly ORDER BY tasks DESC LIMIT 1),
            '—'
          ) AS "PeakMonth"
        FROM task_stats ts, collab_stats cs;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // ── FUNCTION: Get Filtered Tasks ─────────────────────────
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION sp_getfilteredtasks(
        p_filter TEXT DEFAULT 'all',
        p_search TEXT DEFAULT '',
        p_priority TEXT DEFAULT '',
        p_sortby TEXT DEFAULT '',
        p_page INT DEFAULT 1,
        p_limit INT DEFAULT 5
      )
      RETURNS TABLE(
        "TaskId" INT,
        "Title" VARCHAR,
        "Description" TEXT,
        "DueDate" DATE,
        "IsCompleted" BOOLEAN,
        "Priority" VARCHAR,
        "CreatedBy" INT,
        "CreatedAt" TIMESTAMPTZ,
        "UpdatedAt" TIMESTAMPTZ,
        "HasCollaborators" INT,
        total_count INT
      ) AS $$
      DECLARE
        v_offset INT;
        v_total INT;
      BEGIN
        v_offset := (p_page - 1) * p_limit;

        -- Create temporary results
        CREATE TEMP TABLE _filtered_tasks ON COMMIT DROP AS
        SELECT
          t.*,
          CASE WHEN EXISTS (SELECT 1 FROM "TaskCollaborators" tc WHERE tc."TaskId" = t."TaskId") THEN 1 ELSE 0 END AS "HasCollaborators"
        FROM "Tasks" t
        WHERE
          (p_filter = 'all' OR
           (p_filter = 'active' AND t."IsCompleted" = false) OR
           (p_filter = 'completed' AND t."IsCompleted" = true) OR
           (p_filter = 'collaborative' AND EXISTS (SELECT 1 FROM "TaskCollaborators" tc WHERE tc."TaskId" = t."TaskId")))
          AND (p_search = '' OR t."Title" ILIKE '%' || p_search || '%')
          AND (p_priority = '' OR t."Priority" = p_priority);

        SELECT COUNT(*) INTO v_total FROM _filtered_tasks;

        RETURN QUERY
        SELECT
          f.*,
          v_total AS total_count
        FROM _filtered_tasks f
        ORDER BY
          CASE WHEN p_sortby = 'priority_asc'
            THEN CASE f."Priority" WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END
          END,
          CASE WHEN p_sortby = 'priority_desc'
            THEN CASE f."Priority" WHEN 'High' THEN 2 WHEN 'Medium' THEN 1 ELSE 0 END
          END,
          f."TaskId" DESC
        LIMIT p_limit OFFSET v_offset;
      END;
      $$ LANGUAGE plpgsql;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS sp_gettaskstatistics()');
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS sp_getfilteredtasks(TEXT, TEXT, TEXT, TEXT, INT, INT)');
    await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS trg_tasks_updatedat_trigger ON "Tasks"');
    await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS trg_subtasks_updatedat_trigger ON "Subtasks"');
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS trg_tasks_updatedat()');
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS trg_subtasks_updatedat()');
  },
};
