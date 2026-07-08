import type { Agent } from "../../shared/domain/agents.js";
import type { Policy, ProjectAction, ProjectOutput, ProjectOutputRoute, ProjectPolicy } from "../../shared/domain/automation.js";
import type { EventStatus } from "../../shared/domain/events.js";
import type { AgentOutcome, AgentRun, AgentRunLog, AgentRunStatus } from "../../shared/domain/runtime.js";

export const PROJECTOR_CONSUMER = "policy-projector";
export const MAX_CORRELATION_DEPTH = 20;

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
  matched_policy_id: string | null;
  assigned_agent_id: string | null;
  routing_json: string | null;
  handling_result: string | null;
  payload_json: string;
}

export interface AgentRunRow {
  run_id: string;
  trigger_event_id: string;
  trigger_event_seq: number | null;
  policy_id: string;
  policy_version: number;
  agent_role: string;
  status: AgentRunStatus;
  attempt: number;
  lease_owner: string | null;
  lease_until: string | null;
  thread_id: string | null;
  turn_id: string | null;
  outcome_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AgentRunLogRow {
  id: number;
  run_id: string;
  level: "info" | "warn" | "error";
  message: string;
  data_json: string | null;
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

export interface LeaseOptions {
  owner: string;
  leaseSeconds: number;
}

export interface CompleteRunInput {
  runId: string;
  status: AgentRunStatus;
  outcome?: AgentOutcome;
  error?: string;
  threadId?: string;
  turnId?: string;
  domainEvent?: {
    type: string;
    source?: string;
    payload: Record<string, unknown>;
  };
  projectPolicy?: ProjectPolicy;
  projectPolicies?: ProjectPolicy[];
  actions?: ProjectAction[];
  outputs?: ProjectOutput[];
  outputRoutes: ProjectOutputRoute[];
  policies?: Policy[];
  agents?: Agent[];
}

export interface PublishEventResult {
  event: import("../../shared/domain/events.js").EventRecord;
  run?: AgentRun;
  runs: AgentRun[];
  duplicate: boolean;
}

export type RunLogLevel = AgentRunLog["level"];
