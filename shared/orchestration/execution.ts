import type { ActionAgentDefinition, GovernanceAgentDefinition, RuntimeProvider } from "./environment.js";
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

export type ExecutionPromptSubject =
  | { kind: "action_agent"; actionId: string; role: "validation" | "work"; agent: ActionAgentDefinition & { contentSha256: string } }
  | { kind: "agent"; agent: GovernanceAgentDefinition & { contentSha256: string } };

export interface ExecutionPromptEvidenceV16 {
  compositionVersion: typeof PROMPT_COMPOSITION_VERSION;
  role: AgentRunRole;
  phase: AgentRunPhase;
  subject: ExecutionPromptSubject;
  resources: ExecutionResourceEvidence[];
  prompt: string;
  promptSha256: string;
  taskEnvelopeVersion: typeof TASK_ENVELOPE_VERSION;
  taskEnvelopeSha256: string;
  outputSchemaVersion: typeof ROLE_OUTCOME_VERSION;
  outputSchemaId: "validation-outcome-v11" | "work-outcome-v11" | "critic-outcome-v11" | "refinement-outcome-v11";
  outputSchemaSha256: string;
}

export interface ExecutionRuntimeSnapshot {
  subject: import("./runtime.js").RuntimeBindingSubject;
  provider: RuntimeProvider;
  cliVersion: string;
  model: string;
  reasoningEffort: string;
  capabilityHash: string;
}

export interface ExecutionSpecV18 {
  version: typeof EXECUTION_SPEC_VERSION;
  taskId: string;
  kind: "agent_execution";
  environmentRunId: string;
  actionExecutionId?: string;
  agentRunId: string;
  evidence: ExecutionPromptEvidenceV16;
  runtime: ExecutionRuntimeSnapshot;
  permissions: {
    workspaceAccess: "read-only" | "workspace-write";
    approvalPolicy: "never";
  };
  project: { checkoutRoot: string; headSha: string; configHash: string; snapshotHash: string };
  input?: JsonValue;
  createdAt: string;
}
