export const vNextReviewSchema = `
  CREATE TABLE product_snapshots (
    product_snapshot_id TEXT PRIMARY KEY,
    environment_run_id TEXT NOT NULL UNIQUE REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    branch TEXT NOT NULL,
    worktree_path TEXT NOT NULL,
    base_commit TEXT NOT NULL,
    result_commit TEXT NOT NULL,
    changed_files_json TEXT NOT NULL,
    artifact_refs_json TEXT NOT NULL,
    resource_hashes_json TEXT NOT NULL,
    definition_hashes_json TEXT NOT NULL,
    validation_summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TRIGGER product_snapshot_requires_completed_environment
  BEFORE INSERT ON product_snapshots
  WHEN (SELECT status FROM environment_runs WHERE environment_run_id = NEW.environment_run_id) <> 'completed'
  BEGIN
    SELECT RAISE(ABORT, 'Product Snapshot requires completed Environment');
  END;

  CREATE TABLE feedback_entries (
    feedback_entry_id TEXT PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('validation_blocked','retry_exhaustion','approved_critic_proposal')),
    category TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('environment','state','action','resource')),
    target_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open','resolved')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    corrective_actions_json TEXT NOT NULL,
    environment_run_id TEXT NOT NULL REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    state_execution_id TEXT REFERENCES state_executions(state_execution_id) ON DELETE SET NULL,
    action_execution_id TEXT REFERENCES action_executions(action_execution_id) ON DELETE SET NULL,
    agent_run_id TEXT REFERENCES agent_runs(agent_run_id) ON DELETE SET NULL,
    critic_proposal_id TEXT REFERENCES critic_proposals(critic_proposal_id) ON DELETE SET NULL,
    approval_json TEXT,
    provenance_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT
  );

  CREATE TABLE critic_schedules (
    critic_schedule_id TEXT PRIMARY KEY,
    config_hash TEXT NOT NULL,
    next_due_at TEXT NOT NULL,
    last_due_at TEXT,
    last_run_id TEXT REFERENCES critic_runs(critic_run_id) ON DELETE SET NULL,
    enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE critic_runs (
    critic_run_id TEXT PRIMARY KEY,
    critic_schedule_id TEXT NOT NULL REFERENCES critic_schedules(critic_schedule_id) ON DELETE CASCADE,
    due_at TEXT NOT NULL,
    due_key TEXT NOT NULL,
    product_snapshot_id TEXT NOT NULL REFERENCES product_snapshots(product_snapshot_id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled','skipped')),
    agent_run_id TEXT REFERENCES agent_runs(agent_run_id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE (critic_schedule_id, due_at),
    UNIQUE (critic_schedule_id, due_key)
  );

  CREATE TABLE critic_proposals (
    critic_proposal_id TEXT PRIMARY KEY,
    critic_run_id TEXT NOT NULL UNIQUE REFERENCES critic_runs(critic_run_id) ON DELETE CASCADE,
    content_json TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('environment','state','action','resource')),
    target_id TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending_approval','approved','rejected')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE critic_proposal_decisions (
    critic_proposal_id TEXT PRIMARY KEY REFERENCES critic_proposals(critic_proposal_id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
    expected_content_hash TEXT NOT NULL,
    decided_by TEXT NOT NULL,
    decided_at TEXT NOT NULL,
    rationale TEXT
  );

  CREATE TABLE refinement_runs (
    refinement_run_id TEXT PRIMARY KEY,
    source_environment_run_id TEXT NOT NULL REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled')),
    agent_run_id TEXT REFERENCES agent_runs(agent_run_id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE refinement_run_feedback (
    refinement_run_id TEXT NOT NULL REFERENCES refinement_runs(refinement_run_id) ON DELETE CASCADE,
    feedback_entry_id TEXT NOT NULL REFERENCES feedback_entries(feedback_entry_id) ON DELETE RESTRICT,
    PRIMARY KEY (refinement_run_id, feedback_entry_id)
  );

  CREATE TABLE refinement_proposals (
    refinement_proposal_id TEXT PRIMARY KEY,
    refinement_run_id TEXT NOT NULL UNIQUE REFERENCES refinement_runs(refinement_run_id) ON DELETE CASCADE,
    target_action_id TEXT NOT NULL,
    impact_scope_json TEXT NOT NULL,
    change_list_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending_approval','approved','rejected','applying','applied','stale','failed')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE refinement_proposal_files (
    refinement_proposal_id TEXT NOT NULL REFERENCES refinement_proposals(refinement_proposal_id) ON DELETE CASCADE,
    relative_path TEXT NOT NULL,
    expected_preimage_hash TEXT NOT NULL,
    proposed_content_hash TEXT NOT NULL,
    proposed_content TEXT NOT NULL,
    resource_id TEXT,
    PRIMARY KEY (refinement_proposal_id, relative_path)
  );

  CREATE TABLE refinement_proposal_decisions (
    refinement_proposal_id TEXT PRIMARY KEY REFERENCES refinement_proposals(refinement_proposal_id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
    expected_change_list_hash TEXT NOT NULL,
    decided_by TEXT NOT NULL,
    decided_at TEXT NOT NULL,
    rationale TEXT
  );

  CREATE TABLE refinement_applies (
    refinement_apply_id TEXT PRIMARY KEY,
    refinement_proposal_id TEXT NOT NULL UNIQUE REFERENCES refinement_proposals(refinement_proposal_id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('applied','failed')),
    worktree_path TEXT NOT NULL,
    branch TEXT NOT NULL,
    commit_sha TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    CHECK ((status = 'applied' AND commit_sha IS NOT NULL AND error_message IS NULL)
      OR (status = 'failed' AND commit_sha IS NULL AND error_message IS NOT NULL))
  );

  CREATE TABLE continuation_links (
    continuation_link_id TEXT PRIMARY KEY,
    source_run_id TEXT NOT NULL UNIQUE REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    continuation_run_id TEXT NOT NULL UNIQUE REFERENCES environment_runs(environment_run_id) ON DELETE CASCADE,
    refinement_apply_id TEXT NOT NULL UNIQUE REFERENCES refinement_applies(refinement_apply_id) ON DELETE CASCADE,
    source_snapshot_hash TEXT NOT NULL,
    continuation_snapshot_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK (source_run_id <> continuation_run_id)
  );
`;
