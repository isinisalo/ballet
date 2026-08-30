import type { JsonValue } from "./primitives.js";
import type { AgentComposition, AgentDefinition, EnvironmentDefinition, RuntimeProvider } from "./environment.js";
import type { Constraint, DirectionReference, UseCase } from "./direction.js";
import { ROOT_SNAPSHOT_VERSION } from "./versions.js";

export type EnvironmentRunStatus = "pending" | "running" | "blocked" | "completed" | "cancelled" | "interrupted";
export type StateExecutionStatus = "pending" | "running" | "blocked" | "done" | "cancelled" | "interrupted";
export type ActionExecutionStatus = "pending" | "prechecking" | "working" | "postchecking" | "blocked" | "done" | "cancelled" | "interrupted";
export type AgentRunRole = "validation" | "work" | "critic" | "refinement";
export type AgentRunPhase = "precheck" | "work" | "postwork" | "proposal";
export type AgentRunStatus = "queued" | "running" | "waiting_for_input" | "completed" | "failed" | "cancelled" | "interrupted";

export type RuntimeBindingSubject =
  | { kind: "action_role"; actionId: string; role: "validation" | "work" }
  | { kind: "agent"; agentId: string };

export interface RootSnapshotV16 {
  version: typeof ROOT_SNAPSHOT_VERSION;
  projectHeadSha: string;
  projectConfigSha256: string;
  directionSha256: string;
  environmentSha256: string;
  resourceSha256: string;
  environment: EnvironmentDefinition;
  approvedUseCases: Array<{ useCase: UseCase; contentSha256: string }>;
  direction: {
    goals: Array<DirectionReference & { contentSha256: string }>;
    adrs: Array<DirectionReference & { contentSha256: string }>;
    constraints: Array<Constraint & { contentSha256: string }>;
  };
  agents: Array<AgentDefinition & { contentSha256: string }>;
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

export interface RuntimeCapabilitySnapshot {
  subject: RuntimeBindingSubject;
  provider: RuntimeProvider;
  model: string;
  reasoningEffort: string;
  networkAccess: boolean;
  readOnlyRoots: string[];
  cliVersion: string;
  supportedModels: string[];
  supportedReasoningEfforts: string[];
  supportsReadOnly: boolean;
  supportsWorkspaceWrite: boolean;
  capabilitySha256: string;
}

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
  networkAccess: boolean;
  approvalPolicy: "never";
}

export interface EnvironmentRun {
  id: string;
  environmentId: string;
  status: EnvironmentRunStatus;
  snapshot: RootSnapshotV16;
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
