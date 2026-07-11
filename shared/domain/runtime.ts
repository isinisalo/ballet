import type { ProjectLoop } from "./automation.js";

export type RuntimeProvider = "codex" | "copilot";
export type RuntimeDeviceStatus = "online" | "offline";
export type RuntimeAuthStatus = "ready" | "required" | "expired" | "unknown";
export type RuntimeBackendHealth =
  | "ready"
  | "probing"
  | "auth_required"
  | "unsupported_version"
  | "policy_unsupported"
  | "error"
  | "offline";

export interface RuntimeModelCapability {
  id: string;
  label: string;
  reasoningOptions: string[];
  defaultReasoning?: string;
}

export interface RuntimePolicyCapabilities {
  workspaceWrite: boolean;
  networkControl: boolean;
  readOnlyRoots: boolean;
}

export interface RuntimeCapabilities {
  models: RuntimeModelCapability[];
  supportsResume: boolean;
  supportsStructuredOutput: boolean;
  policy: RuntimePolicyCapabilities;
  refreshedAt: string;
}

export interface RuntimeBackend {
  id: string;
  projectId: string;
  deviceId: string;
  provider: RuntimeProvider;
  cliVersion?: string;
  executablePath?: string;
  authStatus: RuntimeAuthStatus;
  health: RuntimeBackendHealth;
  healthMessage?: string;
  capabilities: RuntimeCapabilities;
  assignedAgentCount: number;
  activeRunCount: number;
  busy: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCheckout {
  id: string;
  projectId: string;
  deviceId: string;
  repositoryUrl: string;
  path: string;
  headSha?: string;
  configHash?: string;
  dirty: boolean;
  lastInspectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeDeviceDiagnostics {
  daemonId: string;
  daemonVersion: string;
  uptimeSeconds: number;
  lastSeenAt: string;
  connectedAt?: string;
  restartRequestedAt?: string;
  recentError?: string;
}

export interface RuntimeDevice {
  id: string;
  projectId: string;
  hostname: string;
  displayName: string;
  platform: "darwin";
  architecture: "arm64" | "x64";
  status: RuntimeDeviceStatus;
  diagnostics: RuntimeDeviceDiagnostics;
  backends: RuntimeBackend[];
  checkout?: ProjectCheckout;
  activeRunCount: number;
  busyBackendCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionPolicy {
  network: boolean;
  readOnlyRoots: string[];
}

export interface AgentExecutionBinding {
  id: string;
  projectId: string;
  agentId: string;
  runtimeBackendId: string;
  deviceId: string;
  provider: RuntimeProvider;
  model: string;
  reasoning: string;
  policy: ExecutionPolicy;
  createdAt: string;
  updatedAt: string;
}

export type ExecutionTaskStatus =
  | "queued"
  | "claimed"
  | "preparing"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";
export type ExecutionTaskKind = "agent_run" | "loop_step";
export type AgentOutcomeStatus = "ready" | "blocked" | "needs_input" | "approved" | "changes-requested" | "failed";
export type RunCheckStatus = "passed" | "failed" | "skipped";

export interface RunCheck {
  name: string;
  status: RunCheckStatus;
  details?: string;
}

export interface AgentOutcome {
  outcome: AgentOutcomeStatus;
  summary: string;
  artifacts?: {
    git_sha?: string;
    changed_files?: string[];
    branch?: string;
    diff?: string;
    [key: string]: unknown;
  };
  checks: RunCheck[];
}

export interface ExecutionAgentSnapshot {
  id: string;
  name: string;
  description: string;
  instructions: string;
  skillIds: string[];
  configHash: string;
}

export interface ExecutionRuntimeSnapshot {
  deviceId: string;
  deviceName: string;
  runtimeBackendId: string;
  provider: RuntimeProvider;
  cliVersion: string;
  model: string;
  reasoning: string;
  policy: ExecutionPolicy;
  capabilityHash: string;
}

export interface ExecutionProjectSnapshot {
  checkoutId: string;
  repositoryUrl: string;
  headSha: string;
  configHash: string;
  snapshotHash: string;
}

export interface ExecutionSpec {
  version: 1;
  projectId: string;
  taskId: string;
  kind: ExecutionTaskKind;
  rootRunId: string;
  agentRunId?: string;
  loopRunId?: string;
  stepRunId?: string;
  input?: string;
  agent: ExecutionAgentSnapshot;
  runtime: ExecutionRuntimeSnapshot;
  project: ExecutionProjectSnapshot;
  createdAt: string;
}

export interface ExecutionTask {
  id: string;
  projectId: string;
  runtimeBackendId: string;
  deviceId: string;
  kind: ExecutionTaskKind;
  rootRunId: string;
  status: ExecutionTaskStatus;
  spec: ExecutionSpec;
  fencing: number;
  leaseUntil?: string;
  claimedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelRequestedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  outcome?: AgentOutcome;
  createdAt: string;
  updatedAt: string;
}

export type ExecutionEventSource = "ballet" | RuntimeProvider;
export type ExecutionEventKind =
  | "system"
  | "think"
  | "agent"
  | "command"
  | "output"
  | "file"
  | "tool"
  | "info"
  | "warn"
  | "error";
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

export interface ExecutionEventPage {
  entries: ExecutionEvent[];
  lastId: number;
  hasMore: boolean;
  truncated: boolean;
}

export interface AgentRun {
  id: string;
  projectId: string;
  agentId: string;
  rootRunId: string;
  taskId: string;
  status: ExecutionTaskStatus;
  input?: string;
  runtime: ExecutionRuntimeSnapshot;
  project: ExecutionProjectSnapshot;
  outcome?: AgentOutcome;
  branch?: string;
  worktreePath?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RootRunDisposition {
  terminal: boolean;
  success: boolean;
}

export interface TaskDispositionResult {
  rootDisposition?: RootRunDisposition;
}

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
  agentId: string;
  stepId?: string;
  code:
    | "unbound"
    | "offline"
    | "auth_required"
    | "backend_unhealthy"
    | "model_unavailable"
    | "reasoning_unavailable"
    | "policy_unsupported"
    | "mixed_device"
    | "dirty_checkout";
  message: string;
}

export interface LoopRuntimePreflight {
  ok: boolean;
  deviceId?: string;
  issues: RuntimePreflightIssue[];
  snapshots: Array<{
    stepId: string;
    agentId: string;
    runtime: ExecutionRuntimeSnapshot;
  }>;
}

export interface LoopExecutionStepSnapshot {
  loopId: string;
  stepId: string;
  agentId: string;
  agent: ExecutionAgentSnapshot;
  runtime: ExecutionRuntimeSnapshot;
}

export interface LoopExecutionPlan {
  version: 1;
  rootLoopId: string;
  deviceId: string;
  project: ExecutionProjectSnapshot;
  steps: LoopExecutionStepSnapshot[];
  createdAt: string;
}

export type LoopRunSource = "manual" | "human" | "schedule";
export type LoopRunStatus = "running" | "waiting_for_human" | "completed" | "blocked" | "failed" | "cancelled";
export type StepRunStatus = "queued" | "running" | "waiting_for_human" | "completed" | "failed" | "cancelled";
export type StepRunResult = "approved" | "rejected";

export interface LoopRun {
  runId: string;
  loopId: string;
  rootRunId: string;
  parentRunId?: string;
  parentStepRunId?: string;
  source: LoopRunSource;
  status: LoopRunStatus;
  input?: string;
  snapshot: ProjectLoop;
  runtimeDeviceId?: string;
  executionPlan?: LoopExecutionPlan;
  transitionCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface StepRun {
  stepRunId: string;
  runId: string;
  loopId: string;
  stepId: string;
  type: "agent" | "human";
  agentId?: string;
  executionTaskId?: string;
  execution?: ExecutionRuntimeSnapshot;
  status: StepRunStatus;
  input?: string;
  responseInput?: string;
  result?: StepRunResult;
  outcome?: AgentOutcome;
  error?: string;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LoopRunDetails extends LoopRun {
  stepRuns: StepRun[];
}

export interface StartLoopRunRequest {
  input?: string;
}

export interface RespondToStepRunRequest {
  result: StepRunResult;
  input: string;
}

export interface StartAgentRunRequest {
  input?: string;
}

export interface PairingSession {
  id: string;
  deviceCode: string;
  userCode: string;
  status: "pending" | "approved" | "claimed" | "expired" | "revoked";
  expiresAt: string;
  approvedAt?: string;
  claimedAt?: string;
}
