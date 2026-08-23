import type { JsonValue, NodeResult, ProjectGraphNode } from "./automation.js";
import type { RootExecutionSnapshot } from "./executionRuntime.js";

export * from "./executionRuntime.js";
export * from "./runtimeOrchestration.js";

export const maxStatePatchBytes = 65_536;
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
export interface StatePatchEvidence { patch: StatePatch; patchSha256: string; }

export interface GraphStateRevision {
  rootRunId: string;
  revision: number;
  parentRevision?: number;
  state: JsonValue;
  stateSha256: string;
  patch?: StatePatchEvidence;
  sourceNodeRunId?: string;
  outcome?: CanonicalNodeOutcome;
  createdAt: string;
}

export type GraphStateRevisionMetadata = Omit<GraphStateRevision, "state" | "outcome"> & { patchOmitted: boolean };
export type NodeRunRole = "work" | "validation";
export type NodeRunStatus =
  | "queued" | "running" | "waiting_for_input" | "completed"
  | "blocked" | "failed" | "cancelled" | "interrupted";
export type InvocationStatus = Exclude<NodeRunStatus, "interrupted">;
export type RunCheckStatus = "passed" | "failed" | "skipped";
export interface RunCheck { name: string; status: RunCheckStatus; details?: string; }

interface OutcomeBase { role: NodeRunRole; summary: string; }
interface CheckedOutcomeBase extends OutcomeBase { checks: RunCheck[]; }

export type WorkNodeOutcome =
  | CheckedOutcomeBase & {
      role: "work";
      state: "completed";
      artifacts: Record<string, JsonValue>;
      statePatch?: StatePatch;
    }
  | CheckedOutcomeBase & {
      role: "work";
      state: "needs_input";
      question: string;
      context: string;
    }
  | CheckedOutcomeBase & { role: "work"; state: "blocked" | "failed" };

export interface ValidationNodeOutcome extends CheckedOutcomeBase {
  role: "validation";
  state: "completed";
  decision: NodeResult;
  outcomeId: string;
  disposition?: "retry" | "escalate";
  evidence: JsonValue;
  feedback?: string;
  expectedCorrection?: string;
  acceptance: {
    verifyObligationIds: string[];
    invalidateObligationIds: string[];
    evidenceRefs: string[];
  };
  statePatch?: StatePatch;
}
export type CanonicalNodeOutcome = WorkNodeOutcome | ValidationNodeOutcome;

export interface RootRun {
  rootRunId: string;
  kind: "graph" | "graph_node";
  targetId: string;
  source: "manual";
  status: InvocationStatus | "finalizing";
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
  activeGraphNodeInvocationId?: string;
  activeNodeRunId?: string;
  executionSnapshot: RootExecutionSnapshot;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface GraphNodeInvocation {
  graphNodeInvocationId: string;
  graphNodeId: string;
  rootRunId: string;
  policyDecisionId?: string;
  source: "policy" | "root";
  status: InvocationStatus;
  input?: JsonValue;
  snapshot: ProjectGraphNode;
  entryStateRevision: number;
  completionStateRevision?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ActionNodeInvocation {
  actionNodeInvocationId: string;
  rootRunId: string;
  graphNodeInvocationId: string;
  graphNodeId: string;
  actionNodeId: string;
  workAttempt: number;
  status: InvocationStatus;
  stateRevisionBefore: number;
  stateRevisionAfter?: number;
  activeNodeRunId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface NodeRun {
  nodeRunId: string;
  rootRunId: string;
  graphNodeInvocationId?: string;
  actionNodeInvocationId?: string;
  role: NodeRunRole;
  graphNodeId?: string;
  actionNodeId?: string;
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

export interface GraphNodeInvocationDetails extends GraphNodeInvocation {
  actionNodeInvocations: ActionNodeInvocation[];
  nodeRuns: NodeRun[];
}
