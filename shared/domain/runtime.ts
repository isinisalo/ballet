// Canonical persisted runtime contracts. Project authoring types live in their
// own domain modules; this file owns only resolved, immutable Run evidence.
import type { JsonValue, ProjectLoop } from "./automation.js";
import type { RootExecutionSnapshot } from "./executionRuntime.js";
import type { LoopTheme } from "./loopThemes.js";

export * from "./executionRuntime.js";
export * from "./runtimeOrchestration.js";

export const maxStatePatchBytes = 65_536;
export const maxOrchestratorDispatchValueBytes = 65_536;
export const maxStatePatchOperations = 128;
export const maxRuntimeJsonDepth = 64;
export const maxControlFlowTransitions = 256;
export const maxReadStateRevisionMetadata = 64;
export const maxReadStatePatchEvidenceBytes = 262_144;

export type JsonPatchOperation =
  | { op: "add"; path: string; value: JsonValue }
  | { op: "remove"; path: string }
  | { op: "replace"; path: string; value: JsonValue };
export type StatePatch = JsonPatchOperation[];

export interface StatePatchEvidence {
  patch: StatePatch;
  patchSha256: string;
}

export interface LoopStateRevision {
  rootRunId: string;
  revision: number;
  parentRevision?: number;
  state: JsonValue;
  stateSha256: string;
  patch?: StatePatchEvidence;
  sourceNodeRunId?: string;
  outcome?: CanonicalNodeOutcome;
  controlFlowEventId?: number;
  createdAt: string;
}

/** Bounded read evidence. Historical state values and outcomes are never exposed here. */
export interface LoopStateRevisionMetadata {
  rootRunId: string;
  revision: number;
  parentRevision?: number;
  stateSha256: string;
  sourceNodeRunId?: string;
  patch?: StatePatchEvidence;
  patchOmitted: boolean;
  createdAt: string;
}

export type NodeRunRole = "job" | "validation" | "orchestrator";
export type NodeRunStatus =
  | "queued" | "running" | "waiting_for_input" | "completed"
  | "blocked" | "failed" | "cancelled" | "interrupted";
export type JobRunStatus = Exclude<NodeRunStatus, "interrupted">;

export type RunCheckStatus = "passed" | "failed" | "skipped";

export interface RunCheck {
  name: string;
  status: RunCheckStatus;
  details?: string;
}

interface OutcomeSummary {
  summary: string;
}

interface CheckedOutcomeSummary extends OutcomeSummary {
  checks: RunCheck[];
}

export type JobCompletedOutcome = CheckedOutcomeSummary & {
  role: "job";
  state: "completed";
  artifacts: { [key: string]: JsonValue };
  statePatch?: StatePatch;
};

export type JobNodeOutcome =
  | JobCompletedOutcome
  | CheckedOutcomeSummary & {
      role: "job";
      state: "needs_input";
      question: string;
      context: string;
    }
  | CheckedOutcomeSummary & {
      role: "job";
      state: "blocked" | "failed";
    };

interface ValidationEscalationBase {
  reason: string;
  evidenceRefs: string[];
}

export type ValidationEscalation = ValidationEscalationBase & (
  | { requestedCapability: string; requestedOutcome?: never }
  | { requestedCapability?: never; requestedOutcome: JsonValue }
);

export type ValidationCompletedOutcome = CheckedOutcomeSummary & {
  role: "validation";
  state: "completed";
  evidence: JsonValue;
} & (
  | { decision: "PASS"; statePatch?: StatePatch; feedback?: never; expectedCorrection?: never; escalation?: never }
  | {
      decision: "FAIL";
      feedback: string;
      expectedCorrection: string;
      escalation: ValidationEscalation;
      statePatch?: never;
    }
);

export type ValidationNodeOutcome =
  | ValidationCompletedOutcome
  | CheckedOutcomeSummary & {
      role: "validation";
      state: "needs_input";
      question: string;
      context: string;
    }
  | CheckedOutcomeSummary & {
      role: "validation";
      state: "blocked" | "failed";
    };

export type OrchestratorNodeOutcome =
  | {
      role: "orchestrator";
      state: "completed";
      targetLoopId: string;
      routeReason: string;
      dispatchInput: JsonValue;
      expectedOutcome: JsonValue;
    }
  | OutcomeSummary & {
      role: "orchestrator";
      state: "needs_input";
      question: string;
      context: string;
    }
  | OutcomeSummary & {
      role: "orchestrator";
      state: "blocked" | "failed";
    };

export type CanonicalNodeOutcome = JobNodeOutcome | ValidationNodeOutcome | OrchestratorNodeOutcome;

export type LoopRunSource = "manual" | "flow" | "repair" | "schedule";
export type LoopRunStatus =
  | "queued" | "running" | "waiting_for_input" | "completed"
  | "blocked" | "failed" | "cancelled";
export type LoopScheduleOccurrenceStatus = "started" | "skipped" | "missed";

export interface LoopScheduleOccurrence { jobNodeId: string; scheduledFor: string }

export interface LoopScheduleState {
  loopId: string;
  jobNodeId: string;
  nextRunAt?: string;
  lastScheduledAt?: string;
  lastStatus?: LoopScheduleOccurrenceStatus;
  lastLoopRunId?: string;
  lastError?: string;
}

export interface RootRun {
  rootRunId: string;
  kind: "loop";
  targetId: string;
  source: "manual" | "schedule";
  status: LoopRunStatus | "finalizing";
  stateRevision: number;
  input?: string;
  outcome?: CanonicalNodeOutcome;
  errorCode?: string;
  errorMessage?: string;
  worktreePath: string;
  branch: string;
  headSha: string;
  configHash: string;
  snapshotHash: string;
  transitionCount: number;
  activeLoopRunId?: string;
  activeNodeRunId?: string;
  executionSnapshot: RootExecutionSnapshot;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LoopRun {
  loopRunId: string;
  loopId: string;
  rootRunId: string;
  parentLoopRunId?: string;
  source: LoopRunSource;
  status: LoopRunStatus;
  input?: JsonValue;
  snapshot: ProjectLoop;
  themeSnapshot: LoopTheme;
  schedule?: LoopScheduleOccurrence;
  orchestrationRequestId?: string;
  repairRequestId?: string;
  orchestrationFrameId?: string;
  entryStateRevision: number;
  completionStateRevision?: number;
  nestingDepth: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface JobRun {
  jobRunId: string;
  rootRunId: string;
  loopRunId: string;
  loopId: string;
  jobNodeId: string;
  jobAttempt: number;
  status: JobRunStatus;
  stateRevisionBefore: number;
  stateRevisionAfter?: number;
  activeNodeRunId?: string;
  terminal?: "completed" | "blocked" | "failed" | "cancelled";
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface NodeRun {
  nodeRunId: string;
  rootRunId: string;
  loopRunId: string;
  jobRunId?: string;
  role: NodeRunRole;
  loopId: string;
  jobNodeId?: string;
  workflowNodeId?: string;
  nodeDefinitionId: string;
  executionTaskId?: string;
  input?: JsonValue;
  context?: JsonValue;
  outcome?: CanonicalNodeOutcome;
  status: NodeRunStatus;
  attempt: number;
  stateRevisionBefore: number;
  stateRevisionAfter?: number;
  patch?: StatePatchEvidence;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LoopRunDetails extends LoopRun {
  jobRuns: JobRun[];
  nodeRuns: NodeRun[];
}
