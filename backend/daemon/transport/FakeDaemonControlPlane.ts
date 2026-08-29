import type {
  ClaimedExecutionTask,
  DaemonControlPlane,
  DaemonHeartbeatPayload,
  DaemonHeartbeatResult,
  DaemonWakeup,
  DaemonWakeupSubscription,
  LeaseResult,
  RootFinalizationReport,
  RuntimeEventUpload,
  TaskCancellation,
  TaskCompletion,
  TaskDispositionResult,
  TaskFailure
} from "./DaemonControlPlane.js";

export class FakeDaemonControlPlane implements DaemonControlPlane {
  readonly heartbeats: DaemonHeartbeatPayload[] = [];
  readonly diagnosticBatches: string[][] = [];
  readonly events: RuntimeEventUpload[][] = [];
  readonly completed: TaskCompletion[] = [];
  readonly cancelled: TaskCancellation[] = [];
  readonly failed: TaskFailure[] = [];
  readonly rootFinalizations: RootFinalizationReport[] = [];
  readonly requestedRootFinalizations: Array<{ projectId: string; rootRunId: string; report: RootFinalizationReport }> = [];
  readonly states: Array<"preparing" | "running"> = [];
  readonly claims: ClaimedExecutionTask[] = [];
  leaseResult: LeaseResult = { accepted: true };
  completeDisposition: TaskDispositionResult = { rootDisposition: { terminal: true, success: true } };
  cancelDisposition: TaskDispositionResult = { rootDisposition: { terminal: true, success: false } };
  failDisposition: TaskDispositionResult = { rootDisposition: { terminal: true, success: false } };
  heartbeatResult: DaemonHeartbeatResult = {};
  private wakeup?: (event: DaemonWakeup) => void;

  async heartbeat(payload: DaemonHeartbeatPayload): Promise<DaemonHeartbeatResult> {
    this.heartbeats.push(payload);
    return this.heartbeatResult;
  }

  async diagnostics(lines: string[]): Promise<void> {
    this.diagnosticBatches.push(lines);
  }

  async claim(): Promise<ClaimedExecutionTask | undefined> {
    return this.claims.shift();
  }

  async renewLease(claim: ClaimedExecutionTask, signal?: AbortSignal): Promise<LeaseResult> {
    void claim;
    void signal;
    return this.leaseResult;
  }

  async setTaskState(_claim: ClaimedExecutionTask, status: "preparing" | "running"): Promise<void> {
    this.states.push(status);
  }

  async appendEvents(_claim: ClaimedExecutionTask, events: RuntimeEventUpload[]): Promise<void> {
    this.events.push(events);
  }

  async complete(_claim: ClaimedExecutionTask, completion: TaskCompletion): Promise<TaskDispositionResult> {
    this.completed.push(completion);
    return this.completeDisposition;
  }

  async cancel(_claim: ClaimedExecutionTask, cancellation: TaskCancellation): Promise<TaskDispositionResult> {
    this.cancelled.push(cancellation);
    return this.cancelDisposition;
  }

  async fail(_claim: ClaimedExecutionTask, failure: TaskFailure): Promise<TaskDispositionResult> {
    this.failed.push(failure);
    return this.failDisposition;
  }

  async reportRootFinalization(_claim: ClaimedExecutionTask, _rootRunId: string, report: RootFinalizationReport): Promise<void> {
    this.rootFinalizations.push(report);
  }

  async reportRequestedRootFinalization(projectId: string, rootRunId: string, report: RootFinalizationReport): Promise<void> {
    this.requestedRootFinalizations.push({ projectId, rootRunId, report });
  }

  async subscribe(onWakeup: (event: DaemonWakeup) => void, onDisconnect: (error?: Error) => void): Promise<DaemonWakeupSubscription> {
    this.wakeup = onWakeup;
    let closed = false;
    return { get closed() { return closed; }, close: async () => { closed = true; onDisconnect(); } };
  }

  emitWakeup(event: DaemonWakeup): void {
    this.wakeup?.(event);
  }
}
