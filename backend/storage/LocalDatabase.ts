import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { migrateV1ToV2 } from "./migrateV1ToV2.js";

const SCHEMA_VERSION = 2;

export class LocalDatabase {
  private database?: Database.Database;

  constructor(readonly path: string) {}

  connection(): Database.Database {
    if (this.database) return this.database;
    mkdirSync(path.dirname(this.path), { recursive: true, mode: 0o700 });
    const database = new Database(this.path);
    database.pragma("journal_mode = WAL");
    database.pragma("synchronous = FULL");
    database.pragma("busy_timeout = 5000");
    database.pragma("foreign_keys = ON");
    try {
      this.createSchema(database);
    } catch (error) {
      database.close();
      throw error;
    }
    this.database = database;
    return database;
  }

  close(): void {
    this.database?.close();
    this.database = undefined;
  }

  private createSchema(database: Database.Database): void {
    const tables = database.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>;
    const tableNames = new Set(tables.map((table) => table.name));
    if (tables.length > 0 && !tableNames.has("metadata")) {
      throw new Error("Ballet state database has no schema version; persisted state was left unchanged.");
    }
    const version = tableNames.has("metadata")
      ? database.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get() as { value: string } | undefined
      : undefined;
    if (!version && tables.length > 0) throw new Error("Ballet state database has no schema version; persisted state was left unchanged.");
    const currentVersion = version ? Number(version.value) : undefined;
    if (currentVersion !== undefined && currentVersion !== 1 && currentVersion !== SCHEMA_VERSION) {
      throw new Error(`Unsupported Ballet state schema ${String(currentVersion)}; expected ${SCHEMA_VERSION}.`);
    }
    database.transaction(() => {
      database.exec(schema);
      if (!version) {
        database.prepare("INSERT INTO metadata (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
      } else if (currentVersion === 1) {
        migrateV1ToV2(database);
        database.prepare("UPDATE metadata SET value = ? WHERE key = 'schema_version'").run(String(SCHEMA_VERSION));
      }
    })();
  }
}

const schema = `
  CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS root_runs (
    root_run_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK(kind IN ('agent','loop')),
    target_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('manual','schedule')),
    status TEXT NOT NULL CHECK(status IN ('queued','running','waiting_for_human','finalizing','completed','blocked','failed','cancelled')),
    input TEXT,
    outcome_json TEXT,
    termination_json TEXT,
    error_code TEXT,
    error_message TEXT,
    worktree_path TEXT NOT NULL,
    branch TEXT NOT NULL,
    head_sha TEXT NOT NULL,
    config_hash TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL,
    runtime_snapshot_json TEXT,
    finalization_status TEXT CHECK(finalization_status IN ('finalizing','completed','failed')),
    finalization_terminal_status TEXT CHECK(finalization_terminal_status IN ('completed','blocked','failed','cancelled')),
    finalization_success INTEGER CHECK(finalization_success IN (0,1)),
    finalization_report_json TEXT,
    finalization_started_at TEXT,
    finalization_completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS loop_runs (
    run_id TEXT PRIMARY KEY,
    loop_id TEXT NOT NULL,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    parent_run_id TEXT REFERENCES loop_runs(run_id),
    parent_step_run_id TEXT,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    execution_plan_json TEXT,
    schedule_step_id TEXT,
    scheduled_for TEXT,
    input TEXT,
    snapshot_json TEXT NOT NULL,
    transition_count INTEGER NOT NULL DEFAULT 0,
    termination_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS step_runs (
    step_run_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES loop_runs(run_id) ON DELETE CASCADE,
    loop_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    step_type TEXT NOT NULL CHECK(step_type IN ('agent','human')),
    agent_id TEXT,
    execution_task_id TEXT,
    execution_snapshot_json TEXT,
    status TEXT NOT NULL,
    input TEXT,
    response_input TEXT,
    result TEXT,
    outcome_json TEXT,
    transition_json TEXT,
    error TEXT,
    attempt INTEGER NOT NULL DEFAULT 0,
    retry_of_step_run_id TEXT REFERENCES step_runs(step_run_id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS execution_tasks (
    task_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK(provider IN ('codex','copilot')),
    kind TEXT NOT NULL CHECK(kind IN ('agent_run','loop_step')),
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
    spec_json TEXT NOT NULL,
    spec_hash TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    cancel_requested_at TEXT,
    error_code TEXT,
    error_message TEXT,
    outcome_json TEXT,
    retained_content_bytes INTEGER NOT NULL DEFAULT 0,
    events_truncated INTEGER NOT NULL DEFAULT 0 CHECK(events_truncated IN (0,1)),
    last_sequence INTEGER NOT NULL DEFAULT -1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS execution_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL REFERENCES execution_tasks(task_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    source TEXT NOT NULL,
    kind TEXT NOT NULL,
    level TEXT NOT NULL,
    phase TEXT NOT NULL,
    item_id TEXT,
    message TEXT NOT NULL,
    data_json TEXT,
    content_bytes INTEGER NOT NULL,
    terminal INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(task_id, sequence)
  );
  CREATE TABLE IF NOT EXISTS loop_schedule_state (
    loop_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    definition_hash TEXT NOT NULL,
    next_run_at TEXT,
    last_scheduled_at TEXT,
    last_status TEXT CHECK(last_status IN ('started','skipped','missed')),
    last_run_id TEXT REFERENCES loop_runs(run_id) ON DELETE SET NULL,
    last_error TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(loop_id, step_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_loop_runs_one_active
    ON loop_runs(loop_id) WHERE status IN ('running','waiting_for_human');
  CREATE UNIQUE INDEX IF NOT EXISTS idx_loop_runs_schedule_occurrence
    ON loop_runs(loop_id, schedule_step_id, scheduled_for)
    WHERE source = 'schedule' AND schedule_step_id IS NOT NULL AND scheduled_for IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_loop_runs_root ON loop_runs(root_run_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_step_runs_run ON step_runs(run_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_tasks_queue ON execution_tasks(provider, status, created_at);
  CREATE INDEX IF NOT EXISTS idx_tasks_root ON execution_tasks(root_run_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_events_cursor ON execution_events(task_id, id);
  CREATE INDEX IF NOT EXISTS idx_schedule_due ON loop_schedule_state(next_run_at);
  CREATE TRIGGER IF NOT EXISTS execution_task_spec_is_immutable
  BEFORE UPDATE OF provider, kind, root_run_id, spec_json, spec_hash ON execution_tasks
  BEGIN SELECT RAISE(ABORT, 'execution task specification is immutable'); END;
`;
