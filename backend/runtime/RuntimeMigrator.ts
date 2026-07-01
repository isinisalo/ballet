import type Database from "better-sqlite3";

export class RuntimeMigrator {
  migrate(db: Database.Database): void {
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
        status TEXT NOT NULL DEFAULT 'received',
        matched_policy_id TEXT,
        assigned_agent_id TEXT,
        routing_json TEXT,
        handling_result TEXT,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS consumer_offsets (
        consumer_name TEXT PRIMARY KEY,
        last_seq INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS agent_runs (
        run_id TEXT PRIMARY KEY,
        trigger_event_id TEXT NOT NULL,
        trigger_event_seq INTEGER,
        policy_id TEXT NOT NULL,
        policy_version INTEGER NOT NULL,
        agent_role TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt INTEGER NOT NULL DEFAULT 0,
        lease_owner TEXT,
        lease_until TEXT,
        thread_id TEXT,
        turn_id TEXT,
        outcome_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        UNIQUE(trigger_event_id, policy_id, policy_version, agent_role),
        FOREIGN KEY(trigger_event_seq) REFERENCES events(seq) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS agent_run_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        data_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(run_id) REFERENCES agent_runs(run_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS thread_bindings (
        work_item_id TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(work_item_id, agent_role)
      );

      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status, lease_until);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_trigger ON agent_runs(trigger_event_id);
    `);

    const eventColumns = new Set((db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>).map((column) => column.name));
    if (!eventColumns.has("dedupe_key")) db.exec("ALTER TABLE events ADD COLUMN dedupe_key TEXT");
    if (!eventColumns.has("correlation_depth")) db.exec("ALTER TABLE events ADD COLUMN correlation_depth INTEGER NOT NULL DEFAULT 0");
    if (!eventColumns.has("routing_json")) db.exec("ALTER TABLE events ADD COLUMN routing_json TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe_key ON events(dedupe_key) WHERE dedupe_key IS NOT NULL");
  }
}
