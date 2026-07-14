// The canonical runtime contract intentionally stays in one module so frontend and
// backend cannot drift on persisted execution, provider, and Loop snapshot shapes.
import type { AgentAvatar } from "./agents.js";
import type { LoopSummaryStyle, ProjectLoop } from "./automation.js";
import type { LoopTheme } from "./loopThemes.js";

export type RuntimeProvider = "codex" | "copilot";
export type RuntimeAuthStatus = "ready" | "required" | "expired" | "unknown";
export type LocalProviderHealth =
  | "ready"
  | "probing"
  | "auth_required"
  | "unsupported_version"
  | "policy_unsupported"
  | "error";

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
  supportsStructuredOutput: boolean;
  policy: RuntimePolicyCapabilities;
  refreshedAt: string;
}

export interface LocalProviderStatus {
  provider: RuntimeProvider;
  command: string;
  installed: boolean;
  compatible: boolean;
  cliVersion?: string;
  authStatus: RuntimeAuthStatus;
  health: LocalProviderHealth;
  healthMessage?: string;
  capabilities: RuntimeCapabilities;
  busy: boolean;
  activeRunCount: number;
}

export interface LocalCheckoutStatus {
  path: string;
  headSha: string;
  configHash: string;
  dirty: boolean;
}

export interface LocalRuntime {
  instanceId: string;
  hostname: string;
  platform: "darwin";
  architecture: "arm64" | "x64";
  checkout: LocalCheckoutStatus;
  uptimeSeconds: number;
  startedAt: string;
  providers: LocalProviderStatus[];
  activeRunCount: number;
  logsPath: string;
}

export interface ExecutionPolicy {
  network: boolean;
  readOnlyRoots: string[];
}

export interface PortableAgentRuntimeIntent {
  provider: RuntimeProvider;
  model: string;
  reasoning: string;
  policy: Pick<ExecutionPolicy, "network">;
}

export interface ResolvedAgentExecution {
  agentId: string;
  provider: RuntimeProvider;
  model: string;
  reasoning: string;
  policy: ExecutionPolicy;
}

export interface RuntimeConfigurationIssue {
  code: "invalid_json" | "invalid_schema" | "missing_intent" | "orphan_intent" | "provider_unavailable";
  path: string;
  message: string;
  agentId?: string;
}

export interface AgentRuntimeConfiguration {
  intent?: PortableAgentRuntimeIntent;
  localPolicy: Pick<ExecutionPolicy, "readOnlyRoots">;
  resolved?: ResolvedAgentExecution;
  issues: RuntimeConfigurationIssue[];
}

export type ExecutionTaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
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
  avatar?: AgentAvatar;
  configHash: string;
}

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

export interface ExecutionSpec {
  version: 1;
  taskId: string;
  kind: ExecutionTaskKind;
  rootRunId: string;
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
  kind: ExecutionTaskKind;
  rootRunId: string;
  status: ExecutionTaskStatus;
  spec: ExecutionSpec;
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

export interface ExecutionEventPage {
  entries: ExecutionEvent[];
  lastId: number;
  hasMore: boolean;
  truncated: boolean;
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
    | "auth_required"
    | "backend_unhealthy"
    | "model_unavailable"
    | "reasoning_unavailable"
    | "policy_unsupported"
    | "invalid_runtime_config"
    | "dirty_checkout";
  message: string;
}

export interface LoopRuntimePreflight {
  ok: boolean;
  issues: RuntimePreflightIssue[];
  snapshots: Array<{ stepId: string; agentId: string; runtime: ExecutionRuntimeSnapshot }>;
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
  project: ExecutionProjectSnapshot;
  steps: LoopExecutionStepSnapshot[];
  createdAt: string;
}

export type LoopRunSource = "manual" | "human" | "schedule";
export type LoopRunStatus = "running" | "waiting_for_human" | "completed" | "blocked" | "failed" | "cancelled";
export type StepRunStatus = "queued" | "running" | "waiting_for_human" | "completed" | "failed" | "cancelled";
export type StepRunResult = "approved" | "rejected";
export type LoopScheduleOccurrenceStatus = "started" | "skipped" | "missed";

export interface LoopScheduleOccurrence { stepId: string; scheduledFor: string }

export interface LoopScheduleState {
  loopId: string;
  stepId: string;
  nextRunAt?: string;
  lastScheduledAt?: string;
  lastStatus?: LoopScheduleOccurrenceStatus;
  lastRunId?: string;
  lastError?: string;
}

export interface LoopSummaryStyleSnapshot {
  loopId: string;
  summaryStyle: LoopSummaryStyle;
}

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
  themeSnapshot: LoopTheme;
  loopSummarySnapshots?: LoopSummaryStyleSnapshot[];
  executionPlan?: LoopExecutionPlan;
  schedule?: LoopScheduleOccurrence;
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

export interface LoopRunDetails extends LoopRun { stepRuns: StepRun[] }
export interface RespondToStepRunRequest { result: StepRunResult; input: string }
