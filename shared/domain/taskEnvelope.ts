import type { JsonValue, NodeResult } from "./automation.js";
import type { OrchestrationScope, WorkNodeOutcome } from "./runtime.js";

export const taskEnvelopeVersion = 7 as const;
export const maxTaskEnvelopeBytes = 384 * 1024;
export const maxRelevantHistoryEntries = 8;
export const maxRelevantHistoryBytes = 64 * 1024;
export const maxRoutingRequestEnvelopeBytes = 64 * 1024;
export const maxResumeContextBytes = 32 * 1024;

export interface TaskEnvelopeRunIdentity {
  rootRunId: string;
  graphNodeInvocationId?: string;
  jobNodeInvocationId?: string;
  nodeRunId: string;
}
export interface TaskEnvelopeNodeIdentity { id: string; description: string; }
export interface TaskEnvelopeState { revision: number; value: JsonValue; sha256: string; }
export interface TaskEnvelopeResumeContext { question: string; context: string; response: string; }
export interface TaskEnvelopeHistoryEntry {
  sequence: number;
  nodeRunId: string;
  role: "work" | "validation" | "orchestrator" | "repair";
  state: "completed" | "needs_input" | "blocked" | "failed";
  summary: string;
  stateRevision: number;
}
export interface TaskEnvelopeRouteCandidate { key: string; description: string; }

interface TaskEnvelopeBase {
  version: typeof taskEnvelopeVersion;
  run: TaskEnvelopeRunIdentity;
  role: "work" | "validation" | "orchestrator" | "repair";
  task: string;
  state: TaskEnvelopeState;
  resume?: TaskEnvelopeResumeContext;
  relevantHistory: TaskEnvelopeHistoryEntry[];
}

export interface WorkTaskEnvelopeV7 extends TaskEnvelopeBase {
  role: "work";
  graphNode: TaskEnvelopeNodeIdentity;
  jobNode: TaskEnvelopeNodeIdentity;
  workNode: TaskEnvelopeNodeIdentity;
  workAttempt: number;
  previousValidationFeedback?: { feedback: string; expectedCorrection: string };
}

export interface ValidationTaskEnvelopeV7 extends TaskEnvelopeBase {
  role: "validation";
  graphNode: TaskEnvelopeNodeIdentity;
  jobNode: TaskEnvelopeNodeIdentity;
  validationNode: TaskEnvelopeNodeIdentity;
  workAttempt: number;
  workOutcome: WorkNodeOutcome;
  repairReturn?: { repairRequestId: string; repairResultId: string; stateRevision: number; summary: string };
}

export interface OrchestratorTaskEnvelopeV7 extends TaskEnvelopeBase {
  role: "orchestrator";
  scope: OrchestrationScope;
  graphNode?: TaskEnvelopeNodeIdentity;
  request: {
    id: string;
    kind: "start" | "continuation" | "repair";
    sourceChildId?: string;
    result?: NodeResult;
    requestedCapability?: string;
    evidence: JsonValue;
  };
  allowedCandidates: TaskEnvelopeRouteCandidate[];
  repairAvailable: boolean;
}

export interface RepairTaskEnvelopeV7 extends TaskEnvelopeBase {
  role: "repair";
  scope: OrchestrationScope;
  graphNode?: TaskEnvelopeNodeIdentity;
  request: {
    id: string;
    reason: string;
    requestedCapability?: string;
    evidence: JsonValue;
    returnValidationNodeId: string;
    attempt: number;
    depth: number;
  };
  allowedCandidates: TaskEnvelopeRouteCandidate[];
  parentEscalationAvailable: boolean;
}

export type TaskEnvelopeV7 =
  | WorkTaskEnvelopeV7
  | ValidationTaskEnvelopeV7
  | OrchestratorTaskEnvelopeV7
  | RepairTaskEnvelopeV7;
