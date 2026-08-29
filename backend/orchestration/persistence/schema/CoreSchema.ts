export const coreSchema = `
  CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE environment_runs (
    environment_run_id TEXT PRIMARY KEY,
    environment_definition_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual','continuation')),
    previous_run_id TEXT REFERENCES environment_runs(environment_run_id),
    input_text TEXT CHECK (input_text IS NULL OR length(input_text) <= 131072),
    status TEXT NOT NULL CHECK (status IN ('pending','running','blocked','completed','cancelled','interrupted')),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    base_commit TEXT NOT NULL,
    result_commit TEXT,
    worktree_path TEXT NOT NULL,
    branch TEXT NOT NULL,
    execution_snapshot_json TEXT NOT NULL,
    execution_snapshot_hash TEXT NOT NULL,
    active_state_execution_id TEXT REFERENCES state_executions(state_execution_id) ON DELETE SET NULL,
    active_action_execution_id TEXT REFERENCES action_executions(action_execution_id) ON DELETE SET NULL,
    active_agent_run_id TEXT REFERENCES agent_runs(agent_run_id) ON DELETE SET NULL,
    transition_count INTEGER NOT NULL DEFAULT 0 CHECK (transition_count >= 0),
    transition_limit INTEGER NOT NULL CHECK (transition_limit BETWEEN 1 AND 100000),
    finalization_status TEXT CHECK (finalization_status IN ('running','completed','failed')),
    finalization_json TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    CHECK ((source = 'manual' AND previous_run_id IS NULL) OR (source = 'continuation' AND previous_run_id IS NOT NULL)),
    CHECK (transition_count <= transition_limit)
  );

  CREATE TABLE state_executions (
    state_execution_id TEXT PRIMARY KEY,
    environment_run_id TEXT NOT NULL REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    state_definition_id TEXT NOT NULL,
    state_order INTEGER NOT NULL CHECK (state_order > 0),
    definition_snapshot_json TEXT NOT NULL,
    definition_snapshot_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','running','blocked','done','cancelled','interrupted')),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE (environment_run_id, state_definition_id),
    UNIQUE (environment_run_id, state_order)
  );

  CREATE TABLE action_executions (
    action_execution_id TEXT PRIMARY KEY,
    state_execution_id TEXT NOT NULL REFERENCES state_executions(state_execution_id) ON DELETE CASCADE,
    environment_run_id TEXT NOT NULL REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    action_definition_id TEXT NOT NULL,
    action_priority INTEGER NOT NULL CHECK (action_priority > 0),
    definition_snapshot_json TEXT NOT NULL,
    definition_snapshot_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
      'pending','prechecking','working','postchecking','blocked','done','cancelled','interrupted'
    )),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    work_attempt INTEGER NOT NULL DEFAULT 0 CHECK (work_attempt >= 0),
    max_retries INTEGER NOT NULL CHECK (max_retries BETWEEN 0 AND 20),
    active_agent_run_id TEXT REFERENCES agent_runs(agent_run_id) ON DELETE SET NULL,
    originating_run_id TEXT REFERENCES environment_runs(environment_run_id) ON DELETE SET NULL,
    prior_action_execution_id TEXT REFERENCES action_executions(action_execution_id) ON DELETE SET NULL,
    imported_done_evidence_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE (state_execution_id, action_definition_id),
    UNIQUE (state_execution_id, action_priority),
    CHECK (work_attempt <= max_retries + 1),
    CHECK ((status = 'done' AND completed_at IS NOT NULL) OR status <> 'done')
  );

  CREATE TABLE agent_runs (
    agent_run_id TEXT PRIMARY KEY,
    environment_run_id TEXT NOT NULL REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    action_execution_id TEXT REFERENCES action_executions(action_execution_id) ON DELETE CASCADE,
    parent_agent_run_id TEXT REFERENCES agent_runs(agent_run_id) ON DELETE RESTRICT,
    critic_run_id TEXT REFERENCES critic_runs(critic_run_id) ON DELETE CASCADE,
    refinement_run_id TEXT REFERENCES refinement_runs(refinement_run_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('validation','work','critic','refinement')),
    phase TEXT NOT NULL CHECK (phase IN ('precheck','work','postwork','proposal')),
    status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_for_input','completed','failed','cancelled','interrupted')),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    attempt INTEGER NOT NULL CHECK (attempt >= 1),
    task_envelope_version INTEGER NOT NULL CHECK (task_envelope_version = 11),
    task_envelope_json TEXT NOT NULL,
    task_envelope_hash TEXT NOT NULL,
    execution_task_id TEXT UNIQUE,
    provider_outcome_key TEXT UNIQUE,
    input_json TEXT,
    context_json TEXT,
    outcome_json TEXT,
    evidence_json TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    CHECK (
      (role = 'validation' AND phase IN ('precheck','postwork') AND action_execution_id IS NOT NULL AND critic_run_id IS NULL AND refinement_run_id IS NULL)
      OR (role = 'work' AND phase = 'work' AND action_execution_id IS NOT NULL AND critic_run_id IS NULL AND refinement_run_id IS NULL)
      OR (role = 'critic' AND phase = 'proposal' AND action_execution_id IS NULL AND critic_run_id IS NOT NULL AND refinement_run_id IS NULL)
      OR (role = 'refinement' AND phase = 'proposal' AND action_execution_id IS NULL AND critic_run_id IS NULL AND refinement_run_id IS NOT NULL)
    )
  );

  CREATE TABLE control_flow_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_run_id TEXT NOT NULL REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL CHECK (sequence >= 1),
    kind TEXT NOT NULL CHECK (kind IN (
      'environment_started','state_activated','action_selected','action_imported','validation_precheck_dispatched',
      'validation_precheck_done','work_dispatched','work_completed','validation_postwork_dispatched',
      'work_waiting_for_input','work_resumed',
      'validation_done','validation_retry','action_blocked','feedback_created','state_completed',
      'environment_completed','environment_blocked','environment_cancelled','execution_interrupted',
      'continuation_created'
    )),
    state_execution_id TEXT REFERENCES state_executions(state_execution_id) ON DELETE SET NULL,
    action_execution_id TEXT REFERENCES action_executions(action_execution_id) ON DELETE SET NULL,
    source_agent_run_id TEXT REFERENCES agent_runs(agent_run_id) ON DELETE SET NULL,
    target_agent_run_id TEXT REFERENCES agent_runs(agent_run_id) ON DELETE SET NULL,
    data_json TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (environment_run_id, sequence)
  );

  CREATE UNIQUE INDEX one_active_state_per_environment
    ON state_executions(environment_run_id)
    WHERE status = 'running';
  CREATE UNIQUE INDEX one_active_action_per_environment
    ON action_executions(environment_run_id)
    WHERE status IN ('prechecking','working','postchecking');
  CREATE UNIQUE INDEX one_active_agent_per_action
    ON agent_runs(action_execution_id)
    WHERE action_execution_id IS NOT NULL AND status IN ('queued','running','waiting_for_input');
`;
