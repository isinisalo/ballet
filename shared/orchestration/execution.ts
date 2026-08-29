import type { ExecutionProfile, RuntimeProvider } from "./environment.js";
import type { JsonValue } from "./primitives.js";
import type { AgentRunPhase, AgentRunRole } from "./runtime.js";
import {
  EXECUTION_SPEC_VERSION,
  PROMPT_COMPOSITION_VERSION,
  ROLE_OUTCOME_VERSION,
  TASK_ENVELOPE_VERSION
} from "./versions.js";

export interface ExecutionResourceEvidence {
  kind: "system" | "primary" | "skill";
  origin: "system" | "project";
  id: string;
  relativePath?: string;
  sourceSha256: string;
}

export interface ExecutionPromptEvidenceV11 {
  compositionVersion: typeof PROMPT_COMPOSITION_VERSION;
  role: AgentRunRole;
  phase: AgentRunPhase;
  executionProfile: ExecutionProfile;
  resources: ExecutionResourceEvidence[];
  prompt: string;
  promptSha256: string;
  taskEnvelopeVersion: typeof TASK_ENVELOPE_VERSION;
  taskEnvelopeSha256: string;
  outputSchemaVersion: typeof ROLE_OUTCOME_VERSION;
  outputSchemaId: "validation-outcome-v10" | "work-outcome-v10" | "critic-outcome-v10" | "refinement-outcome-v10";
  outputSchemaSha256: string;
}

export interface ExecutionRuntimeSnapshot {
  provider: RuntimeProvider;
  cliVersion: string;
  model: string;
  reasoningEffort: string;
  networkAccess: boolean;
  capabilityHash: string;
}

export interface ExecutionSpecV12 {
  version: typeof EXECUTION_SPEC_VERSION;
  taskId: string;
  kind: "agent_execution";
  environmentRunId: string;
  actionExecutionId?: string;
  agentRunId: string;
  evidence: ExecutionPromptEvidenceV11;
  runtime: ExecutionRuntimeSnapshot;
  project: { checkoutRoot: string; headSha: string; configHash: string; snapshotHash: string };
  input?: JsonValue;
  createdAt: string;
}
