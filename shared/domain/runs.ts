import type {
  AgentOutcome,
  ExecutionTask,
  LoopRunDetails,
  LoopRunTermination,
  RootFinalizationReport,
  RuntimePreflightIssue
} from "./runtime.js";

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
  status: "finalizing" | "completed" | "failed";
  success: boolean;
  report?: RootFinalizationReport;
  startedAt: string;
  completedAt?: string;
}

export interface RootRunSummary {
  rootRunId: string;
  kind: RootRunKind;
  targetId: string;
  source: RootRunSource;
  status: DashboardRunStatus;
  input?: string;
  outcome?: AgentOutcome;
  termination?: LoopRunTermination;
  errorCode?: string;
  errorMessage?: string;
  current?: RootRunCurrentPosition;
  finalization?: RootRunFinalization;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RootRunDetail extends RootRunSummary {
  loopRuns: LoopRunDetails[];
  tasks: ExecutionTask[];
}

export interface RootRunListQuery {
  state?: RootRunListState;
  kind?: RootRunKind;
  cursor?: string;
  limit?: number;
}

export interface RootRunListResponse { items: RootRunSummary[]; nextCursor?: string }

export interface StartRootRunRequest {
  kind: RootRunKind;
  targetId: string;
  input?: string;
}

export interface RunTarget {
  kind: RootRunKind;
  id: string;
  name: string;
  description?: string;
  ready: boolean;
  issues: RunTargetIssue[];
  activeRootRunId?: string;
  latestRootRunId?: string;
}

export interface RunTargetIssue {
  code: RuntimePreflightIssue["code"] | "invalid_config" | "disabled" | "missing_agent";
  message: string;
  agentId?: string;
  stepId?: string;
  path?: string;
}

export interface RunTargetsResponse { loops: RunTarget[]; agents: RunTarget[] }

export interface WorkspaceInvalidationEvent {
  id: number;
  type: "workspace-changed" | "runs-changed";
  at: string;
  rootRunId?: string;
  reason?: string;
}
