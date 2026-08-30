export const executionSchema = `
  CREATE TABLE execution_tasks (
    execution_task_id TEXT PRIMARY KEY,
    environment_run_id TEXT NOT NULL REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    agent_run_id TEXT NOT NULL UNIQUE REFERENCES agent_runs(agent_run_id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('codex','copilot')),
    role TEXT NOT NULL CHECK (role IN ('validation','work','critic','refinement')),
    kind TEXT NOT NULL CHECK (kind = 'agent_execution'),
    status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_for_input','succeeded','failed','cancelled')),
    spec_version INTEGER NOT NULL CHECK (spec_version = 14),
    spec_json TEXT NOT NULL,
    spec_hash TEXT NOT NULL,
    provider_outcome_key TEXT UNIQUE,
    outcome_json TEXT,
    error_code TEXT,
    error_message TEXT,
    last_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    cancel_requested_at TEXT
    , claim_fencing INTEGER NOT NULL DEFAULT 0 CHECK (claim_fencing >= 0)
    , lease_until TEXT
    , daemon_output_key TEXT UNIQUE
    , daemon_output TEXT
    , daemon_error_message TEXT
  );

  CREATE TABLE agent_execution_bindings (
    agent_id TEXT PRIMARY KEY,
    version INTEGER NOT NULL CHECK (version = 2),
    provider TEXT NOT NULL CHECK (provider IN ('codex','copilot')),
    model TEXT NOT NULL,
    reasoning_effort TEXT NOT NULL,
    network_access INTEGER NOT NULL CHECK (network_access IN (0,1)),
    read_only_roots_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE local_daemon_state (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    status TEXT NOT NULL CHECK (status IN ('starting','online','offline','error')),
    pid INTEGER NOT NULL CHECK (pid > 0),
    daemon_version TEXT NOT NULL,
    uptime_seconds INTEGER NOT NULL CHECK (uptime_seconds >= 0),
    active_task_count INTEGER NOT NULL CHECK (active_task_count >= 0),
    last_seen_at TEXT NOT NULL,
    recent_error TEXT,
    refresh_requested_at TEXT,
    refresh_acknowledged_at TEXT,
    restart_requested_at TEXT,
    restart_acknowledged_at TEXT
  );

  CREATE TABLE local_provider_capabilities (
    provider TEXT PRIMARY KEY CHECK (provider IN ('codex','copilot')),
    cli_version TEXT,
    auth_status TEXT NOT NULL CHECK (auth_status IN ('ready','required','expired','unknown')),
    health TEXT NOT NULL CHECK (health IN ('ready','probing','auth_required','unsupported_version','policy_unsupported','error','offline')),
    health_message TEXT,
    capabilities_json TEXT NOT NULL,
    busy INTEGER NOT NULL CHECK (busy IN (0,1)),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE local_daemon_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL CHECK (level IN ('info','warn','error')),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE execution_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_task_id TEXT NOT NULL REFERENCES execution_tasks(execution_task_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL CHECK (sequence >= 1),
    source TEXT NOT NULL CHECK (source IN ('ballet','codex','copilot')),
    kind TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('info','warn','error')),
    phase TEXT NOT NULL CHECK (phase IN ('started','delta','completed')),
    message TEXT NOT NULL,
    data_json TEXT,
    terminal INTEGER NOT NULL CHECK (terminal IN (0,1)),
    created_at TEXT NOT NULL,
    UNIQUE (execution_task_id, sequence)
  );

  CREATE INDEX execution_tasks_queue_idx ON execution_tasks(status, provider, created_at);
  CREATE INDEX execution_events_task_idx ON execution_events(execution_task_id, sequence);
`;
