export const runtimeSchemaSupportTables = `
  CREATE TABLE execution_tasks (
    task_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK(provider IN ('codex','copilot')),
    kind TEXT NOT NULL CHECK(kind = 'node_execution'),
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    node_run_id TEXT NOT NULL REFERENCES node_runs(node_run_id),
    status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
    spec_json TEXT NOT NULL CHECK(json_valid(spec_json)),
    spec_hash TEXT NOT NULL CHECK(length(spec_hash) = 64),
    started_at TEXT,
    completed_at TEXT,
    cancel_requested_at TEXT,
    error_code TEXT,
    error_message TEXT,
    outcome_json TEXT CHECK(outcome_json IS NULL OR json_valid(outcome_json)),
    retained_content_bytes INTEGER NOT NULL DEFAULT 0 CHECK(retained_content_bytes >= 0),
    events_truncated INTEGER NOT NULL DEFAULT 0 CHECK(events_truncated IN (0,1)),
    last_sequence INTEGER NOT NULL DEFAULT -1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE execution_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL REFERENCES execution_tasks(task_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    source TEXT NOT NULL,
    kind TEXT NOT NULL,
    level TEXT NOT NULL,
    phase TEXT NOT NULL,
    item_id TEXT,
    message TEXT NOT NULL,
    data_json TEXT CHECK(data_json IS NULL OR json_valid(data_json)),
    content_bytes INTEGER NOT NULL CHECK(content_bytes >= 0),
    terminal INTEGER NOT NULL DEFAULT 0 CHECK(terminal IN (0,1)),
    created_at TEXT NOT NULL,
    UNIQUE(task_id, sequence)
  );
  CREATE TABLE repair_requests (
    repair_request_id TEXT PRIMARY KEY,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    requester_loop_run_id TEXT NOT NULL REFERENCES loop_invocations(loop_run_id),
    requester_work_loop_node_run_id TEXT NOT NULL REFERENCES work_loop_node_runs(work_loop_node_run_id),
    requester_validation_node_run_id TEXT NOT NULL REFERENCES node_runs(node_run_id),
    mode TEXT NOT NULL CHECK(mode IN ('local','orchestrator')),
    attempt INTEGER NOT NULL CHECK(attempt > 0),
    validation_summary TEXT NOT NULL CHECK(length(trim(validation_summary)) > 0),
    requested_capability TEXT,
    requested_outcome_json TEXT CHECK(requested_outcome_json IS NULL OR json_valid(requested_outcome_json)),
    reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
    evidence_json TEXT CHECK(evidence_json IS NULL OR json_valid(evidence_json)),
    state_revision_at_request INTEGER NOT NULL CHECK(state_revision_at_request >= 0),
    orchestrator_node_run_id TEXT UNIQUE REFERENCES node_runs(node_run_id) DEFERRABLE INITIALLY DEFERRED,
    routed_loop_edge_id TEXT,
    routed_target_loop_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending','routed','repaired','failed','cancelled')),
    return_loop_id TEXT NOT NULL,
    return_work_loop_node_id TEXT NOT NULL,
    return_validation_node_definition_id TEXT NOT NULL,
    nesting_depth INTEGER NOT NULL CHECK(nesting_depth >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY(root_run_id, state_revision_at_request) REFERENCES state_revisions(root_run_id, revision),
    CHECK((requested_capability IS NULL) <> (requested_outcome_json IS NULL)),
    CHECK((routed_loop_edge_id IS NULL) = (routed_target_loop_id IS NULL)),
    CHECK((status IN ('repaired','failed','cancelled')) = (completed_at IS NOT NULL)),
    CHECK((mode = 'local' AND orchestrator_node_run_id IS NULL AND routed_loop_edge_id IS NULL)
      OR mode = 'orchestrator')
  );
  CREATE TABLE orchestration_frames (
    frame_id TEXT PRIMARY KEY,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    repair_request_id TEXT NOT NULL UNIQUE REFERENCES repair_requests(repair_request_id),
    route_id TEXT NOT NULL UNIQUE REFERENCES orchestrator_routes(route_id) DEFERRABLE INITIALLY DEFERRED,
    caller_loop_run_id TEXT NOT NULL REFERENCES loop_invocations(loop_run_id),
    callee_loop_run_id TEXT NOT NULL REFERENCES loop_invocations(loop_run_id),
    parent_frame_id TEXT REFERENCES orchestration_frames(frame_id),
    return_loop_id TEXT NOT NULL,
    return_work_loop_node_id TEXT NOT NULL,
    return_validation_node_definition_id TEXT NOT NULL,
    state_revision_at_call INTEGER NOT NULL CHECK(state_revision_at_call >= 0),
    nesting_depth INTEGER NOT NULL CHECK(nesting_depth >= 0),
    status TEXT NOT NULL CHECK(status IN ('open','returned','failed','cancelled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY(root_run_id, state_revision_at_call) REFERENCES state_revisions(root_run_id, revision),
    CHECK((status IN ('returned','failed','cancelled')) = (completed_at IS NOT NULL))
  );
  CREATE TABLE orchestrator_routes (
    route_id TEXT PRIMARY KEY,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    repair_request_id TEXT NOT NULL UNIQUE REFERENCES repair_requests(repair_request_id),
    orchestrator_node_run_id TEXT NOT NULL REFERENCES node_runs(node_run_id),
    loop_edge_id TEXT NOT NULL,
    source_loop_id TEXT NOT NULL,
    target_loop_id TEXT NOT NULL,
    route_evidence_json TEXT CHECK(route_evidence_json IS NULL OR json_valid(route_evidence_json)),
    created_at TEXT NOT NULL
  );
  CREATE TABLE repair_results (
    repair_result_id TEXT PRIMARY KEY,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    repair_request_id TEXT NOT NULL UNIQUE REFERENCES repair_requests(repair_request_id),
    orchestration_frame_id TEXT NOT NULL UNIQUE REFERENCES orchestration_frames(frame_id),
    target_loop_run_id TEXT NOT NULL UNIQUE REFERENCES loop_invocations(loop_run_id),
    target_loop_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('repaired','blocked','failed','cancelled')),
    state_revision INTEGER NOT NULL CHECK(state_revision >= 0),
    outcome_json TEXT CHECK(outcome_json IS NULL OR json_valid(outcome_json)),
    summary TEXT NOT NULL CHECK(length(trim(summary)) > 0),
    created_at TEXT NOT NULL,
    FOREIGN KEY(root_run_id, state_revision) REFERENCES state_revisions(root_run_id, revision)
  );
  CREATE TABLE control_flow_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    root_run_id TEXT NOT NULL REFERENCES root_runs(root_run_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL CHECK(sequence BETWEEN 1 AND 256),
    kind TEXT NOT NULL CHECK(kind IN (
      'work_completed','work_needs_input','work_terminal','validation_ok','validation_fail_local',
      'validation_fail_orchestrator','validation_terminal','repair_call','repair_return','repair_terminal',
      'flow_transition','orchestrator_terminal','root_cancelled','root_terminal','execution_interrupted'
    )),
    state_revision INTEGER NOT NULL CHECK(state_revision >= 0),
    source_loop_run_id TEXT REFERENCES loop_invocations(loop_run_id),
    source_work_loop_node_run_id TEXT REFERENCES work_loop_node_runs(work_loop_node_run_id),
    source_node_run_id TEXT REFERENCES node_runs(node_run_id),
    target_loop_run_id TEXT REFERENCES loop_invocations(loop_run_id),
    target_work_loop_node_run_id TEXT REFERENCES work_loop_node_runs(work_loop_node_run_id),
    repair_request_id TEXT REFERENCES repair_requests(repair_request_id),
    orchestration_frame_id TEXT REFERENCES orchestration_frames(frame_id),
    created_at TEXT NOT NULL,
    FOREIGN KEY(root_run_id, state_revision) REFERENCES state_revisions(root_run_id, revision),
    UNIQUE(root_run_id, sequence)
  );
  CREATE TABLE loop_schedule_state (
    loop_id TEXT NOT NULL,
    work_loop_node_id TEXT NOT NULL,
    definition_hash TEXT NOT NULL,
    next_run_at TEXT,
    last_scheduled_at TEXT,
    last_status TEXT CHECK(last_status IN ('started','skipped','missed')),
    last_loop_run_id TEXT REFERENCES loop_invocations(loop_run_id) ON DELETE SET NULL,
    last_error TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(loop_id, work_loop_node_id)
  );
`;
