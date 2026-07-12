import type { AgentOutcome, LoopRunSource, LoopRunStatus, StepRunResult, StepRunStatus } from "../../shared/domain/runtime.js";
import type { EventStatus } from "../../shared/domain/events.js";

export const MAX_ROOT_TRANSITIONS = 20;
export const now = () => new Date().toISOString();

export interface EventRow {
  seq: number;
  event_id: string;
  type: string;
  source: string;
  subject: string;
  correlation_id: string;
  causation_id: string | null;
  dedupe_key: string | null;
  correlation_depth: number;
  occurred_at: string;
  project_id: string;
  tags_json: string;
  status: EventStatus;
  handling_result: string | null;
  payload_json: string;
}

export interface LoopRunRow {
  run_id: string;
  project_id: string;
  loop_id: string;
  root_run_id: string;
  parent_run_id: string | null;
  parent_step_run_id: string | null;
  source: LoopRunSource;
  status: LoopRunStatus;
  runtime_device_id: string | null;
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
  project_id: string;
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
  project_id: string;
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

export interface IntakeEventInput {
  projectId: string;
  eventType: string;
  source?: string;
  subject?: string;
  correlationId?: string;
  causationId?: string;
  dedupeKey?: string;
  correlationDepth?: number;
  tags?: string[];
  payload?: Record<string, unknown>;
  body?: string;
}

export interface PublishEventResult {
  event: import("../../shared/domain/events.js").EventRecord;
  duplicate: boolean;
}

export interface LeaseOptions {
  owner: string;
  leaseSeconds: number;
}

export interface CompleteStepRunInput {
  stepRunId: string;
  outcome?: AgentOutcome;
  error?: string;
}
