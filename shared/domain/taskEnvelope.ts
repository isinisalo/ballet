import type { JsonValue } from "./automation.js";
import type { CanonicalNodeOutcome, JobCompletedOutcome } from "./runtime.js";

export const taskEnvelopeVersion = 5 as const;
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
  jobRunId: string;
}

export interface TaskEnvelopeLoopIdentity {
  id: string;
  description: string;
}

export interface TaskEnvelopeWorkflowNodeIdentity {
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
  role: "job" | "validation" | "orchestrator";
  state: "completed" | "needs_input" | "blocked" | "failed";
  summary: string;
  stateRevision: number;
}

interface TaskEnvelopeRepairRequestBase {
  id: string;
  requesterLoopRunId: string;
  requesterJobRunId: string;
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

export interface JobTaskEnvelopeV5 extends TaskEnvelopeBase {
  role: "job";
  run: TaskEnvelopeProviderRunIdentity;
  jobNode: TaskEnvelopeWorkflowNodeIdentity;
  jobAttempt: number;
  previousValidationFeedback?: {
    feedback: string;
    expectedCorrection: string;
  };
}

export interface ValidationTaskEnvelopeV5 extends TaskEnvelopeBase {
  role: "validation";
  run: TaskEnvelopeProviderRunIdentity;
  jobNode: TaskEnvelopeWorkflowNodeIdentity;
  validationNode: TaskEnvelopeWorkflowNodeIdentity;
  jobAttempt: number;
  jobOutcome: JobCompletedOutcome;
  repairReturn?: TaskEnvelopeRepairReturn;
}

export interface OrchestratorTaskEnvelopeV5 extends TaskEnvelopeBase {
  role: "orchestrator";
  run: TaskEnvelopeRunIdentity;
  orchestrationRequest: TaskEnvelopeOrchestrationRequest;
  allowedCandidates: TaskEnvelopeRouteCandidate[];
}

export type TaskEnvelopeV5 =
  | JobTaskEnvelopeV5
  | ValidationTaskEnvelopeV5
  | OrchestratorTaskEnvelopeV5;
