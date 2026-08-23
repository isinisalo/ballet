import type { JsonValue, NodeResult } from "./automation.js";
import type { AcceptanceLedgerSnapshotV1 } from "./decisionModel.js";
import type { WorkNodeOutcome } from "./runtime.js";

export const taskEnvelopeVersion = 9 as const;
export const maxTaskEnvelopeBytes = 384 * 1024;
export const maxRelevantHistoryEntries = 8;
export const maxRelevantHistoryBytes = 64 * 1024;
export const maxResumeContextBytes = 32 * 1024;

export interface TaskEnvelopeRunIdentity {
  rootRunId: string;
  graphNodeInvocationId: string;
  actionNodeInvocationId: string;
  nodeRunId: string;
}
export interface TaskEnvelopeNodeIdentity { id: string; description: string; }
export interface TaskEnvelopeState { revision: number; value: JsonValue; sha256: string; }
export interface TaskEnvelopeResumeContext { question: string; context: string; response: string; }
export interface TaskEnvelopeHistoryEntry {
  sequence: number;
  nodeRunId: string;
  role: "work" | "validation";
  state: "completed" | "needs_input" | "blocked" | "failed";
  summary: string;
  stateRevision: number;
}
export interface TaskEnvelopeOutcomeCandidate { outcomeId: string; result: NodeResult; }

interface TaskEnvelopeBaseV9 {
  version: typeof taskEnvelopeVersion;
  run: TaskEnvelopeRunIdentity;
  role: "work" | "validation";
  task: string;
  state: TaskEnvelopeState;
  acceptanceLedger: AcceptanceLedgerSnapshotV1;
  resume?: TaskEnvelopeResumeContext;
  relevantHistory: TaskEnvelopeHistoryEntry[];
}

export interface WorkTaskEnvelopeV9 extends TaskEnvelopeBaseV9 {
  role: "work";
  graphNode: TaskEnvelopeNodeIdentity;
  actionNode: TaskEnvelopeNodeIdentity;
  workNode: TaskEnvelopeNodeIdentity;
  workAttempt: number;
  previousValidationFeedback?: { feedback: string; expectedCorrection: string };
}

export interface ValidationTaskEnvelopeV9 extends TaskEnvelopeBaseV9 {
  role: "validation";
  graphNode: TaskEnvelopeNodeIdentity;
  actionNode: TaskEnvelopeNodeIdentity;
  validationNode: TaskEnvelopeNodeIdentity;
  workAttempt: number;
  workOutcome: WorkNodeOutcome;
  allowedOutcomes: TaskEnvelopeOutcomeCandidate[];
  retriesRemaining: number;
}

export type TaskEnvelopeV9 = WorkTaskEnvelopeV9 | ValidationTaskEnvelopeV9;
