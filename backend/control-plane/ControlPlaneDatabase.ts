import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const SCHEMA_VERSION = "4";

export const resolveControlPlaneDbPath = (): string => {
  const configured = process.env.BALLET_CONTROL_PLANE_DB_PATH?.trim();
  return configured ? path.resolve(configured) : path.join(os.homedir(), ".ballet", "control-plane.sqlite");
};

export class ControlPlaneDatabase {
  private db?: Database.Database;

  constructor(readonly path = resolveControlPlaneDbPath()) {}

  connection(): Database.Database {
    if (this.db) return this.db;
    mkdirSync(path.dirname(this.path), { recursive: true });
    const db = new Database(this.path);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = FULL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    this.createSchema(db);
    this.db = db;
    return db;
  }

  close(): void {
    this.db?.close();
    this.db = undefined;
  }

  private createSchema(db: Database.Database): void {
    db.exec("CREATE TABLE IF NOT EXISTS control_plane_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    const existingVersion = db.prepare("SELECT value FROM control_plane_metadata WHERE key = 'schema_version'").get() as { value: string } | undefined;
    if (existingVersion && existingVersion.value !== SCHEMA_VERSION) this.resetSchema(db);
    db.exec(`
      CREATE TABLE IF NOT EXISTS control_plane_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS admins (
        admin_id TEXT PRIMARY KEY, singleton INTEGER NOT NULL DEFAULT 1 UNIQUE CHECK(singleton = 1),
        password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS admin_sessions (
        session_id TEXT PRIMARY KEY, admin_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
        csrf_hash TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY(admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS runtime_devices (
        device_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, daemon_id TEXT NOT NULL UNIQUE,
        hostname TEXT NOT NULL, display_name TEXT NOT NULL, platform TEXT NOT NULL, architecture TEXT NOT NULL,
        daemon_version TEXT NOT NULL, uptime_seconds INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL,
        paired_at TEXT NOT NULL, connected_at TEXT, last_seen_at TEXT NOT NULL, offline_at TEXT,
        refresh_requested_at TEXT, refresh_acknowledged_at TEXT, restart_requested_at TEXT,
        restart_acknowledged_at TEXT, recent_error TEXT, revoked_at TEXT, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daemon_tokens (
        token_id TEXT PRIMARY KEY, device_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT,
        FOREIGN KEY(device_id) REFERENCES runtime_devices(device_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS pairing_sessions (
        pairing_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, device_code TEXT NOT NULL UNIQUE,
        user_code TEXT NOT NULL UNIQUE, display_name TEXT, status TEXT NOT NULL, expires_at TEXT NOT NULL,
        approved_at TEXT, claimed_at TEXT, device_id TEXT, created_at TEXT NOT NULL, revoked_at TEXT,
        FOREIGN KEY(device_id) REFERENCES runtime_devices(device_id)
      );

      CREATE TABLE IF NOT EXISTS runtime_backends (
        backend_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, device_id TEXT NOT NULL, provider TEXT NOT NULL,
        cli_version TEXT, executable_path TEXT, auth_status TEXT NOT NULL, health TEXT NOT NULL,
        health_message TEXT, capabilities_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(device_id) REFERENCES runtime_devices(device_id) ON DELETE CASCADE,
        UNIQUE(device_id, provider)
      );
      CREATE TABLE IF NOT EXISTS projects (
        project_id TEXT PRIMARY KEY, repository_url TEXT NOT NULL, default_checkout_path TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS project_checkouts (
        checkout_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, device_id TEXT NOT NULL,
        repository_url TEXT NOT NULL, checkout_path TEXT NOT NULL, head_sha TEXT, config_hash TEXT,
        dirty INTEGER NOT NULL DEFAULT 0, last_inspected_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY(device_id) REFERENCES runtime_devices(device_id) ON DELETE CASCADE,
        UNIQUE(project_id, device_id)
      );
      CREATE TABLE IF NOT EXISTS agent_execution_bindings (
        binding_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, agent_id TEXT NOT NULL,
        runtime_backend_id TEXT NOT NULL, device_id TEXT NOT NULL, provider TEXT NOT NULL,
        model TEXT NOT NULL, reasoning TEXT NOT NULL, policy_json TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(runtime_backend_id) REFERENCES runtime_backends(backend_id),
        FOREIGN KEY(device_id) REFERENCES runtime_devices(device_id), UNIQUE(project_id, agent_id)
      );

      CREATE TABLE IF NOT EXISTS agent_runs (
        run_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, agent_id TEXT NOT NULL, root_run_id TEXT NOT NULL,
        task_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL, input TEXT, runtime_snapshot_json TEXT NOT NULL,
        project_snapshot_json TEXT NOT NULL, outcome_json TEXT, branch TEXT, worktree_path TEXT,
        error_code TEXT, error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(project_id)
      );
      CREATE TABLE IF NOT EXISTS execution_tasks (
        task_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, runtime_backend_id TEXT NOT NULL, device_id TEXT NOT NULL,
        kind TEXT NOT NULL, root_run_id TEXT NOT NULL, status TEXT NOT NULL, spec_json TEXT NOT NULL,
        spec_hash TEXT NOT NULL, task_token_hash TEXT, fencing INTEGER NOT NULL DEFAULT 0, lease_until TEXT,
        claimed_at TEXT, started_at TEXT, completed_at TEXT, cancel_requested_at TEXT,
        error_code TEXT, error_message TEXT, outcome_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(runtime_backend_id) REFERENCES runtime_backends(backend_id),
        FOREIGN KEY(device_id) REFERENCES runtime_devices(device_id)
      );
      CREATE TABLE IF NOT EXISTS execution_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, task_id TEXT NOT NULL, sequence INTEGER NOT NULL,
        source TEXT NOT NULL, kind TEXT NOT NULL, level TEXT NOT NULL, phase TEXT NOT NULL, item_id TEXT,
        message TEXT NOT NULL, data_json TEXT, content_bytes INTEGER NOT NULL, terminal INTEGER NOT NULL DEFAULT 0,
        event_hash TEXT NOT NULL, created_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES execution_tasks(task_id) ON DELETE CASCADE, UNIQUE(task_id, sequence)
      );
      CREATE TABLE IF NOT EXISTS root_run_finalizations (
        root_run_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, device_id TEXT NOT NULL, task_id TEXT,
        fencing INTEGER, task_token_hash TEXT, expected_success INTEGER NOT NULL,
        snapshot_hash TEXT NOT NULL, status TEXT NOT NULL, report_json TEXT, authorized_at TEXT NOT NULL, finalized_at TEXT,
        FOREIGN KEY(task_id) REFERENCES execution_tasks(task_id) ON DELETE CASCADE,
        FOREIGN KEY(device_id) REFERENCES runtime_devices(device_id)
      );
      CREATE TABLE IF NOT EXISTS device_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, device_id TEXT NOT NULL, level TEXT NOT NULL,
        message TEXT NOT NULL, data_json TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY(device_id) REFERENCES runtime_devices(device_id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_one_active ON projects(is_active) WHERE is_active = 1;
      CREATE INDEX IF NOT EXISTS idx_checkouts_device ON project_checkouts(device_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON admin_sessions(token_hash, expires_at);
      CREATE INDEX IF NOT EXISTS idx_pairing_expiry ON pairing_sessions(status, expires_at);
      CREATE INDEX IF NOT EXISTS idx_backends_device ON runtime_backends(device_id, health);
      CREATE INDEX IF NOT EXISTS idx_tasks_claim ON execution_tasks(runtime_backend_id, status, lease_until, created_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_one_active_per_backend
        ON execution_tasks(runtime_backend_id) WHERE status IN ('claimed','preparing','running');
      CREATE INDEX IF NOT EXISTS idx_runs_agent_latest ON agent_runs(project_id, agent_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_events_cursor ON execution_events(task_id, id);
      CREATE INDEX IF NOT EXISTS idx_root_finalizations_device ON root_run_finalizations(device_id, status);
      CREATE INDEX IF NOT EXISTS idx_device_logs_latest ON device_logs(device_id, id DESC);
      CREATE TRIGGER IF NOT EXISTS execution_task_spec_is_immutable
      BEFORE UPDATE OF spec_json, spec_hash, project_id, runtime_backend_id, device_id, kind, root_run_id ON execution_tasks
      BEGIN SELECT RAISE(ABORT, 'execution task specification is immutable'); END;
    `);
    this.createExecutionEventRetentionSchema(db);
    const version = db.prepare("SELECT value FROM control_plane_metadata WHERE key = 'schema_version'").get() as { value: string } | undefined;
    if (version && version.value !== SCHEMA_VERSION) throw new Error(`Unsupported control-plane schema version ${version.value}. Expected ${SCHEMA_VERSION}.`);
    if (!version) db.prepare("INSERT INTO control_plane_metadata (key, value) VALUES ('schema_version', ?)").run(SCHEMA_VERSION);
  }

  private createExecutionEventRetentionSchema(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS execution_event_receipts (
        task_id TEXT NOT NULL, sequence INTEGER NOT NULL, event_hash TEXT NOT NULL,
        persisted INTEGER NOT NULL CHECK(persisted IN (0, 1)), terminal INTEGER NOT NULL CHECK(terminal IN (0, 1)),
        created_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES execution_tasks(task_id) ON DELETE CASCADE,
        PRIMARY KEY(task_id, sequence)
      );
      CREATE TABLE IF NOT EXISTS execution_event_state (
        task_id TEXT PRIMARY KEY, retained_content_bytes INTEGER NOT NULL DEFAULT 0 CHECK(retained_content_bytes >= 0),
        truncated INTEGER NOT NULL DEFAULT 0 CHECK(truncated IN (0, 1)),
        FOREIGN KEY(task_id) REFERENCES execution_tasks(task_id) ON DELETE CASCADE
      );
    `);
  }

  private resetSchema(db: Database.Database): void {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DROP TRIGGER IF EXISTS execution_task_spec_is_immutable;
      DROP TABLE IF EXISTS execution_event_state;
      DROP TABLE IF EXISTS execution_event_receipts;
      DROP TABLE IF EXISTS root_run_finalizations;
      DROP TABLE IF EXISTS execution_events;
      DROP TABLE IF EXISTS device_logs;
      DROP TABLE IF EXISTS execution_tasks;
      DROP TABLE IF EXISTS agent_runs;
      DROP TABLE IF EXISTS agent_execution_bindings;
      DROP TABLE IF EXISTS project_checkouts;
      DROP TABLE IF EXISTS projects;
      DROP TABLE IF EXISTS runtime_backends;
      DROP TABLE IF EXISTS pairing_sessions;
      DROP TABLE IF EXISTS daemon_tokens;
      DROP TABLE IF EXISTS runtime_devices;
      DROP TABLE IF EXISTS admin_sessions;
      DROP TABLE IF EXISTS admins;
      DROP TABLE IF EXISTS control_plane_metadata;
      PRAGMA foreign_keys = ON;
    `);
  }
}
