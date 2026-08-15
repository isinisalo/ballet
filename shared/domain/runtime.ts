// Canonical persisted runtime contracts. Project authoring types live in their
// own domain modules; this file owns only resolved, immutable Run evidence.
import type { JsonValue, ProjectLoop } from "./automation.js";
import type { RootExecutionSnapshot } from "./executionRuntime.js";
import type { LoopTheme } from "./loopThemes.js";

export * from "./executionRuntime.js";

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

export interface NodeOutcomeBase {
  summary: string;
  statePatch?: StatePatch;
  evidence?: JsonValue;
}

export type WorkNodeOutcome = NodeOutcomeBase & {
  role: "work";
  status: "completed" | "needs_input" | "blocked" | "failed";
  question?: string;
  context?: string;
};

export type ValidationNodeOutcome = NodeOutcomeBase & (
  | { role: "validation"; decision: "OK" }
  | {
      role: "validation";
      decision: "FAIL";
      repair: {
        mode: "LOCAL_RETRY" | "ORCHESTRATOR_REPAIR";
        requestedCapability?: string;
        reason: string;
        evidence?: JsonValue;
      };
    }
);

export type OrchestratorNodeOutcome = NodeOutcomeBase & {
  role: "orchestrator";
  status: "routed" | "blocked" | "failed";
  loopEdgeId?: string;
  targetLoopId?: string;
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

export type RepairRequestStatus = "pending" | "routed" | "completed" | "failed" | "cancelled";

export interface RepairRequest {
  repairRequestId: string;
  rootRunId: string;
  requesterLoopRunId: string;
  requesterWorkLoopNodeRunId: string;
  requesterValidationNodeRunId: string;
  requestedCapability?: string;
  requestedOutcome?: JsonValue;
  reason: string;
  evidence?: JsonValue;
  stateRevisionAtRequest: number;
  routedLoopEdgeId?: string;
  routedTargetLoopId?: string;
  status: RepairRequestStatus;
  returnLoopId: string;
  returnWorkLoopNodeId: string;
  returnValidationNodeDefinitionId: string;
  nestingDepth: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface OrchestratorRoute {
  routeId: string;
  rootRunId: string;
  repairRequestId: string;
  orchestratorNodeRunId: string;
  loopEdgeId: string;
  sourceLoopId: string;
  targetLoopId: string;
  evidence?: JsonValue;
  createdAt: string;
}

export type OrchestrationFrameStatus = "open" | "returned" | "failed" | "cancelled";

export interface OrchestrationFrame {
  frameId: string;
  rootRunId: string;
  repairRequestId: string;
  callerLoopRunId: string;
  calleeLoopRunId: string;
  parentFrameId?: string;
  returnLoopId: string;
  returnWorkLoopNodeId: string;
  returnValidationNodeDefinitionId: string;
  stateRevisionAtCall: number;
  nestingDepth: number;
  status: OrchestrationFrameStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type ControlFlowEventKind =
  | "work_completed" | "work_needs_input" | "work_terminal"
  | "validation_ok" | "validation_fail_local" | "validation_fail_orchestrator"
  | "repair_return" | "repair_terminal" | "root_cancelled" | "root_terminal"
  | "execution_interrupted";

export interface ControlFlowEvent {
  id: number;
  rootRunId: string;
  sequence: number;
  kind: ControlFlowEventKind;
  stateRevision: number;
  sourceLoopRunId?: string;
  sourceWorkLoopNodeRunId?: string;
  sourceNodeRunId?: string;
  targetLoopRunId?: string;
  targetWorkLoopNodeRunId?: string;
  repairRequestId?: string;
  orchestrationFrameId?: string;
  createdAt: string;
}
