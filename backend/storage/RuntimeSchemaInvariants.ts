export const runtimeSchemaInvariants = `
  CREATE UNIQUE INDEX idx_loop_schedule_occurrence
    ON loop_invocations(loop_id, schedule_job_node_id, scheduled_for) WHERE source = 'schedule';
  CREATE UNIQUE INDEX idx_one_active_node_phase
    ON node_runs(job_run_id)
    WHERE job_run_id IS NOT NULL AND status IN ('queued','running','waiting_for_input');
  CREATE UNIQUE INDEX idx_one_active_root_node
    ON node_runs(root_run_id) WHERE status IN ('queued','running','waiting_for_input');
  CREATE UNIQUE INDEX idx_one_running_loop_invocation
    ON loop_invocations(root_run_id) WHERE status = 'running';
  CREATE INDEX idx_loop_invocations_root ON loop_invocations(root_run_id, created_at);
  CREATE INDEX idx_job_runs_loop ON job_runs(loop_run_id, created_at);
  CREATE INDEX idx_node_runs_job ON node_runs(job_run_id, created_at);
  CREATE INDEX idx_state_revisions_latest ON state_revisions(root_run_id, revision DESC);
  CREATE INDEX idx_repair_requests_pending ON repair_requests(root_run_id, status, created_at);
  CREATE INDEX idx_orchestration_requests_pending ON orchestration_requests(root_run_id, status, created_at);
  CREATE INDEX idx_repair_results_root ON repair_results(root_run_id, created_at);
  CREATE INDEX idx_frames_open ON orchestration_frames(root_run_id, status, created_at);
  CREATE UNIQUE INDEX idx_one_open_frame_per_caller
    ON orchestration_frames(caller_loop_run_id) WHERE status = 'open';
  CREATE UNIQUE INDEX idx_one_open_frame_per_callee
    ON orchestration_frames(callee_loop_run_id) WHERE status = 'open';
  CREATE INDEX idx_control_flow_root ON control_flow_events(root_run_id, sequence);
  CREATE INDEX idx_tasks_queue ON execution_tasks(provider, status, created_at);
  CREATE INDEX idx_tasks_root ON execution_tasks(root_run_id, created_at);
  CREATE INDEX idx_tasks_node ON execution_tasks(node_run_id, created_at);
  CREATE INDEX idx_events_cursor ON execution_events(task_id, id);
  CREATE INDEX idx_schedule_due ON loop_schedule_state(next_run_at);
  CREATE INDEX idx_tracker_outbox_pending ON tracker_outbox(root_run_id, status, created_at);
  CREATE INDEX idx_tracker_links_root ON tracker_links(root_run_id, store_kind, external_ref);

  CREATE TRIGGER state_revision_is_monotonic BEFORE INSERT ON state_revisions
  WHEN NEW.revision <> COALESCE((SELECT MAX(revision) + 1 FROM state_revisions WHERE root_run_id = NEW.root_run_id), 0)
  BEGIN SELECT RAISE(ABORT, 'state revision must be the next monotonic revision'); END;
  CREATE TRIGGER state_revision_is_immutable BEFORE UPDATE ON state_revisions
  BEGIN SELECT RAISE(ABORT, 'state revision is immutable'); END;
  CREATE TRIGGER state_revision_is_append_only BEFORE DELETE ON state_revisions
  BEGIN SELECT RAISE(ABORT, 'state revision is append-only'); END;
  CREATE TRIGGER execution_task_spec_is_immutable
  BEFORE UPDATE OF provider, kind, root_run_id, node_run_id, spec_json, spec_hash ON execution_tasks
  BEGIN SELECT RAISE(ABORT, 'execution task specification is immutable'); END;
  CREATE TRIGGER root_run_execution_snapshot_is_immutable
  BEFORE UPDATE OF kind, target_id, source, worktree_path, branch, head_sha, config_hash, snapshot_hash, execution_snapshot_json ON root_runs
  BEGIN SELECT RAISE(ABORT, 'root run execution snapshot is immutable'); END;
  CREATE TRIGGER active_node_must_belong_to_job_run BEFORE UPDATE OF active_node_run_id ON job_runs
  WHEN NEW.active_node_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM node_runs WHERE node_run_id = NEW.active_node_run_id
      AND job_run_id = NEW.job_run_id
      AND status IN ('queued','running','waiting_for_input')
  )
  BEGIN SELECT RAISE(ABORT, 'active node run must be an active phase of its Job Run'); END;
  CREATE TRIGGER job_run_owner BEFORE INSERT ON job_runs
  WHEN NOT EXISTS (
    SELECT 1 FROM loop_invocations WHERE loop_run_id = NEW.loop_run_id
      AND root_run_id = NEW.root_run_id AND loop_id = NEW.loop_id
  )
  BEGIN SELECT RAISE(ABORT, 'Job Run owner does not match its Loop Run'); END;
  CREATE TRIGGER node_run_owner BEFORE INSERT ON node_runs
  WHEN NOT EXISTS (
    SELECT 1 FROM loop_invocations WHERE loop_run_id = NEW.loop_run_id
      AND root_run_id = NEW.root_run_id AND loop_id = NEW.loop_id
  ) OR (
    NEW.job_run_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM job_runs WHERE job_run_id = NEW.job_run_id
        AND root_run_id = NEW.root_run_id AND loop_run_id = NEW.loop_run_id
        AND loop_id = NEW.loop_id AND job_node_id = NEW.job_node_id
    )
  )
  BEGIN SELECT RAISE(ABORT, 'Node Run owner does not match its runtime parent'); END;
  CREATE TRIGGER root_active_loop_owner BEFORE UPDATE OF active_loop_run_id ON root_runs
  WHEN NEW.active_loop_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM loop_invocations WHERE loop_run_id = NEW.active_loop_run_id
      AND root_run_id = NEW.root_run_id
  )
  BEGIN SELECT RAISE(ABORT, 'active Loop Run must belong to its Root Run'); END;
  CREATE TRIGGER root_active_node_owner BEFORE UPDATE OF active_node_run_id ON root_runs
  WHEN NEW.active_node_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM node_runs WHERE node_run_id = NEW.active_node_run_id
      AND root_run_id = NEW.root_run_id AND status IN ('queued','running','waiting_for_input')
  )
  BEGIN SELECT RAISE(ABORT, 'active Node Run must belong to its Root Run'); END;
  CREATE TRIGGER terminal_node_clears_active_phase AFTER UPDATE OF status ON node_runs
  WHEN NEW.status IN ('completed','blocked','failed','cancelled','interrupted')
  BEGIN
    UPDATE job_runs SET active_node_run_id = NULL
      WHERE job_run_id = NEW.job_run_id AND active_node_run_id = NEW.node_run_id;
    UPDATE root_runs SET active_node_run_id = NULL
      WHERE root_run_id = NEW.root_run_id AND active_node_run_id = NEW.node_run_id;
  END;
  CREATE TRIGGER repair_requester_must_be_validation BEFORE INSERT ON repair_requests
  WHEN NOT EXISTS (
    SELECT 1 FROM node_runs node
    JOIN loop_invocations loop ON loop.loop_run_id = node.loop_run_id
    WHERE node.node_run_id = NEW.requester_validation_node_run_id
      AND node.root_run_id = NEW.root_run_id AND node.role = 'validation'
      AND node.job_run_id = NEW.requester_job_run_id
      AND node.loop_run_id = NEW.requester_loop_run_id AND node.loop_id = NEW.return_loop_id
  )
  BEGIN SELECT RAISE(ABORT, 'repair requester must be the Validation Node Run of its Job Run'); END;
  CREATE TRIGGER repair_orchestrator_must_be_orchestrator BEFORE UPDATE OF orchestrator_node_run_id ON repair_requests
  WHEN NEW.orchestrator_node_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM node_runs WHERE node_run_id = NEW.orchestrator_node_run_id
      AND root_run_id = NEW.root_run_id AND loop_run_id = NEW.requester_loop_run_id AND role = 'orchestrator'
  )
  BEGIN SELECT RAISE(ABORT, 'repair orchestrator must be an Orchestrator Node Run of the requester Loop Run'); END;
  CREATE TRIGGER orchestration_request_owner BEFORE INSERT ON orchestration_requests
  WHEN NOT EXISTS (
    SELECT 1 FROM loop_invocations loop
    JOIN node_runs node ON node.node_run_id = NEW.source_node_run_id
    WHERE loop.loop_run_id = NEW.source_loop_run_id AND loop.root_run_id = NEW.root_run_id
      AND loop.loop_id = NEW.source_loop_id AND node.root_run_id = NEW.root_run_id
      AND node.loop_run_id = NEW.source_loop_run_id AND node.loop_id = NEW.source_loop_id
  )
  BEGIN SELECT RAISE(ABORT, 'orchestration request source does not match its Root Run and Loop invocation'); END;
  CREATE TRIGGER orchestration_request_identity_is_immutable
  BEFORE UPDATE OF root_run_id, kind, source_loop_run_id, source_loop_id, source_node_run_id,
    state_revision_at_request, completion_summary, completion_evidence_json,
    requested_capability, expected_outcome_json, repair_request_id ON orchestration_requests
  BEGIN SELECT RAISE(ABORT, 'orchestration request identity and evidence are immutable'); END;
  CREATE TRIGGER orchestration_orchestrator_must_be_orchestrator
  BEFORE UPDATE OF orchestrator_node_run_id ON orchestration_requests
  WHEN NEW.orchestrator_node_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM node_runs node WHERE node.node_run_id = NEW.orchestrator_node_run_id
      AND node.root_run_id = NEW.root_run_id AND node.loop_run_id = NEW.source_loop_run_id
      AND node.loop_id = NEW.source_loop_id AND node.role = 'orchestrator'
  )
  BEGIN SELECT RAISE(ABORT, 'orchestration request orchestrator must belong to its source Loop invocation'); END;
  CREATE TRIGGER orchestration_frame_owner BEFORE INSERT ON orchestration_frames
  WHEN NOT EXISTS (
    SELECT 1 FROM repair_requests request
    JOIN orchestration_requests orchestration ON orchestration.repair_request_id = request.repair_request_id
    JOIN orchestrator_routes route ON route.route_id = NEW.route_id
    JOIN loop_invocations caller ON caller.loop_run_id = NEW.caller_loop_run_id
    JOIN loop_invocations callee ON callee.loop_run_id = NEW.callee_loop_run_id
    WHERE request.repair_request_id = NEW.repair_request_id
      AND request.root_run_id = NEW.root_run_id AND request.status = 'routed'
      AND request.requester_loop_run_id = NEW.caller_loop_run_id
      AND route.orchestration_request_id = orchestration.orchestration_request_id
      AND route.kind = 'repair'
      AND caller.root_run_id = NEW.root_run_id AND caller.loop_id = route.source_loop_id
      AND caller.status = 'waiting_for_input'
      AND callee.root_run_id = NEW.root_run_id AND callee.loop_id = route.target_loop_id
      AND callee.source = 'repair' AND callee.status IN ('running','waiting_for_input')
      AND callee.repair_request_id = request.repair_request_id
  )
  BEGIN SELECT RAISE(ABORT, 'orchestration frame owner does not match its request, route, caller, and callee'); END;
  CREATE TRIGGER repair_result_owner BEFORE INSERT ON repair_results
  WHEN NOT EXISTS (
    SELECT 1 FROM orchestration_frames frame
    JOIN loop_invocations target ON target.loop_run_id = frame.callee_loop_run_id
    WHERE frame.frame_id = NEW.orchestration_frame_id
      AND frame.root_run_id = NEW.root_run_id AND frame.repair_request_id = NEW.repair_request_id
      AND frame.callee_loop_run_id = NEW.target_loop_run_id AND target.loop_id = NEW.target_loop_id
  )
  BEGIN SELECT RAISE(ABORT, 'repair result owner does not match its orchestration frame'); END;

  CREATE TRIGGER root_run_terminal_is_final BEFORE UPDATE OF status ON root_runs
  WHEN OLD.status IN ('completed','blocked','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal root run status is immutable'); END;
  CREATE TRIGGER loop_invocation_terminal_is_final BEFORE UPDATE OF status ON loop_invocations
  WHEN OLD.status IN ('completed','blocked','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal loop run status is immutable'); END;
  CREATE TRIGGER job_run_terminal_is_final BEFORE UPDATE OF status ON job_runs
  WHEN OLD.status IN ('completed','blocked','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal Job Run status is immutable'); END;
  CREATE TRIGGER node_run_terminal_is_final BEFORE UPDATE OF status ON node_runs
  WHEN OLD.status IN ('completed','blocked','failed','cancelled','interrupted') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal Node Run status is immutable'); END;
  CREATE TRIGGER repair_request_terminal_is_final BEFORE UPDATE OF status ON repair_requests
  WHEN OLD.status IN ('repaired','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal Repair Request status is immutable'); END;
  CREATE TRIGGER orchestration_request_terminal_is_final BEFORE UPDATE OF status ON orchestration_requests
  WHEN OLD.status IN ('dispatched','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal orchestration request status is immutable'); END;
  CREATE TRIGGER orchestration_frame_terminal_is_final BEFORE UPDATE OF status ON orchestration_frames
  WHEN OLD.status IN ('returned','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal orchestration frame status is immutable'); END;
`;
