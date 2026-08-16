// Canonical persisted runtime contracts. Project authoring types live in their
// own domain modules; this file owns only resolved, immutable Run evidence.
import type { JsonValue, ProjectLoop } from "./automation.js";
import type { RootExecutionSnapshot } from "./executionRuntime.js";
import type { LoopTheme } from "./loopThemes.js";

export * from "./executionRuntime.js";
export * from "./runtimeOrchestration.js";

export const maxStatePatchBytes = 65_536;
export const maxStatePatchOperations = 128;
export const maxRuntimeJsonDepth = 64;
export const maxControlFlowTransitions = 256;

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

export type NodeRunRole = "work" | "validation" | "orchestrator";
export type NodeRunStatus =
  | "queued" | "running" | "waiting_for_input" | "completed"
  | "blocked" | "failed" | "cancelled" | "interrupted";
export type WorkLoopNodeRunStatus = Exclude<NodeRunStatus, "interrupted">;

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

export type WorkCompletedOutcome = CheckedOutcomeSummary & {
  role: "work";
  state: "completed";
  artifacts: { [key: string]: JsonValue };
  statePatch?: StatePatch;
};

export type WorkNodeOutcome =
  | WorkCompletedOutcome
  | CheckedOutcomeSummary & {
      role: "work";
      state: "needs_input";
      question: string;
      context: string;
    }
  | CheckedOutcomeSummary & {
      role: "work";
      state: "blocked" | "failed";
    };

export interface LocalRetryRepair {
  mode: "LOCAL_RETRY";
  feedback: string;
  expectedCorrection: string;
}

interface OrchestratorRepairBase {
  mode: "ORCHESTRATOR_REPAIR";
  reason: string;
  evidenceRefs: string[];
}

export type OrchestratorRepair = OrchestratorRepairBase & (
  | { requestedCapability: string; requestedOutcome?: never }
  | { requestedCapability?: never; requestedOutcome: JsonValue }
);

export type ValidationCompletedOutcome = CheckedOutcomeSummary & {
  role: "validation";
  state: "completed";
  evidence: JsonValue;
} & (
  | { decision: "OK"; statePatch?: StatePatch; repair?: never }
  | { decision: "FAIL"; repair: LocalRetryRepair | OrchestratorRepair; statePatch?: never }
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
      repairInput: JsonValue;
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

export type CanonicalNodeOutcome = WorkNodeOutcome | ValidationNodeOutcome | OrchestratorNodeOutcome;

export type LoopRunSource = "manual" | "flow" | "repair" | "schedule";
export type LoopRunStatus =
  | "queued" | "running" | "waiting_for_input" | "completed"
  | "blocked" | "failed" | "cancelled";
export type LoopScheduleOccurrenceStatus = "started" | "skipped" | "missed";

export interface LoopScheduleOccurrence { workLoopNodeId: string; scheduledFor: string }

export interface LoopScheduleState {
  loopId: string;
  workLoopNodeId: string;
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
  repairRequestId?: string;
  orchestrationFrameId?: string;
  entryStateRevision: number;
  completionStateRevision?: number;
  nestingDepth: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WorkLoopNodeRun {
  workLoopNodeRunId: string;
  rootRunId: string;
  loopRunId: string;
  loopId: string;
  workLoopNodeId: string;
  attempt: number;
  status: WorkLoopNodeRunStatus;
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
  workLoopNodeRunId?: string;
  role: NodeRunRole;
  loopId: string;
  workLoopNodeId?: string;
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
  workLoopNodeRuns: WorkLoopNodeRun[];
  nodeRuns: NodeRun[];
}
