export const executionSchema = `
  CREATE TABLE execution_tasks (
    execution_task_id TEXT PRIMARY KEY,
    environment_run_id TEXT NOT NULL REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    agent_run_id TEXT NOT NULL UNIQUE REFERENCES agent_runs(agent_run_id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('codex','copilot')),
    role TEXT NOT NULL CHECK (role IN ('validation','work','critic','refinement')),
    kind TEXT NOT NULL CHECK (kind = 'agent_execution'),
    status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_for_input','succeeded','failed','cancelled')),
    spec_version INTEGER NOT NULL CHECK (spec_version = 12),
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
