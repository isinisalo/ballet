import type {
  AgentOutcome,
  LoopRunSource,
  LoopRunStatus,
  StepRunConsoleKind,
  StepRunConsolePhase,
  StepRunResult,
  StepRunStatus
} from "../../shared/domain/runtime.js";
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
  loop_id: string;
  root_run_id: string;
  parent_run_id: string | null;
  parent_step_run_id: string | null;
  source: LoopRunSource;
  status: LoopRunStatus;
  input: string | null;
  snapshot_json: string;
  transition_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface StepRunRow {
  step_run_id: string;
  run_id: string;
  loop_id: string;
  step_id: string;
  step_type: "agent" | "human";
  agent_id: string | null;
  status: StepRunStatus;
  input: string | null;
  response_input: string | null;
  result: StepRunResult | null;
  outcome_json: string | null;
  error: string | null;
  attempt: number;
  lease_owner: string | null;
  lease_until: string | null;
  thread_id: string | null;
  turn_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface StepRunLogRow {
  id: number;
  step_run_id: string;
  source: "ballet" | "codex";
  kind: StepRunConsoleKind;
  level: "info" | "warn" | "error";
  phase: StepRunConsolePhase;
  item_id: string | null;
  message: string;
  data_json: string | null;
  content_bytes: number;
  terminal: 0 | 1;
  created_at: string;
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
  threadId?: string;
  turnId?: string;
}
