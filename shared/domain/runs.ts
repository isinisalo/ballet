import type {
  ControlFlowEvent,
  ExecutionTask,
  LoopRunDetails,
  LoopStateRevisionMetadata,
  OrchestrationFrame,
  OrchestrationRequest,
  OrchestratorRoute,
  RepairRequest,
  RepairResult,
  RootExecutionSnapshot,
  RootFinalizationReport,
  RuntimePreflightIssue,
  CanonicalNodeOutcome,
  NodeRunRole,
  ValidationNodeOutcome,
  WorkNodeOutcome
} from "./runtime.js";
import type { JsonValue } from "./automation.js";

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
  loopDescription?: string;
  workLoopNodeDescription?: string;
  localRetryAttempt?: number;
  repairDepth?: number;
  lastWorkOutcome?: WorkNodeOutcome;
  lastValidationDecision?: "OK" | "FAIL";
  repairRequestId?: string;
  routedTargetLoopId?: string;
  returnDestination?: RootRunReturnDestination;
}

export interface RootRunReturnDestination {
  loopId: string;
  workLoopNodeId: string;
  validationNodeDefinitionId: string;
}

export interface RootRunStateProjection {
  currentRevision: number;
  currentState?: JsonValue;
  currentStateSha256: string;
  revisions: LoopStateRevisionMetadata[];
  totalRevisionCount: number;
  historyTruncated: boolean;
}

export interface RootRunRepairProjection {
  requests: RepairRequest[];
  routes: OrchestratorRoute[];
  continuations: OrchestrationFrame[];
  results: RepairResult[];
  activeContinuationChain: OrchestrationFrame[];
  pendingRepair?: RepairRequest;
  routedTarget?: OrchestratorRoute;
  returnDestination?: RootRunReturnDestination;
}

export interface RootRunOrchestrationProjection {
  requests: OrchestrationRequest[];
  routes: OrchestratorRoute[];
  pendingRequest?: OrchestrationRequest;
  selectedRoute?: OrchestratorRoute;
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
  state: RootRunStateProjection;
  orchestration: RootRunOrchestrationProjection;
  repair: RootRunRepairProjection;
  controlFlowEvents: ControlFlowEvent[];
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

export type RespondToNodeRunRequest =
  | { kind: "work"; outcome: WorkNodeOutcome }
  | { kind: "validation"; outcome: ValidationNodeOutcome }
  | { kind: "resume"; response: string };

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

export type WorkspaceInvalidationEvent =
  | { id: number; type: "workspace-changed"; at: string; reason?: string }
  | {
      id: number;
      type: "runs-changed";
      at: string;
      rootRunId: string;
      stateRevision: number;
      status: DashboardRunStatus;
    };

export type WorkspaceInvalidationInput =
  | { type: "workspace-changed"; reason?: string }
  | {
      type: "runs-changed";
      rootRunId: string;
      stateRevision: number;
      status: DashboardRunStatus;
    };
