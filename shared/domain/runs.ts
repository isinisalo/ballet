import type {
  ExecutionTask,
  LoopRunDetails,
  RootExecutionSnapshot,
  RootFinalizationReport,
  RuntimePreflightIssue,
  CanonicalNodeOutcome,
  NodeRunRole
} from "./runtime.js";

export type BalletMode = "configure" | "run";
export type DashboardRunStatus =
  | "queued"
  | "running"
  | "waiting_for_input"
  | "finalizing"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled";
export type RootRunKind = "loop";
export type RootRunSource = "manual" | "schedule";
export type RootRunListState = "active" | "recent";

export interface RootRunCurrentPosition {
  loopRunId?: string;
  loopId?: string;
  workLoopNodeRunId?: string;
  workLoopNodeId?: string;
  nodeRunId?: string;
  nodeRole?: NodeRunRole;
  taskId?: string;
  executionProfileId?: string;
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
  stateRevision: number;
  input?: string;
  outcome?: CanonicalNodeOutcome;
  errorCode?: string;
  errorMessage?: string;
  current?: RootRunCurrentPosition;
  finalization?: RootRunFinalization;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RootRunDetail extends RootRunSummary {
  executionSnapshot: RootExecutionSnapshot;
  loopRuns: LoopRunDetails[];
  tasks: ExecutionTask[];
}

export interface RootRunListQuery {
  state?: RootRunListState;
  cursor?: string;
  limit?: number;
}

export interface RootRunListResponse { items: RootRunSummary[]; nextCursor?: string }

export interface StartRootRunRequest {
  kind: "loop";
  targetId: string;
  input?: string;
}

export interface RunTarget {
  kind: "loop";
  id: string;
  name: string;
  description?: string;
  ready: boolean;
  issues: RunTargetIssue[];
  activeRootRunId?: string;
  latestRootRunId?: string;
}

export interface RunTargetIssue {
  code: RuntimePreflightIssue["code"] | "invalid_config";
  message: string;
  executionProfileId?: string;
  nodeId?: string;
  path?: string;
}

export interface RunTargetsResponse { loops: RunTarget[] }

export interface WorkspaceInvalidationEvent {
  id: number;
  type: "workspace-changed" | "runs-changed";
  at: string;
  rootRunId?: string;
  reason?: string;
}
