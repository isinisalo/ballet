// Canonical persisted runtime contracts. Project authoring types live in their
// own domain modules; this file owns only resolved, immutable Run evidence.
import type { ProjectExecutableStep, ProjectLoop } from "./automation.js";
import type { LoopTheme } from "./loopThemes.js";
import type { ExecutionProfile } from "./projectConfig.js";
import type { ExecutionPolicy, RuntimeProvider } from "./localRuntime.js";

export type {
  ExecutionPolicy,
  LocalCheckoutStatus,
  LocalProviderHealth,
  LocalProviderStatus,
  LocalRuntime,
  ResolvedExecutionProfile,
  RuntimeAuthStatus,
  RuntimeCapabilities,
  RuntimeConfigurationIssue,
  RuntimeModelCapability,
  RuntimePolicyCapabilities,
  RuntimeProvider
} from "./localRuntime.js";

export type ExecutionTaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type ExecutionTaskKind = "loop_step";
export type StepOutcomeState = "completed" | "needs_input" | "blocked" | "failed";
export type StepRunResult = "approved" | "rejected";
export type RunCheckStatus = "passed" | "failed" | "skipped";

export interface RunCheck {
  name: string;
  status: RunCheckStatus;
  details?: string;
}

interface StepOutcomeBase {
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

export type StepOutcome = StepOutcomeBase & {
      state: "completed";
      result: StepRunResult;
      question?: never;
      context?: never;
    }
  | StepOutcomeBase & {
      state: "needs_input";
      question: string;
      context: string;
      result?: never;
    }
  | StepOutcomeBase & {
      state: "blocked" | "failed";
      result?: never;
      question?: never;
      context?: never;
    };

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

/** Content is stored once in the Root Run snapshot and never re-read while it runs. */
export interface ExecutionResourceSnapshot {
  kind: ExecutionResourceKind;
  origin: ExecutionResourceOrigin;
  id: string;
  relativePath?: string;
  sourceSha256: string;
  content: string;
}

export interface ExecutionRuntimeBinding {
  executionProfileId: string;
  runtime: ExecutionRuntimeSnapshot;
}

export interface RootExecutionSnapshot {
  version: 1;
  rootLoopId: string;
  project: ExecutionProjectSnapshot;
  loops: ProjectLoop[];
  theme: LoopTheme;
  executionProfiles: ExecutionProfile[];
  runtimes: ExecutionRuntimeBinding[];
  resources: ExecutionResourceSnapshot[];
  createdAt: string;
}

export type ExecutionResourceEvidence = Omit<ExecutionResourceSnapshot, "content">;

/** Attempt-specific evidence. The exact composed prompt is retained only here. */
export interface ExecutionPromptEvidence {
  compositionVersion: 1;
  loopId: string;
  stepId: string;
  executionProfile: ExecutionProfile;
  resources: ExecutionResourceEvidence[];
  prompt: string;
  promptSha256: string;
  outputSchemaVersion: 1;
  outputSchemaSha256: string;
}

export interface ExecutionSpec {
  version: 2;
  taskId: string;
  kind: ExecutionTaskKind;
  rootRunId: string;
  loopRunId: string;
  stepRunId: string;
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
  outcome?: StepOutcome;
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
  stepId?: string;
  executionProfileId?: string;
  code:
    | "auth_required"
    | "backend_unhealthy"
    | "model_unavailable"
    | "reasoning_unavailable"
    | "policy_unsupported"
    | "invalid_runtime_config"
    | "dirty_checkout"
    | "missing_resource"
    | "invalid_resource"
    | "prompt_too_large";
  message: string;
}

export interface LoopRuntimePreflight {
  ok: boolean;
  issues: RuntimePreflightIssue[];
  snapshots: Array<{
    stepId: string;
    executionProfileId: string;
    runtime: ExecutionRuntimeSnapshot;
  }>;
}

export type LoopRunSource = "manual" | "transition" | "schedule";
export type LoopRunStatus = "running" | "waiting_for_human" | "completed" | "blocked" | "failed" | "cancelled";
export type StepRunStatus = "queued" | "running" | "waiting_for_human" | "completed" | "needs_input" | "blocked" | "failed" | "cancelled";
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
  type: ProjectExecutableStep["type"];
  executionTaskId?: string;
  execution?: ExecutionRuntimeSnapshot;
  status: StepRunStatus;
  input?: string;
  responseInput?: string;
  result?: StepRunResult;
  outcome?: StepOutcome;
  error?: string;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LoopRunDetails extends LoopRun { stepRuns: StepRun[] }
export type RespondToStepRunRequest = { kind: "human"; result: StepRunResult; input: string } | { kind: "resume"; input: string };
