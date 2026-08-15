export const runtimeSchemaInvariants = `
  CREATE UNIQUE INDEX idx_loop_schedule_occurrence
    ON loop_invocations(loop_id, schedule_work_loop_node_id, scheduled_for) WHERE source = 'schedule';
  CREATE UNIQUE INDEX idx_one_active_node_phase
    ON node_runs(work_loop_node_run_id)
    WHERE work_loop_node_run_id IS NOT NULL AND status IN ('queued','running','waiting_for_input');
  CREATE INDEX idx_loop_invocations_root ON loop_invocations(root_run_id, created_at);
  CREATE INDEX idx_work_loop_node_runs_loop ON work_loop_node_runs(loop_run_id, created_at);
  CREATE INDEX idx_node_runs_composite ON node_runs(work_loop_node_run_id, created_at);
  CREATE INDEX idx_state_revisions_latest ON state_revisions(root_run_id, revision DESC);
  CREATE INDEX idx_repair_requests_pending ON repair_requests(root_run_id, status, created_at);
  CREATE INDEX idx_frames_open ON orchestration_frames(root_run_id, status, created_at);
  CREATE INDEX idx_control_flow_root ON control_flow_events(root_run_id, sequence);
  CREATE INDEX idx_tasks_queue ON execution_tasks(provider, status, created_at);
  CREATE INDEX idx_tasks_root ON execution_tasks(root_run_id, created_at);
  CREATE INDEX idx_events_cursor ON execution_events(task_id, id);
  CREATE INDEX idx_schedule_due ON loop_schedule_state(next_run_at);

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
  BEFORE UPDATE OF target_id, source, worktree_path, branch, head_sha, config_hash, snapshot_hash, execution_snapshot_json ON root_runs
  BEGIN SELECT RAISE(ABORT, 'root run execution snapshot is immutable'); END;
  CREATE TRIGGER active_node_must_belong_to_composite BEFORE UPDATE OF active_node_run_id ON work_loop_node_runs
  WHEN NEW.active_node_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM node_runs WHERE node_run_id = NEW.active_node_run_id
      AND work_loop_node_run_id = NEW.work_loop_node_run_id
      AND status IN ('queued','running','waiting_for_input')
  )
  BEGIN SELECT RAISE(ABORT, 'active node run must be an active phase of its Work Loop Node Run'); END;
  CREATE TRIGGER work_loop_node_run_owner BEFORE INSERT ON work_loop_node_runs
  WHEN NOT EXISTS (
    SELECT 1 FROM loop_invocations WHERE loop_run_id = NEW.loop_run_id
      AND root_run_id = NEW.root_run_id AND loop_id = NEW.loop_id
  )
  BEGIN SELECT RAISE(ABORT, 'Work Loop Node Run owner does not match its Loop Run'); END;
  CREATE TRIGGER node_run_owner BEFORE INSERT ON node_runs
  WHEN NOT EXISTS (
    SELECT 1 FROM loop_invocations WHERE loop_run_id = NEW.loop_run_id
      AND root_run_id = NEW.root_run_id AND loop_id = NEW.loop_id
  ) OR (
    NEW.work_loop_node_run_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM work_loop_node_runs WHERE work_loop_node_run_id = NEW.work_loop_node_run_id
        AND root_run_id = NEW.root_run_id AND loop_run_id = NEW.loop_run_id
        AND loop_id = NEW.loop_id AND work_loop_node_id = NEW.work_loop_node_id
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
    UPDATE work_loop_node_runs SET active_node_run_id = NULL
      WHERE work_loop_node_run_id = NEW.work_loop_node_run_id AND active_node_run_id = NEW.node_run_id;
    UPDATE root_runs SET active_node_run_id = NULL
      WHERE root_run_id = NEW.root_run_id AND active_node_run_id = NEW.node_run_id;
  END;
  CREATE TRIGGER repair_requester_must_be_validation BEFORE INSERT ON repair_requests
  WHEN NOT EXISTS (
    SELECT 1 FROM node_runs WHERE node_run_id = NEW.requester_validation_node_run_id
      AND role = 'validation' AND work_loop_node_run_id = NEW.requester_work_loop_node_run_id
  )
  BEGIN SELECT RAISE(ABORT, 'repair requester must be the Validation Node Run of its Work Loop Node Run'); END;

  CREATE TRIGGER root_run_terminal_is_final BEFORE UPDATE OF status ON root_runs
  WHEN OLD.status IN ('completed','blocked','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal root run status is immutable'); END;
  CREATE TRIGGER loop_invocation_terminal_is_final BEFORE UPDATE OF status ON loop_invocations
  WHEN OLD.status IN ('completed','blocked','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal loop run status is immutable'); END;
  CREATE TRIGGER work_loop_node_run_terminal_is_final BEFORE UPDATE OF status ON work_loop_node_runs
  WHEN OLD.status IN ('completed','blocked','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal Work Loop Node Run status is immutable'); END;
  CREATE TRIGGER node_run_terminal_is_final BEFORE UPDATE OF status ON node_runs
  WHEN OLD.status IN ('completed','blocked','failed','cancelled','interrupted') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal Node Run status is immutable'); END;
  CREATE TRIGGER repair_request_terminal_is_final BEFORE UPDATE OF status ON repair_requests
  WHEN OLD.status IN ('completed','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal Repair Request status is immutable'); END;
  CREATE TRIGGER orchestration_frame_terminal_is_final BEFORE UPDATE OF status ON orchestration_frames
  WHEN OLD.status IN ('returned','failed','cancelled') AND NEW.status <> OLD.status
  BEGIN SELECT RAISE(ABORT, 'terminal orchestration frame status is immutable'); END;
`;
