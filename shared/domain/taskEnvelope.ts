import type { JsonValue } from "./automation.js";
import type { CanonicalNodeOutcome, WorkCompletedOutcome } from "./runtime.js";

export const taskEnvelopeVersion = 3 as const;
export const maxTaskEnvelopeBytes = 384 * 1024;
export const maxRelevantHistoryEntries = 8;
export const maxRelevantHistoryBytes = 64 * 1024;
export const maxRepairRequestEnvelopeBytes = 64 * 1024;
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

export interface TaskEnvelopeTargetLoop {
  id: string;
  description: string;
  loopEdgeId: string;
  routingDescription: string;
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

export interface WorkTaskEnvelopeV3 extends TaskEnvelopeBase {
  role: "work";
  run: TaskEnvelopeProviderRunIdentity;
  workLoopNode: TaskEnvelopeWorkLoopNodeIdentity;
  localAttempt: number;
  previousValidationFeedback?: {
    feedback: string;
    expectedCorrection: string;
  };
}

export interface ValidationTaskEnvelopeV3 extends TaskEnvelopeBase {
  role: "validation";
  run: TaskEnvelopeProviderRunIdentity;
  workLoopNode: TaskEnvelopeWorkLoopNodeIdentity;
  localAttempt: number;
  workOutcome: WorkCompletedOutcome;
  repairReturn?: TaskEnvelopeRepairReturn;
}

export interface OrchestratorTaskEnvelopeV3 extends TaskEnvelopeBase {
  role: "orchestrator";
  run: TaskEnvelopeRunIdentity;
  repairRequest: TaskEnvelopeRepairRequest;
  allowedTargetLoops: TaskEnvelopeTargetLoop[];
}

export type TaskEnvelopeV3 =
  | WorkTaskEnvelopeV3
  | ValidationTaskEnvelopeV3
  | OrchestratorTaskEnvelopeV3;
