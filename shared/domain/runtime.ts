import type { MarkdownBackedEntity } from "./documents.js";

export type RuntimeType = "codex-cli" | "custom";
export type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "blocked" | "needs_input" | "cancelled";
export type AgentOutputEventStatus = string;
export type AgentOutcomeStatus = "ready" | "blocked" | "needs_input" | "approved" | "changes_requested" | "failed";
export type RunCheckStatus = "passed" | "failed" | "skipped";

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

export interface AgentRunOutput {
  agent?: string;
  runId?: string;
  status: AgentOutputEventStatus;
  outcome?: AgentOutcomeStatus;
  summary?: string;
  triggerEventId?: string;
  policyId?: string;
  policyVersion?: number;
  payload?: Record<string, unknown>;
  raw?: unknown;
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

export interface AgentRun {
  runId: string;
  triggerEventId: string;
  triggerEventSeq?: number;
  policyId: string;
  policyVersion: number;
  agentRole: string;
  status: AgentRunStatus;
  attempt: number;
  leaseOwner?: string;
  leaseUntil?: string;
  threadId?: string;
  turnId?: string;
  outcome?: AgentOutcome;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AgentRunLog {
  id: number;
  runId: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
}
