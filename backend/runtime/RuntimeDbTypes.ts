import type { AgentOutcome, LoopRunSource, LoopRunStatus, StepRunResult, StepRunStatus } from "../../shared/domain/runtime.js";

export const MAX_ROOT_TRANSITIONS = 20;
export const now = () => new Date().toISOString();

export interface LoopRunRow {
  run_id: string;
  loop_id: string;
  root_run_id: string;
  parent_run_id: string | null;
  parent_step_run_id: string | null;
  source: LoopRunSource;
  status: LoopRunStatus;
  execution_plan_json: string | null;
  schedule_step_id: string | null;
  scheduled_for: string | null;
  input: string | null;
  snapshot_json: string;
  transition_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface LoopScheduleStateRow {
  loop_id: string;
  step_id: string;
  definition_hash: string;
  next_run_at: string | null;
  last_scheduled_at: string | null;
  last_status: "started" | "skipped" | "missed" | null;
  last_run_id: string | null;
  last_error: string | null;
  updated_at: string;
}

export interface StepRunRow {
  step_run_id: string;
  run_id: string;
  loop_id: string;
  step_id: string;
  step_type: "agent" | "human";
  agent_id: string | null;
  execution_task_id: string | null;
  execution_snapshot_json: string | null;
  status: StepRunStatus;
  input: string | null;
  response_input: string | null;
  result: StepRunResult | null;
  outcome_json: string | null;
  error: string | null;
  attempt: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CompleteStepRunInput {
  stepRunId: string;
  outcome?: AgentOutcome;
  error?: string;
}
