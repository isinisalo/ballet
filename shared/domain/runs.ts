import type { JsonValue } from "./automation.js";
import type {
  CanonicalNodeOutcome,
  ControlFlowEvent,
  ExecutionTask,
  GraphNodeInvocationDetails,
  GraphStateRevisionMetadata,
  NodeRunRole,
  RepairFrame,
  RepairRequest,
  RepairResult,
  RootExecutionSnapshot,
  RootFinalizationReport,
  RoutingDecision,
  RoutingRequest,
  RuntimePreflightIssue,
  ValidationNodeOutcome,
  WorkNodeOutcome
} from "./runtime.js";

export type BalletMode = "configure" | "run";
export type DashboardRunStatus = "queued" | "running" | "waiting_for_input" | "finalizing" | "completed" | "blocked" | "failed" | "cancelled";
export type RootRunKind = "graph" | "graph_node";
export type RootRunListState = "active" | "recent";

export interface RootRunCurrentPosition {
  graphNodeInvocationId?: string;
  graphNodeId?: string;
  jobNodeInvocationId?: string;
  jobNodeId?: string;
  nodeRunId?: string;
  nodeRole?: NodeRunRole;
  taskId?: string;
  executionProfileId?: string;
  taskStatus?: ExecutionTask["status"];
  workAttempt?: number;
  repairDepth?: number;
  lastWorkOutcome?: WorkNodeOutcome;
  lastValidationOutcome?: ValidationNodeOutcome;
  repairRequestId?: string;
}
export interface RootRunStateProjection {
  currentRevision: number;
  currentState?: JsonValue;
  currentStateSha256: string;
  revisions: GraphStateRevisionMetadata[];
  totalRevisionCount: number;
  historyTruncated: boolean;
}
export interface RootRunRepairProjection {
  requests: RepairRequest[];
  frames: RepairFrame[];
  results: RepairResult[];
  activeFrames: RepairFrame[];
  pendingRepair?: RepairRequest;
}
export interface RootRunOrchestrationProjection {
  requests: RoutingRequest[];
  decisions: RoutingDecision[];
  pendingRequest?: RoutingRequest;
  selectedDecision?: RoutingDecision;
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
  source: "manual";
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
  graphNodeInvocations: GraphNodeInvocationDetails[];
  tasks: ExecutionTask[];
  state: RootRunStateProjection;
  orchestration: RootRunOrchestrationProjection;
  repair: RootRunRepairProjection;
  controlFlowEvents: ControlFlowEvent[];
}
export interface RootRunListQuery { state?: RootRunListState; cursor?: string; limit?: number; }
export interface RootRunListResponse { items: RootRunSummary[]; nextCursor?: string; }
export interface StartRootRunRequest { kind: RootRunKind; targetId: string; input?: string; }
export type RespondToNodeRunRequest =
  | { kind: "work"; outcome: WorkNodeOutcome }
  | { kind: "validation"; outcome: ValidationNodeOutcome }
  | { kind: "resume"; response: string };
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
  code: RuntimePreflightIssue["code"] | "invalid_config";
  message: string;
  executionProfileId?: string;
  nodeId?: string;
  path?: string;
}
export interface RunTargetsResponse { graph: RunTarget; graphNodes: RunTarget[]; }
export type WorkspaceInvalidationEvent =
  | { id: number; type: "workspace-changed"; at: string; reason?: string }
  | { id: number; type: "runs-changed"; at: string; rootRunId: string; stateRevision: number; status: DashboardRunStatus };
export type WorkspaceInvalidationInput =
  | { type: "workspace-changed"; reason?: string }
  | { type: "runs-changed"; rootRunId: string; stateRevision: number; status: DashboardRunStatus };
