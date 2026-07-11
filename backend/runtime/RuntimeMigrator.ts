import type Database from "better-sqlite3";

const SCHEMA_VERSION = 4;

export class RuntimeMigrator {
  migrate(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS runtime_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    const version = db.prepare("SELECT value FROM runtime_metadata WHERE key = 'schema_version'").get() as { value: string } | undefined;
    if (version?.value !== String(SCHEMA_VERSION)) this.resetLegacyRuntime(db);
    this.createSchema(db);
  }

  private resetLegacyRuntime(db: Database.Database): void {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS agent_run_logs;
      DROP TABLE IF EXISTS agent_runs;
      DROP TABLE IF EXISTS consumer_offsets;
      DROP TABLE IF EXISTS step_run_logs;
      DROP TABLE IF EXISTS step_runs;
      DROP TABLE IF EXISTS loop_runs;
      DROP TABLE IF EXISTS loop_instances;
      DROP TABLE IF EXISTS loop_instance_steps;
      DROP TABLE IF EXISTS thread_bindings;
      DROP TABLE IF EXISTS events;
      DELETE FROM runtime_metadata;
      INSERT INTO runtime_metadata (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}');
      PRAGMA foreign_keys = ON;
    `);
  }

  private createSchema(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        subject TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        causation_id TEXT,
        dedupe_key TEXT,
        correlation_depth INTEGER NOT NULL DEFAULT 0,
        occurred_at TEXT NOT NULL,
        project_id TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'unassigned',
        handling_result TEXT,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS loop_runs (
        run_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        loop_id TEXT NOT NULL,
        root_run_id TEXT NOT NULL,
        parent_run_id TEXT,
        parent_step_run_id TEXT,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        runtime_device_id TEXT,
        execution_plan_json TEXT,
        input TEXT,
        snapshot_json TEXT NOT NULL,
        transition_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY(parent_run_id) REFERENCES loop_runs(run_id),
        FOREIGN KEY(parent_step_run_id) REFERENCES step_runs(step_run_id)
      );

      CREATE TABLE IF NOT EXISTS step_runs (
        step_run_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        loop_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        step_type TEXT NOT NULL,
        agent_id TEXT,
        execution_task_id TEXT,
        execution_snapshot_json TEXT,
        status TEXT NOT NULL,
        input TEXT,
        response_input TEXT,
        result TEXT,
        outcome_json TEXT,
        error TEXT,
        attempt INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY(run_id) REFERENCES loop_runs(run_id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe_key ON events(project_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_loop_runs_one_active
        ON loop_runs(project_id, loop_id) WHERE status IN ('running', 'waiting_for_human');
      CREATE INDEX IF NOT EXISTS idx_loop_runs_latest ON loop_runs(project_id, loop_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_loop_runs_root ON loop_runs(project_id, root_run_id);
      CREATE INDEX IF NOT EXISTS idx_step_runs_queue ON step_runs(project_id, status, created_at);
      CREATE INDEX IF NOT EXISTS idx_step_runs_run ON step_runs(project_id, run_id, created_at);
    `);
  }
}
