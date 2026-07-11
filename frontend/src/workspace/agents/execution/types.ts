import type { RuntimeProvider } from "../../runtimes/types";

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

export interface AgentExecutionBindingInput {
  runtimeBackendId: string;
  model: string;
  reasoning: string;
  policy: ExecutionPolicy;
}

export interface AgentExecutionFormValue extends AgentExecutionBindingInput {
  deviceId: string;
}

export type AgentRunStatus = "queued" | "claimed" | "preparing" | "running" | "succeeded" | "failed" | "cancelled";

export interface AgentOutcome {
  outcome: "ready" | "blocked" | "needs_input" | "approved" | "changes-requested" | "failed";
  summary: string;
  artifacts?: {
    git_sha?: string;
    changed_files?: string[];
    branch?: string;
    diff?: string;
    [key: string]: unknown;
  };
  checks: Array<{ name: string; status: "passed" | "failed" | "skipped"; details?: string }>;
}

export interface AgentRun {
  id: string;
  projectId: string;
  agentId: string;
  rootRunId: string;
  taskId: string;
  status: AgentRunStatus;
  input?: string;
  runtime: {
    deviceId: string;
    deviceName: string;
    runtimeBackendId: string;
    provider: RuntimeProvider;
    cliVersion: string;
    model: string;
    reasoning: string;
    policy: ExecutionPolicy;
    capabilityHash: string;
  };
  project: {
    checkoutId: string;
    repositoryUrl: string;
    headSha: string;
    configHash: string;
    snapshotHash: string;
  };
  outcome?: AgentOutcome;
  branch?: string;
  worktreePath?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type AgentExecutionMode = "edit" | "run";
