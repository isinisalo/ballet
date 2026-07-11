import type { ProjectLoop } from "./automation.js";
import type { MarkdownBackedEntity } from "./documents.js";

export type RuntimeType = "codex-cli" | "custom";
export type AgentOutcomeStatus = "ready" | "blocked" | "needs_input" | "approved" | "changes-requested" | "failed";
export type RunCheckStatus = "passed" | "failed" | "skipped";
export type LoopRunSource = "manual" | "human" | "schedule";
export type LoopRunStatus = "running" | "waiting_for_human" | "completed" | "blocked" | "failed" | "cancelled";
export type StepRunStatus = "queued" | "running" | "waiting_for_human" | "completed" | "failed" | "cancelled";
export type StepRunResult = "approved" | "rejected";

export interface ProjectRuntime {
  id: string;
  title: string;
  command: string;
  args: string[];
}

export interface Runtime extends MarkdownBackedEntity {
  id: string;
  name: string;
  type: RuntimeType;
  command: string;
  config: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

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
    [key: string]: unknown;
  };
  checks: RunCheck[];
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
  status: StepRunStatus;
  input?: string;
  responseInput?: string;
  result?: StepRunResult;
  outcome?: AgentOutcome;
  error?: string;
  attempt: number;
  leaseOwner?: string;
  leaseUntil?: string;
  threadId?: string;
  turnId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LoopRunDetails extends LoopRun {
  stepRuns: StepRun[];
}

export type StepRunConsoleKind =
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

export type StepRunConsolePhase = "started" | "delta" | "completed";

export interface StepRunConsoleEntry {
  id: number;
  stepRunId: string;
  source: "ballet" | "codex";
  kind: StepRunConsoleKind;
  level: "info" | "warn" | "error";
  phase: StepRunConsolePhase;
  itemId?: string;
  message: string;
  data?: Record<string, unknown>;
  contentBytes: number;
  terminal: boolean;
  createdAt: string;
}

export type StepRunLog = StepRunConsoleEntry;

export interface StepRunConsolePage {
  entries: StepRunConsoleEntry[];
  lastId: number;
  hasMore: boolean;
  truncated: boolean;
}

export interface StartLoopRunRequest {
  input?: string;
}

export interface RespondToStepRunRequest {
  result: StepRunResult;
  input: string;
}
