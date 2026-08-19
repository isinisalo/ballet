import type { JsonValue } from "./automation.js";
import type { CanonicalNodeOutcome, WorkCompletedOutcome } from "./runtime.js";

export const taskEnvelopeVersion = 4 as const;
export const maxTaskEnvelopeBytes = 384 * 1024;
export const maxRelevantHistoryEntries = 8;
export const maxRelevantHistoryBytes = 64 * 1024;
export const maxOrchestrationRequestEnvelopeBytes = 64 * 1024;
export const maxResumeContextBytes = 32 * 1024;

export interface TaskEnvelopeRunIdentity {
  rootRunId: string;
  loopRunId: string;
  nodeRunId: string;
}

export interface TaskEnvelopeProviderRunIdentity extends TaskEnvelopeRunIdentity {
  workLoopNodeRunId: string;
}

export interface TaskEnvelopeLoopIdentity {
  id: string;
  description: string;
}

export interface TaskEnvelopeWorkLoopNodeIdentity {
  id: string;
  description: string;
}

export interface TaskEnvelopeState {
  revision: number;
  value: JsonValue;
  sha256: string;
}

export interface TaskEnvelopeResumeContext {
  question: string;
  context: string;
  response: string;
}

export interface TaskEnvelopeHistoryEntry {
  sequence: number;
  nodeRunId: string;
  role: "work" | "validation" | "orchestrator";
  state: "completed" | "needs_input" | "blocked" | "failed";
  summary: string;
  stateRevision: number;
}

interface TaskEnvelopeRepairRequestBase {
  id: string;
  requesterLoopRunId: string;
  requesterWorkLoopNodeRunId: string;
  requesterValidationNodeRunId: string;
  attempt: number;
  validationSummary: string;
  reason: string;
  evidence?: JsonValue;
  stateRevisionAtRequest: number;
  nestingDepth: number;
}

export type TaskEnvelopeRepairRequest = TaskEnvelopeRepairRequestBase & (
  | { requestedCapability: string; requestedOutcome?: never }
  | { requestedCapability?: never; requestedOutcome: JsonValue }
);

export interface TaskEnvelopeRouteCandidate {
  id: string;
  description: string;
  capabilities: {
    accepts: string[];
    provides: string[];
  };
  route: {
    kind: "flow" | "repair";
    capability: string;
    description: string;
  };
}

export interface TaskEnvelopeOrchestrationRequest {
  id: string;
  kind: "flow" | "repair";
  sourceLoopId: string;
  sourceLoopRunId: string;
  sourceNodeRunId: string;
  stateRevisionAtRequest: number;
  completionSummary: string;
  completionEvidence: JsonValue;
  requestedCapability?: string;
  expectedOutcome?: JsonValue;
}

export interface TaskEnvelopeRepairReturn {
  repairRequest: TaskEnvelopeRepairRequest;
  repairResult: {
    id: string;
    frameId: string;
    targetLoopRunId: string;
    targetLoopId: string;
    stateRevision: number;
    outcome?: CanonicalNodeOutcome;
    summary: string;
  };
}

interface TaskEnvelopeBase {
  version: typeof taskEnvelopeVersion;
  loop: TaskEnvelopeLoopIdentity;
  task: string;
  state: TaskEnvelopeState;
  resume?: TaskEnvelopeResumeContext;
  relevantHistory: TaskEnvelopeHistoryEntry[];
}

export interface WorkTaskEnvelopeV4 extends TaskEnvelopeBase {
  role: "work";
  run: TaskEnvelopeProviderRunIdentity;
  workLoopNode: TaskEnvelopeWorkLoopNodeIdentity;
  localAttempt: number;
  previousValidationFeedback?: {
    feedback: string;
    expectedCorrection: string;
  };
}

export interface ValidationTaskEnvelopeV4 extends TaskEnvelopeBase {
  role: "validation";
  run: TaskEnvelopeProviderRunIdentity;
  workLoopNode: TaskEnvelopeWorkLoopNodeIdentity;
  localAttempt: number;
  workOutcome: WorkCompletedOutcome;
  repairReturn?: TaskEnvelopeRepairReturn;
}

export interface OrchestratorTaskEnvelopeV4 extends TaskEnvelopeBase {
  role: "orchestrator";
  run: TaskEnvelopeRunIdentity;
  orchestrationRequest: TaskEnvelopeOrchestrationRequest;
  allowedCandidates: TaskEnvelopeRouteCandidate[];
}

export type TaskEnvelopeV4 =
  | WorkTaskEnvelopeV4
  | ValidationTaskEnvelopeV4
  | OrchestratorTaskEnvelopeV4;
