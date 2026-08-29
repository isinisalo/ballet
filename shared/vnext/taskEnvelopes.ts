import type { JsonValue } from "./primitives.js";
import { VNEXT_TASK_ENVELOPE_VERSION } from "./versions.js";

interface TaskEnvelopeBase {
  version: typeof VNEXT_TASK_ENVELOPE_VERSION;
  taskId: string;
  environmentRunId: string;
  snapshotSha256: string;
  instruction: string;
  context: JsonValue;
}

export interface ValidationPrecheckTaskEnvelope extends TaskEnvelopeBase {
  role: "validation";
  phase: "precheck";
  stateExecutionId: string;
  actionExecutionId: string;
  actionId: string;
  workAttempts: number;
  maxRetries: number;
}

export interface WorkTaskEnvelope extends TaskEnvelopeBase {
  role: "work";
  phase: "work";
  stateExecutionId: string;
  actionExecutionId: string;
  actionId: string;
  workAttempt: number;
  dynamicPrompt: string;
  previousValidationFeedback?: string;
}

export interface ValidationPostworkTaskEnvelope extends TaskEnvelopeBase {
  role: "validation";
  phase: "postwork";
  stateExecutionId: string;
  actionExecutionId: string;
  actionId: string;
  workAttempt: number;
  retriesRemaining: number;
  workOutcome: JsonValue;
}

export interface CriticTaskEnvelope extends TaskEnvelopeBase {
  role: "critic";
  phase: "proposal";
  criticRunId: string;
  scheduleId: string;
  productSnapshotIds: string[];
}

export interface RefinementTaskEnvelope extends TaskEnvelopeBase {
  role: "refinement";
  phase: "proposal";
  refinementRunId: string;
  approvedCriticProposalIds: string[];
  allowedPaths: string[];
  preimageHashes: Record<string, string>;
}

export type TaskEnvelopeV10 =
  | ValidationPrecheckTaskEnvelope
  | WorkTaskEnvelope
  | ValidationPostworkTaskEnvelope
  | CriticTaskEnvelope
  | RefinementTaskEnvelope;
