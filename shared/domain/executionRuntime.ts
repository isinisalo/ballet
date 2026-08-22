import type { JsonValue, ProjectGraph } from "./automation.js";
import type { CanvasTheme } from "./canvasTheme.js";
import type { ExecutionPolicy, RuntimeProvider } from "./localRuntime.js";
import type { ExecutionProfile, ProjectIssueTrackerConfig } from "./projectConfig.js";
import type { CanonicalNodeOutcome, NodeRunRole, OrchestrationScope } from "./runtime.js";

export type {
  ExecutionPolicy, LocalCheckoutStatus, LocalProviderHealth, LocalProviderStatus,
  LocalRuntime, ResolvedExecutionProfile, RuntimeAuthStatus, RuntimeCapabilities,
  RuntimeConfigurationIssue, RuntimeModelCapability, RuntimePolicyCapabilities, RuntimeProvider
} from "./localRuntime.js";

export interface ExecutionRuntimeSnapshot {
  hostname: string;
  provider: RuntimeProvider;
  cliVersion: string;
  model: string;
  reasoning: string;
  policy: ExecutionPolicy;
  capabilityHash: string;
}

export interface ExecutionProjectSnapshot {
  checkoutRoot: string;
  headSha: string;
  configHash: string;
  snapshotHash: string;
}

export type ExecutionResourceOrigin = "system" | "project";
export type ExecutionResourceKind = "system" | "primary" | "skill";
export interface ExecutionResourceSnapshot {
  kind: ExecutionResourceKind;
  origin: ExecutionResourceOrigin;
  id: string;
  relativePath?: string;
  sourceSha256: string;
  content: string;
}
export interface ExecutionRuntimeBinding { executionProfileId: string; runtime: ExecutionRuntimeSnapshot; }

export interface RootExecutionSnapshot {
  version: 7;
  rootKind: "graph" | "graph_node";
  rootGraphNodeId?: string;
  project: ExecutionProjectSnapshot;
  issueTracker: ProjectIssueTrackerConfig;
  graph: ProjectGraph;
  theme: CanvasTheme;
  executionProfiles: ExecutionProfile[];
  runtimes: ExecutionRuntimeBinding[];
  resources: ExecutionResourceSnapshot[];
  createdAt: string;
}

export type ExecutionResourceEvidence = Omit<ExecutionResourceSnapshot, "content">;
export interface ExecutionPromptEvidence {
  compositionVersion: 8;
  graphNodeId?: string;
  jobNodeId?: string;
  nodeRole: NodeRunRole;
  orchestrationScope?: OrchestrationScope;
  nodeDefinitionId: string;
  executionProfile: ExecutionProfile;
  resources: ExecutionResourceEvidence[];
  prompt: string;
  promptSha256: string;
  taskEnvelopeVersion: 7;
  taskEnvelopeSha256: string;
  outputSchemaVersion: 7;
  outputSchemaId:
    | "work-node-outcome-v7"
    | "validation-node-outcome-v7"
    | "orchestrator-node-outcome-v7"
    | "repair-node-outcome-v7";
  outputSchema: Record<string, JsonValue>;
  outputSchemaSha256: string;
}

export type ExecutionTaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type ExecutionTaskKind = "node_execution";
export interface ExecutionSpec {
  version: 9;
  taskId: string;
  kind: ExecutionTaskKind;
  rootRunId: string;
  graphNodeInvocationId?: string;
  jobNodeInvocationId?: string;
  nodeRunId: string;
  evidence: ExecutionPromptEvidence;
  runtime: ExecutionRuntimeSnapshot;
  project: ExecutionProjectSnapshot;
  createdAt: string;
}

export interface ExecutionTask {
  id: string;
  kind: ExecutionTaskKind;
  rootRunId: string;
  status: ExecutionTaskStatus;
  spec: ExecutionSpec;
  startedAt?: string;
  completedAt?: string;
  cancelRequestedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  outcome?: CanonicalNodeOutcome;
  createdAt: string;
  updatedAt: string;
}

export type ExecutionEventSource = "ballet" | RuntimeProvider;
export type ExecutionEventKind = "system" | "think" | "agent" | "command" | "output" | "file" | "tool" | "info" | "warn" | "error";
export type ExecutionEventPhase = "started" | "delta" | "completed";
export interface ExecutionEvent {
  id: number;
  taskId: string;
  sequence: number;
  source: ExecutionEventSource;
  kind: ExecutionEventKind;
  level: "info" | "warn" | "error";
  phase: ExecutionEventPhase;
  itemId?: string;
  message: string;
  data?: Record<string, unknown>;
  contentBytes: number;
  terminal: boolean;
  createdAt: string;
}
export interface ExecutionEventPage { entries: ExecutionEvent[]; lastId: number; hasMore: boolean; truncated: boolean; }
export interface RootFinalizationReport {
  success: boolean;
  retained: boolean;
  branch: string;
  worktreePath: string;
  commitSha?: string;
  changedFiles: string[];
  snapshotHash: string;
}
export interface RuntimePreflightIssue {
  nodeId?: string;
  nodeRole?: NodeRunRole;
  executionProfileId?: string;
  code: "auth_required" | "backend_unhealthy" | "model_unavailable" | "reasoning_unavailable"
    | "policy_unsupported" | "invalid_runtime_config" | "dirty_checkout" | "missing_resource"
    | "invalid_resource" | "prompt_too_large";
  message: string;
}
export interface GraphNodeRuntimePreflight {
  ok: boolean;
  issues: RuntimePreflightIssue[];
  snapshots: Array<{
    nodeId: string;
    nodeRole: NodeRunRole;
    executionProfileId: string;
    runtime: ExecutionRuntimeSnapshot;
  }>;
}
