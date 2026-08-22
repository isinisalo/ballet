export const localDatabaseSchemaVersion = 10;

export const localDatabaseTableNames = [
  "control_flow_events", "execution_events", "execution_tasks", "graph_node_invocations",
  "graph_state_revisions", "job_node_invocations", "metadata", "node_runs",
  "repair_frames", "repair_requests", "repair_results", "root_runs",
  "routing_decisions", "routing_requests", "tracker_links", "tracker_outbox"
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
    graph_node_invocation_id TEXT PRIMARY KEY, root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    graph_node_id TEXT NOT NULL, parent_graph_node_invocation_id TEXT REFERENCES graph_node_invocations(graph_node_invocation_id),
    source TEXT NOT NULL CHECK (source IN ('orchestrator','repair','root')),
    status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_for_input','completed','blocked','failed','cancelled')),
    input_json TEXT, snapshot_json TEXT NOT NULL, entry_state_revision INTEGER NOT NULL, completion_state_revision INTEGER,
    nesting_depth INTEGER NOT NULL CHECK (nesting_depth BETWEEN 0 AND 3),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
  );

  CREATE TABLE job_node_invocations (
    job_node_invocation_id TEXT PRIMARY KEY, root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    graph_node_invocation_id TEXT NOT NULL REFERENCES graph_node_invocations(graph_node_invocation_id) ON DELETE CASCADE,
    graph_node_id TEXT NOT NULL, job_node_id TEXT NOT NULL, work_attempt INTEGER NOT NULL DEFAULT 0 CHECK (work_attempt >= 0),
    status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_for_input','completed','blocked','failed','cancelled')),
    state_revision_before INTEGER NOT NULL, state_revision_after INTEGER, active_node_run_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
  );

  CREATE TABLE node_runs (
    node_run_id TEXT PRIMARY KEY, root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    graph_node_invocation_id TEXT REFERENCES graph_node_invocations(graph_node_invocation_id) ON DELETE CASCADE,
    job_node_invocation_id TEXT REFERENCES job_node_invocations(job_node_invocation_id) ON DELETE CASCADE,
    scope TEXT CHECK (scope IN ('graph','graph_node')),
    role TEXT NOT NULL CHECK (role IN ('work','validation','orchestrator','repair')),
    graph_node_id TEXT, job_node_id TEXT, node_definition_id TEXT NOT NULL, execution_task_id TEXT UNIQUE,
    input_json TEXT, context_json TEXT, outcome_json TEXT,
    status TEXT NOT NULL CHECK (status IN (
      'queued','running','waiting_for_input','completed','blocked','failed','cancelled','interrupted'
    )),
    attempt INTEGER NOT NULL CHECK (attempt >= 1), state_revision_before INTEGER NOT NULL, state_revision_after INTEGER,
    patch_json TEXT, patch_hash TEXT, error_code TEXT, error_message TEXT,
    created_at TEXT NOT NULL, started_at TEXT, updated_at TEXT NOT NULL, completed_at TEXT,
    CHECK ((role IN ('work','validation') AND job_node_invocation_id IS NOT NULL AND graph_node_invocation_id IS NOT NULL)
      OR (role IN ('orchestrator','repair') AND scope IS NOT NULL))
  );

  CREATE TABLE routing_requests (
    routing_request_id TEXT PRIMARY KEY, root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('graph','graph_node')), kind TEXT NOT NULL CHECK (kind IN ('start','continuation','repair')),
    graph_node_id TEXT, source_child_id TEXT, source_node_run_id TEXT, result TEXT CHECK (result IN ('PASS','FAIL')),
    requested_capability TEXT, state_revision INTEGER NOT NULL, evidence_json TEXT NOT NULL, candidate_keys_json TEXT NOT NULL,
    attempt INTEGER NOT NULL CHECK (attempt BETWEEN 1 AND 3),
    status TEXT NOT NULL CHECK (status IN ('pending','waiting_for_input','decided','dispatched','failed','cancelled')),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
  );

  CREATE TABLE routing_decisions (
    routing_decision_id TEXT PRIMARY KEY, routing_request_id TEXT NOT NULL REFERENCES routing_requests(routing_request_id) ON DELETE CASCADE,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE, orchestrator_node_run_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('dispatch','complete','delegate_repair','needs_input')),
    selected_target TEXT, result TEXT CHECK (result IN ('PASS','FAIL')), reason TEXT NOT NULL,
    valid INTEGER NOT NULL CHECK (valid IN (0,1)), created_at TEXT NOT NULL
  );

  CREATE TABLE repair_requests (
    repair_request_id TEXT PRIMARY KEY, root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('graph','graph_node')), graph_node_id TEXT, requester_node_run_id TEXT NOT NULL,
    requester_job_node_invocation_id TEXT, return_validation_node_id TEXT NOT NULL, attempt INTEGER NOT NULL CHECK (attempt BETWEEN 1 AND 3),
    depth INTEGER NOT NULL CHECK (depth BETWEEN 1 AND 3), reason TEXT NOT NULL, requested_capability TEXT,
    evidence_json TEXT NOT NULL, state_revision INTEGER NOT NULL, candidate_keys_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','running','repaired','escalated','needs_input','failed','cancelled')),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
  );

  CREATE TABLE repair_frames (
    repair_frame_id TEXT PRIMARY KEY, root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    repair_request_id TEXT NOT NULL REFERENCES repair_requests(repair_request_id) ON DELETE CASCADE,
    parent_frame_id TEXT REFERENCES repair_frames(repair_frame_id), return_graph_node_invocation_id TEXT NOT NULL,
    return_job_node_invocation_id TEXT NOT NULL, return_validation_node_id TEXT NOT NULL,
    state_revision_at_call INTEGER NOT NULL, depth INTEGER NOT NULL CHECK (depth BETWEEN 1 AND 3),
    status TEXT NOT NULL CHECK (status IN ('open','returned','escalated','failed','cancelled')),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
  );

  CREATE TABLE repair_results (
    repair_result_id TEXT PRIMARY KEY, root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    repair_request_id TEXT NOT NULL REFERENCES repair_requests(repair_request_id),
    repair_frame_id TEXT NOT NULL REFERENCES repair_frames(repair_frame_id), state_revision INTEGER NOT NULL,
    outcome_json TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL
  );

  CREATE TABLE control_flow_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL, kind TEXT NOT NULL CHECK (kind IN (
      'orchestrator_requested','orchestrator_decided','orchestrator_invalid','graph_node_dispatched','job_node_dispatched',
      'work_completed','validation_pass','validation_fail_retry','validation_fail_repair','repair_dispatched',
      'repair_return','repair_escalated','root_needs_input','root_cancelled','root_terminal','execution_interrupted'
    )), state_revision INTEGER NOT NULL, graph_node_invocation_id TEXT, job_node_invocation_id TEXT,
    source_node_run_id TEXT, target_node_run_id TEXT, routing_request_id TEXT, repair_request_id TEXT, repair_frame_id TEXT,
    created_at TEXT NOT NULL, UNIQUE (root_run_id, sequence)
  );

  CREATE TABLE execution_tasks (
    task_id TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK (provider IN ('codex','copilot')), kind TEXT NOT NULL CHECK (kind = 'node_execution'),
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE, node_run_id TEXT NOT NULL REFERENCES node_runs(node_run_id),
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
    item_id TEXT, message TEXT NOT NULL, data_json TEXT, content_bytes INTEGER NOT NULL, terminal INTEGER NOT NULL CHECK (terminal IN (0,1)),
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
  CREATE INDEX job_node_invocations_root_idx ON job_node_invocations(root_run_id, created_at);
  CREATE INDEX node_runs_root_idx ON node_runs(root_run_id, created_at);
  CREATE INDEX execution_tasks_status_idx ON execution_tasks(status, provider, created_at);
  CREATE INDEX routing_requests_root_idx ON routing_requests(root_run_id, created_at);
  CREATE INDEX repair_frames_root_idx ON repair_frames(root_run_id, created_at);
`;
