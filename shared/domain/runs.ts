import type { AgentRun, ExecutionTask, LoopRunDetails, RootFinalizationReport, RuntimePreflightIssue } from "./runtime.js";

export type BalletMode = "configure" | "run";

export type DashboardRunStatus =
  | "queued"
  | "running"
  | "waiting_for_human"
  | "finalizing"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled";

export type RootRunKind = "loop" | "agent";
export type RootRunSource = "manual" | "schedule";
export type RootRunListState = "active" | "recent";

export interface RootRunCurrentPosition {
  loopRunId?: string;
  loopId?: string;
  stepRunId?: string;
  stepId?: string;
  taskId?: string;
  agentId?: string;
  taskStatus?: ExecutionTask["status"];
}

export interface RootRunFinalization {
  status: "pending" | "reported";
  success: boolean;
  report?: RootFinalizationReport;
  authorizedAt: string;
  finalizedAt?: string;
}

export interface RootRunSummary {
  rootRunId: string;
  projectId: string;
  kind: RootRunKind;
  targetId: string;
  source: RootRunSource;
  status: DashboardRunStatus;
  current?: RootRunCurrentPosition;
  finalization?: RootRunFinalization;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RootRunDetail extends RootRunSummary {
  loopRuns: LoopRunDetails[];
  tasks: ExecutionTask[];
  agentRun?: AgentRun;
}

export interface RootRunListQuery {
  state?: RootRunListState;
  kind?: RootRunKind;
  cursor?: string;
  limit?: number;
}

export interface RootRunListResponse {
  items: RootRunSummary[];
  nextCursor?: string;
}

export interface RunTarget {
  kind: RootRunKind;
  id: string;
  name: string;
  description?: string;
  ready: boolean;
  issues: RunTargetIssue[];
  activeRootRunId?: string;
}

export interface RunTargetIssue {
  code: RuntimePreflightIssue["code"] | "invalid_config" | "disabled" | "missing_agent";
  message: string;
  agentId?: string;
  stepId?: string;
  path?: string;
}

export interface RunTargetsResponse {
  loops: RunTarget[];
  agents: RunTarget[];
}

export interface RunInvalidationEvent {
  id: number;
  type: "runs-invalidated";
  at: string;
  rootRunId?: string;
  reason?: string;
}
