import type { JsonValue } from "./primitives.js";
import type { AgentRunPhase, AgentRunRole, RootSnapshotV21 } from "./runtime.js";

export interface StoredEnvironmentRun {
  environmentRunId: string;
  environmentDefinitionId: string;
  source: "manual" | "continuation";
  previousRunId?: string;
  input?: string;
  status: "pending" | "running" | "blocked" | "completed" | "cancelled" | "interrupted";
  revision: number;
  baseCommit: string;
  resultCommit?: string;
  worktreePath: string;
  branch: string;
  executionSnapshot: RootSnapshotV21;
  executionSnapshotHash: string;
  activeStateExecutionId?: string;
  activeActionExecutionId?: string;
  activeAgentRunId?: string;
  transitionCount: number;
  transitionLimit: number;
  finalizationStatus?: "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface StoredStateExecution {
  stateExecutionId: string;
  environmentRunId: string;
  stateDefinitionId: string;
  order: number;
  definitionSnapshot: JsonValue;
  definitionSnapshotHash: string;
  status: "pending" | "running" | "blocked" | "done" | "cancelled" | "interrupted";
  revision: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface StoredActionExecution {
  actionExecutionId: string;
  stateExecutionId: string;
  environmentRunId: string;
  actionDefinitionId: string;
  priority: number;
  definitionSnapshot: JsonValue;
  definitionSnapshotHash: string;
  status: "pending" | "prechecking" | "working" | "postchecking" | "blocked" | "done" | "cancelled" | "interrupted";
  revision: number;
  workAttempt: number;
  maxRetries: number;
  activeAgentRunId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface StoredAgentRun {
  agentRunId: string;
  environmentRunId: string;
  actionExecutionId?: string;
  criticRunId?: string;
  refinementRunId?: string;
  parentAgentRunId?: string;
  role: AgentRunRole;
  phase: AgentRunPhase;
  status: "queued" | "running" | "waiting_for_input" | "completed" | "failed" | "cancelled" | "interrupted";
  revision: number;
  attempt: number;
  providerOutcomeKey?: string;
  outcome?: JsonValue;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
