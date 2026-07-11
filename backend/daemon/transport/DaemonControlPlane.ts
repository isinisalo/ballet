import type { AgentOutcome, ExecutionTask, RuntimeProvider } from "../../../shared/domain/runtime.js";

export interface DaemonBackendReport {
  id: string;
  provider: RuntimeProvider;
  cliVersion?: string;
  executablePath?: string;
  authStatus: "ready" | "required" | "expired" | "unknown";
  health: "ready" | "probing" | "auth_required" | "unsupported_version" | "policy_unsupported" | "error" | "offline";
  healthMessage?: string;
  capabilities: {
    models: Array<{ id: string; label: string; reasoningOptions: string[]; defaultReasoning?: string }>;
    supportsResume: boolean;
    supportsStructuredOutput: boolean;
    policy: { workspaceWrite: boolean; networkControl: boolean; readOnlyRoots: boolean };
    refreshedAt: string;
  };
}

export interface DaemonHeartbeatPayload {
  daemonVersion: string;
  uptimeSeconds: number;
  backends: DaemonBackendReport[];
  checkout?: {
    repositoryUrl: string;
    path: string;
    headSha?: string;
    configHash?: string;
    dirty: boolean;
    inspectionId?: string;
    lastInspectedAt?: string;
  };
  recentError?: string;
}

export interface DaemonHeartbeatResult {
  refreshRequested?: boolean;
  refreshRequestId?: string;
  restartRequested?: boolean;
  rootFinalizations?: RootFinalizationRequest[];
}

export interface RootFinalizationRequest {
  projectId: string;
  rootRunId: string;
  success: boolean;
}

export interface ClaimedExecutionTask {
  task: ExecutionTask;
  taskToken: string;
  leaseDurationMs: number;
  renewAfterMs: number;
}

export interface LeaseResult {
  accepted: boolean;
  leaseUntil?: string;
  cancelRequested?: boolean;
}

export interface RuntimeEventUpload {
  sequence: number;
  source: "ballet" | RuntimeProvider;
  kind: "system" | "think" | "agent" | "command" | "output" | "file" | "tool" | "info" | "warn" | "error";
  level: "info" | "warn" | "error";
  phase: "started" | "delta" | "completed";
  itemId?: string;
  message: string;
  data?: Record<string, unknown>;
  terminal: boolean;
  createdAt: string;
}

export interface TaskCompletion {
  outcome: AgentOutcome;
  branch?: string;
  worktreePath?: string;
}

export interface TaskFailure {
  errorCode: "runtime_lost" | "invalid_outcome" | "policy_denied" | "unsupported_version" | "execution_failed";
  errorMessage: string;
  worktreePath?: string;
}

export interface TaskCancellation {
  worktreePath?: string;
}

export interface TaskDispositionResult {
  rootDisposition?: {
    terminal: boolean;
    success: boolean;
  };
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

export type DaemonWakeup =
  | { type: "task.available"; runtimeBackendId: string }
  | { type: "task.cancel"; taskId: string }
  | ({ type: "root.finalize" } & RootFinalizationRequest)
  | { type: "runtime.refresh"; requestId?: string }
  | { type: "daemon.restart" };

export interface DaemonWakeupSubscription {
  close(): Promise<void>;
  readonly closed: boolean;
}

export interface DaemonControlPlane {
  heartbeat(payload: DaemonHeartbeatPayload, signal?: AbortSignal): Promise<DaemonHeartbeatResult>;
  diagnostics(lines: string[], signal?: AbortSignal): Promise<void>;
  claim(runtimeBackendId: string, signal?: AbortSignal): Promise<ClaimedExecutionTask | undefined>;
  renewLease(claim: ClaimedExecutionTask, signal?: AbortSignal): Promise<LeaseResult>;
  setTaskState(claim: ClaimedExecutionTask, status: "preparing" | "running", signal?: AbortSignal): Promise<void>;
  appendEvents(claim: ClaimedExecutionTask, events: RuntimeEventUpload[], signal?: AbortSignal): Promise<void>;
  complete(claim: ClaimedExecutionTask, completion: TaskCompletion, signal?: AbortSignal): Promise<TaskDispositionResult>;
  cancel(claim: ClaimedExecutionTask, cancellation: TaskCancellation, signal?: AbortSignal): Promise<TaskDispositionResult>;
  fail(claim: ClaimedExecutionTask, failure: TaskFailure, signal?: AbortSignal): Promise<TaskDispositionResult>;
  reportRootFinalization(claim: ClaimedExecutionTask, rootRunId: string, report: RootFinalizationReport, signal?: AbortSignal): Promise<void>;
  reportRequestedRootFinalization(projectId: string, rootRunId: string, report: RootFinalizationReport, signal?: AbortSignal): Promise<void>;
  subscribe(onWakeup: (event: DaemonWakeup) => void, onDisconnect: (error?: Error) => void): Promise<DaemonWakeupSubscription>;
}
