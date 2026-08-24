export const localDatabaseSchemaVersion = 15;

export const localDatabaseTableNames = [
  "acceptance_ledger_entries", "control_flow_events", "execution_events", "execution_tasks",
  "graph_node_invocations", "graph_state_revisions", "action_node_invocations", "metadata", "node_runs",
  "policy_decisions", "policy_observations", "root_runs", "tracker_links", "tracker_outbox"
] as const;

export const runtimeSchema = `
  CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE root_runs (
    root_run_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('graph','graph_node')),
    target_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source = 'manual'),
    status TEXT NOT NULL CHECK (status IN (
      'queued','running','waiting_for_input','finalizing','completed','blocked','failed','cancelled'
    )),
    input TEXT, outcome_json TEXT, error_code TEXT, error_message TEXT,
    worktree_path TEXT NOT NULL, branch TEXT NOT NULL, head_sha TEXT NOT NULL,
    config_hash TEXT NOT NULL, snapshot_hash TEXT NOT NULL, execution_snapshot_json TEXT NOT NULL,
    current_state_revision INTEGER NOT NULL DEFAULT 0 CHECK (current_state_revision >= 0),
    transition_count INTEGER NOT NULL DEFAULT 0 CHECK (transition_count BETWEEN 0 AND 256),
    active_graph_node_invocation_id TEXT, active_node_run_id TEXT,
    finalization_status TEXT CHECK (finalization_status IN ('finalizing','completed','failed')),
    finalization_terminal_status TEXT CHECK (finalization_terminal_status IN ('completed','blocked','failed','cancelled')),
    finalization_success INTEGER CHECK (finalization_success IN (0,1)),
    finalization_report_json TEXT, finalization_started_at TEXT, finalization_completed_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
  );

  CREATE TABLE graph_state_revisions (
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    revision INTEGER NOT NULL CHECK (revision >= 0),
    parent_revision INTEGER, state_json TEXT NOT NULL, state_hash TEXT NOT NULL,
    patch_json TEXT, patch_hash TEXT, source_node_run_id TEXT, outcome_json TEXT, created_at TEXT NOT NULL,
    PRIMARY KEY (root_run_id, revision)
  );

  CREATE TABLE graph_node_invocations (
    graph_node_invocation_id TEXT PRIMARY KEY,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    graph_node_id TEXT NOT NULL,
    policy_decision_id TEXT,
    source TEXT NOT NULL CHECK (source IN ('policy','root')),
    status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_for_input','completed','blocked','failed','cancelled')),
    input_json TEXT, snapshot_json TEXT NOT NULL,
    entry_state_revision INTEGER NOT NULL, completion_state_revision INTEGER,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
  );

  CREATE TABLE action_node_invocations (
    action_node_invocation_id TEXT PRIMARY KEY,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    graph_node_invocation_id TEXT NOT NULL REFERENCES graph_node_invocations(graph_node_invocation_id) ON DELETE CASCADE,
    graph_node_id TEXT NOT NULL, action_node_id TEXT NOT NULL,
    policy_decision_id TEXT NOT NULL REFERENCES policy_decisions(policy_decision_id),
    work_attempt INTEGER NOT NULL DEFAULT 0 CHECK (work_attempt >= 0),
    status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_for_input','completed','blocked','failed','cancelled')),
    state_revision_before INTEGER NOT NULL, state_revision_after INTEGER, active_node_run_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
  );

  CREATE TABLE node_runs (
    node_run_id TEXT PRIMARY KEY,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    graph_node_invocation_id TEXT NOT NULL REFERENCES graph_node_invocations(graph_node_invocation_id) ON DELETE CASCADE,
    action_node_invocation_id TEXT NOT NULL REFERENCES action_node_invocations(action_node_invocation_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('work','validation')),
    graph_node_id TEXT NOT NULL, action_node_id TEXT NOT NULL, node_definition_id TEXT NOT NULL,
    execution_task_id TEXT UNIQUE, input_json TEXT, context_json TEXT, outcome_json TEXT,
    status TEXT NOT NULL CHECK (status IN (
      'queued','running','waiting_for_input','completed','blocked','failed','cancelled','interrupted'
    )),
    attempt INTEGER NOT NULL CHECK (attempt >= 1), state_revision_before INTEGER NOT NULL, state_revision_after INTEGER,
    patch_json TEXT, patch_hash TEXT, error_code TEXT, error_message TEXT,
    created_at TEXT NOT NULL, started_at TEXT, updated_at TEXT NOT NULL, completed_at TEXT
  );

  CREATE TABLE acceptance_ledger_entries (
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    obligation_id TEXT NOT NULL, weight INTEGER NOT NULL CHECK (weight > 0),
    status TEXT NOT NULL CHECK (status IN ('pending','verified','invalidated')),
    evidence_refs_json TEXT NOT NULL, updated_by_validation_node_run_id TEXT,
    PRIMARY KEY (root_run_id, obligation_id)
  );

  CREATE TABLE policy_decisions (
    policy_decision_id TEXT PRIMARY KEY,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    epoch INTEGER NOT NULL CHECK (epoch >= 1),
    record_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (root_run_id, epoch)
  );

  CREATE TABLE policy_observations (
    policy_observation_id TEXT PRIMARY KEY,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    policy_decision_id TEXT NOT NULL REFERENCES policy_decisions(policy_decision_id),
    action_invocation_id TEXT NOT NULL UNIQUE,
    record_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE control_flow_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN (
      'policy_decided','policy_invalid','policy_observed','graph_node_dispatched','action_node_dispatched',
      'policy_terminal','acceptance_mismatch',
      'work_completed','validation_pass','validation_fail_retry','validation_fail_escalate',
      'root_needs_input','root_cancelled','root_terminal','execution_interrupted'
    )),
    state_revision INTEGER NOT NULL, graph_node_invocation_id TEXT, action_node_invocation_id TEXT,
    source_node_run_id TEXT, target_node_run_id TEXT, policy_decision_id TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (root_run_id, sequence)
  );

  CREATE TABLE execution_tasks (
    task_id TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK (provider IN ('codex','copilot')),
    kind TEXT NOT NULL CHECK (kind = 'node_execution'),
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    node_run_id TEXT NOT NULL REFERENCES node_runs(node_run_id),
    status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
    spec_json TEXT NOT NULL, spec_hash TEXT NOT NULL, started_at TEXT, completed_at TEXT, cancel_requested_at TEXT,
    error_code TEXT, error_message TEXT, outcome_json TEXT, retained_content_bytes INTEGER NOT NULL DEFAULT 0,
    events_truncated INTEGER NOT NULL DEFAULT 0 CHECK (events_truncated IN (0,1)), last_sequence INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE execution_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES execution_tasks(task_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL, source TEXT NOT NULL CHECK (source IN ('ballet','codex','copilot')), kind TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('info','warn','error')), phase TEXT NOT NULL CHECK (phase IN ('started','delta','completed')),
    item_id TEXT, metric_kind TEXT CHECK (metric_kind IN ('usage_v1')), message TEXT NOT NULL, data_json TEXT,
    content_bytes INTEGER NOT NULL, terminal INTEGER NOT NULL CHECK (terminal IN (0,1)),
    created_at TEXT NOT NULL, UNIQUE (task_id, sequence)
  );

  CREATE TABLE tracker_links (
    link_id TEXT PRIMARY KEY, root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    graph_node_invocation_id TEXT, store_kind TEXT NOT NULL CHECK (store_kind IN ('orchestration','work')),
    external_ref TEXT NOT NULL, ticket_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE (root_run_id, store_kind, external_ref)
  );
  CREATE TABLE tracker_outbox (
    operation_id TEXT PRIMARY KEY, root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    graph_node_invocation_id TEXT, store_kind TEXT NOT NULL CHECK (store_kind IN ('orchestration','work')),
    action TEXT NOT NULL CHECK (action IN ('upsert','start','note','close','reopen')), external_ref TEXT NOT NULL,
    payload_json TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending','applied')), ticket_id TEXT,
    error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, applied_at TEXT,
    UNIQUE (root_run_id, store_kind, action, external_ref)
  );

  CREATE INDEX root_runs_status_idx ON root_runs(status, updated_at);
  CREATE INDEX graph_node_invocations_root_idx ON graph_node_invocations(root_run_id, created_at);
  CREATE INDEX action_node_invocations_root_idx ON action_node_invocations(root_run_id, created_at);
  CREATE INDEX node_runs_root_idx ON node_runs(root_run_id, created_at);
  CREATE INDEX execution_tasks_status_idx ON execution_tasks(status, provider, created_at);
  CREATE INDEX policy_decisions_root_idx ON policy_decisions(root_run_id, epoch);
  CREATE INDEX policy_observations_root_idx ON policy_observations(root_run_id, created_at);
`;
