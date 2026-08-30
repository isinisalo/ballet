import type { JsonValue } from "./primitives.js";
import type { ActionAgentDefinition, AgentComposition, EnvironmentDefinition, GovernanceAgentDefinition, RuntimeProvider } from "./environment.js";
import type { Constraint, DirectionReference } from "./direction.js";
import { ROOT_SNAPSHOT_VERSION } from "./versions.js";

export type EnvironmentRunStatus = "pending" | "running" | "blocked" | "completed" | "cancelled" | "interrupted";
export type StateExecutionStatus = "pending" | "running" | "blocked" | "done" | "cancelled" | "interrupted";
export type ActionExecutionStatus = "pending" | "prechecking" | "working" | "postchecking" | "blocked" | "done" | "cancelled" | "interrupted";
export type AgentRunRole = "validation" | "work" | "critic" | "refinement";
export type AgentRunPhase = "precheck" | "work" | "postwork" | "proposal";
export type AgentRunStatus = "queued" | "running" | "waiting_for_input" | "completed" | "failed" | "cancelled" | "interrupted";

export type RuntimeBindingSubject =
  | { kind: "action_agent"; actionId: string; role: "validation" | "work"; agentId: string }
  | { kind: "agent"; agentId: string };

export interface RootSnapshotV20 {
  version: typeof ROOT_SNAPSHOT_VERSION;
  projectHeadSha: string;
  projectConfigSha256: string;
  directionSha256: string;
  environmentSha256: string;
  resourceSha256: string;
  environment: EnvironmentDefinition;
  direction: {
    goals: Array<DirectionReference & { contentSha256: string }>;
    adrs: Array<DirectionReference & { contentSha256: string }>;
    constraints: Array<Constraint & { contentSha256: string }>;
  };
  agents: Array<GovernanceAgentDefinition & { contentSha256: string }>;
  actionAgents: Array<ActionAgentDefinition & { contentSha256: string }>;
  runtimeCapabilities: RuntimeCapabilitySnapshot[];
  resources: RuntimeResourceSnapshot[];
  permissions: RuntimePermissionSnapshot[];
  governance: { critic: AgentComposition; refinement: AgentComposition };
  lineage?: {
    parentRootRunId: string;
    refinementProposalId: string;
    refinementApprovalId: string;
    refinementCommitSha: string;
  };
  createdAt: string;
}

interface RuntimeCapabilityBase {
  provider: RuntimeProvider;
  cliVersion: string;
  supportsReadOnly: boolean;
  supportsWorkspaceWrite: boolean;
  capabilitySha256: string;
}

export interface RuntimeAgentCapabilitySnapshot extends RuntimeCapabilityBase {
  subject: { kind: "agent"; agentId: string };
  model: string;
  reasoningEffort: string;
  supportedModels: string[];
  supportedReasoningEfforts: string[];
}

export interface RuntimeRoleModelCapabilitySnapshot {
  agentId: string;
  model: string;
  reasoningEffort: string;
  supportedModels: string[];
  supportedReasoningEfforts: string[];
}

export interface RuntimeActionCapabilitySnapshot extends RuntimeCapabilityBase {
  subject: { kind: "action"; actionId: string };
  roles: {
    validation: RuntimeRoleModelCapabilitySnapshot;
    work: RuntimeRoleModelCapabilitySnapshot;
  };
}

export type RuntimeCapabilitySnapshot = RuntimeAgentCapabilitySnapshot | RuntimeActionCapabilitySnapshot;

export interface RuntimeResourceSnapshot {
  kind: "instruction" | "skill";
  id: string;
  relativePath: string;
  content: string;
  sourceSha256: string;
}

export interface RuntimePermissionSnapshot {
  role: AgentRunRole;
  actionId?: string;
  toolPolicy: "read_only" | "workspace_write";
  approvalPolicy: "never";
}

export interface EnvironmentRun {
  id: string;
  environmentId: string;
  status: EnvironmentRunStatus;
  snapshot: RootSnapshotV20;
  continuationOfRunId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface StateExecution {
  id: string;
  environmentRunId: string;
  stateId: string;
  order: number;
  status: StateExecutionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ActionExecution {
  id: string;
  stateExecutionId: string;
  actionId: string;
  priority: number;
  status: ActionExecutionStatus;
  workAttempts: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  actionExecutionId?: string;
  environmentRunId: string;
  role: AgentRunRole;
  phase: AgentRunPhase;
  parentAgentRunId?: string;
  status: AgentRunStatus;
  attempt: number;
  outcome?: JsonValue;
  createdAt: string;
  updatedAt: string;
}

export interface RunEvidence {
  version: 1;
  id: string;
  environmentRunId: string;
  commitSha: string;
  changedFiles: string[];
  artifactRefs: string[];
  validationEvidenceRefs: string[];
  lineage: { sourceRunId?: string; continuationRunId?: string };
  createdAt: string;
}

export interface ContinuationRun {
  sourceRunId: string;
  continuationRunId: string;
  refinementApplyId: string;
  sourceSnapshotSha256: string;
  continuationSnapshotSha256: string;
  createdAt: string;
}

export type ControlFlowEventKind =
  | "environment_started"
  | "state_activated"
  | "action_selected"
  | "action_imported"
  | "validation_precheck_dispatched"
  | "validation_precheck_done"
  | "work_dispatched"
  | "work_waiting_for_input"
  | "work_resumed"
  | "work_completed"
  | "validation_postwork_dispatched"
  | "validation_done"
  | "validation_retry"
  | "action_blocked"
  | "feedback_created"
  | "state_completed"
  | "environment_completed"
  | "environment_blocked"
  | "environment_cancelled"
  | "execution_interrupted"
  | "continuation_created";

export interface ControlFlowEvent {
  id: string;
  environmentRunId: string;
  actionExecutionId?: string;
  sequence: number;
  kind: ControlFlowEventKind;
  data?: JsonValue;
  createdAt: string;
}
