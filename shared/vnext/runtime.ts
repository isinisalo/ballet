import type { JsonValue } from "./primitives.js";
import { VNEXT_ROOT_SNAPSHOT_VERSION } from "./versions.js";

export type EnvironmentRunStatus = "pending" | "running" | "blocked" | "completed" | "cancelled" | "interrupted";
export type StateExecutionStatus = "pending" | "running" | "blocked" | "done" | "cancelled" | "interrupted";
export type ActionExecutionStatus = "pending" | "prechecking" | "working" | "postchecking" | "blocked" | "done" | "cancelled" | "interrupted";
export type AgentRunRole = "validation" | "work" | "critic" | "refinement";
export type AgentRunPhase = "precheck" | "work" | "postwork" | "proposal";
export type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "interrupted";

export interface RootSnapshotV13 {
  version: typeof VNEXT_ROOT_SNAPSHOT_VERSION;
  projectHeadSha: string;
  projectConfigSha256: string;
  directionSha256: string;
  environmentSha256: string;
  resourceSha256: string;
  createdAt: string;
}

export interface EnvironmentRun {
  id: string;
  environmentId: string;
  status: EnvironmentRunStatus;
  snapshot: RootSnapshotV13;
  continuationOfRunId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface StateExecution {
  id: string;
  environmentRunId: string;
  stateId: string;
  order: number;
  status: StateExecutionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ActionExecution {
  id: string;
  stateExecutionId: string;
  actionId: string;
  priority: number;
  status: ActionExecutionStatus;
  workAttempts: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  actionExecutionId?: string;
  environmentRunId: string;
  role: AgentRunRole;
  phase: AgentRunPhase;
  status: AgentRunStatus;
  attempt: number;
  outcome?: JsonValue;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSnapshot {
  id: string;
  environmentRunId: string;
  commitSha: string;
  artifactRefs: string[];
  evidenceRefs: string[];
  createdAt: string;
}

export interface ContinuationRun {
  sourceRunId: string;
  continuationRunId: string;
  refinementApplyId: string;
  sourceSnapshotSha256: string;
  continuationSnapshotSha256: string;
  createdAt: string;
}

export type ControlFlowEventKind =
  | "environment_started"
  | "state_activated"
  | "action_selected"
  | "validation_precheck_dispatched"
  | "validation_precheck_done"
  | "work_dispatched"
  | "work_completed"
  | "validation_postwork_dispatched"
  | "validation_done"
  | "validation_retry"
  | "action_blocked"
  | "feedback_created"
  | "state_completed"
  | "environment_completed"
  | "environment_blocked"
  | "environment_cancelled"
  | "execution_interrupted"
  | "continuation_created";

export interface ControlFlowEvent {
  id: string;
  environmentRunId: string;
  actionExecutionId?: string;
  sequence: number;
  kind: ControlFlowEventKind;
  data?: JsonValue;
  createdAt: string;
}
