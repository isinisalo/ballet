import type { RuntimeProvider } from "../../shared/domain/runtime.js";
import type { DaemonConfig } from "./config/DaemonConfigStore.js";
import { TaskCancelledError, type LeaseAwareJobRunner } from "./jobs/LeaseAwareJobRunner.js";
import type { GitWorkspaceManager } from "./git/GitWorkspaceManager.js";
import type { CliRuntimeAdapter, RuntimeModel, RuntimeProbe } from "./providers/CliRuntimeAdapter.js";
import { errorReport, modelDiscoveryErrorReport, reportFromProbe } from "./runtimeBackendReport.js";
import type {
  DaemonBackendReport,
  DaemonControlPlane,
  DaemonHeartbeatPayload,
  RootFinalizationRequest,
  DaemonWakeup,
  DaemonWakeupSubscription
} from "./transport/DaemonControlPlane.js";

export interface BalletDaemonOptions {
  config: DaemonConfig;
  adapters: readonly CliRuntimeAdapter[];
  transport: DaemonControlPlane;
  runner: LeaseAwareJobRunner;
  git: GitWorkspaceManager;
  heartbeatIntervalMs?: number;
  fallbackPollIntervalMs?: number;
  onStatus?: (status: BalletDaemonStatus) => Promise<void> | void;
  onLog?: (level: "info" | "warn" | "error", message: string, data?: unknown) => void;
}

export interface BalletDaemonStatus {
  state: "starting" | "running" | "stopping" | "error";
  startedAt: string;
  activeTasks: number;
  websocketConnected: boolean;
  recentError?: string;
}

export class BalletDaemon {
  private readonly adapters: Map<RuntimeProvider, CliRuntimeAdapter>;
  private readonly backends: Map<RuntimeProvider, string>;
  private readonly controller = new AbortController();
  private readonly activeBackends = new Set<string>();
  private readonly activeTasks = new Set<Promise<void>>();
  private readonly activeRootFinalizations = new Set<string>();
  private reports: DaemonBackendReport[] = [];
  private subscription?: DaemonWakeupSubscription;
  private websocketConnected = false;
  private recentError?: string;
  private readonly diagnosticLines: string[] = [];
  private readonly startedAt = new Date().toISOString();

  constructor(private readonly options: BalletDaemonOptions) {
    this.adapters = new Map(options.adapters.map((adapter) => [adapter.provider, adapter]));
    this.backends = new Map(options.config.backends.map((backend) => [backend.provider, backend.id]));
  }

  async run(): Promise<void> {
    this.log("info", "Ballet daemon starting.", { daemonId: this.options.config.daemonId, deviceId: this.options.config.deviceId });
    await this.publishStatus("starting");
    this.reports = await this.probeBackends();
    await this.sendHeartbeat().catch((error) => this.recordError("Initial heartbeat failed.", error));
    await this.publishStatus("running");
    this.log("info", "Ballet daemon ready.", { backends: this.reports.map((report) => ({ id: report.id, provider: report.provider, health: report.health })) });
    const loops = [this.heartbeatLoop(), this.fallbackPollLoop(), this.websocketLoop()];
    await Promise.all(loops);
    await Promise.allSettled([...this.activeTasks]);
    await this.publishStatus("stopping");
    this.log("info", "Ballet daemon stopped.");
  }

  async stop(): Promise<void> {
    this.controller.abort(new Error("Daemon shutdown requested."));
    await this.subscription?.close().catch(() => undefined);
  }

  private async heartbeatLoop(): Promise<void> {
    const interval = this.options.heartbeatIntervalMs ?? 15_000;
    while (!this.controller.signal.aborted) {
      await delay(interval, this.controller.signal).catch(() => undefined);
      if (this.controller.signal.aborted) return;
      await this.sendHeartbeat().catch((error) => this.recordError("Heartbeat failed.", error));
    }
  }

  private async fallbackPollLoop(): Promise<void> {
    const interval = this.options.fallbackPollIntervalMs ?? 30_000;
    while (!this.controller.signal.aborted) {
      await delay(interval, this.controller.signal).catch(() => undefined);
      if (this.controller.signal.aborted) return;
      for (const report of this.reports.filter((candidate) => candidate.health === "ready")) this.wakeBackend(report.id);
    }
  }

  private async websocketLoop(): Promise<void> {
    let retryMs = 1_000;
    while (!this.controller.signal.aborted) {
      let disconnected: (() => void) | undefined;
      const waitForDisconnect = new Promise<void>((resolve) => { disconnected = resolve; });
      try {
        this.subscription = await this.options.transport.subscribe(
          (event) => this.handleWakeup(event),
          (error) => {
            this.websocketConnected = false;
            if (error) this.recordError("WebSocket disconnected.", error);
            disconnected?.();
          }
        );
        this.websocketConnected = true;
        this.log("info", "Control-plane WebSocket connected.");
        retryMs = 1_000;
        await this.publishStatus("running");
        await waitForDisconnect;
      } catch (error) {
        this.recordError("WebSocket connection failed.", error);
      }
      if (this.controller.signal.aborted) return;
      await delay(retryMs + Math.floor(Math.random() * Math.min(1_000, retryMs)), this.controller.signal).catch(() => undefined);
      retryMs = Math.min(30_000, retryMs * 2);
    }
  }

  private handleWakeup(event: DaemonWakeup): void {
    if (event.type === "task.available") this.wakeBackend(event.runtimeBackendId);
    else if (event.type === "task.cancel") {
      void this.options.runner.cancel(event.taskId).catch((error) => this.recordError(`Task ${event.taskId} cancellation failed.`, error));
    }
    else if (event.type === "root.finalize") this.wakeRootFinalization(event);
    else if (event.type === "runtime.refresh") {
      void this.refreshRuntime(event.requestId).catch((error) => this.recordError("Runtime refresh failed.", error));
    } else if (event.type === "daemon.restart") {
      void this.stop();
    }
  }

  private async refreshRuntime(requestId?: string): Promise<void> {
    this.reports = await this.probeBackends();
    await this.sendHeartbeat(requestId);
  }

  private wakeBackend(runtimeBackendId: string): void {
    if (!this.reports.some((report) => report.id === runtimeBackendId && report.health === "ready")) return;
    if (this.activeBackends.has(runtimeBackendId) || this.controller.signal.aborted) return;
    const task = this.claimLoop(runtimeBackendId).finally(() => {
      this.activeBackends.delete(runtimeBackendId);
      this.activeTasks.delete(task);
      void this.publishStatus("running");
    });
    this.activeBackends.add(runtimeBackendId);
    this.activeTasks.add(task);
    void this.publishStatus("running");
  }

  private wakeRootFinalization(request: RootFinalizationRequest): void {
    const key = `${request.projectId}:${request.rootRunId}`;
    if (this.activeRootFinalizations.has(key) || this.controller.signal.aborted) return;
    if (this.options.config.projectId !== request.projectId) {
      this.recordError("Root finalization request targets another configured project.", new Error(request.projectId));
      return;
    }
    const task = this.finalizeRoot(request).finally(() => {
      this.activeRootFinalizations.delete(key);
      this.activeTasks.delete(task);
      void this.publishStatus("running");
    });
    this.activeRootFinalizations.add(key);
    this.activeTasks.add(task);
  }

  private async finalizeRoot(request: RootFinalizationRequest): Promise<void> {
    try {
      const report = await this.options.git.finalizeRoot(request.projectId, request.rootRunId, request.success, this.controller.signal);
      await this.options.transport.reportRequestedRootFinalization(request.projectId, request.rootRunId, report, this.controller.signal);
      await this.options.git.acknowledgeFinalization(request.projectId, request.rootRunId);
      this.log("info", "Retained root worktree finalized.", request);
    } catch (error) {
      this.recordError(`Root run ${request.rootRunId} finalization failed.`, error);
    }
  }

  private async claimLoop(runtimeBackendId: string): Promise<void> {
    while (!this.controller.signal.aborted) {
      const claim = await this.options.transport.claim(runtimeBackendId, this.controller.signal);
      if (!claim) return;
      this.log("info", "Execution task claimed.", { taskId: claim.task.id, runtimeBackendId });
      await this.options.runner.run(claim)
        .then(() => this.log("info", "Execution task completed.", { taskId: claim.task.id }))
        .catch((error) => {
          if (error instanceof TaskCancelledError) {
            this.log("info", "Execution task cancelled.", { taskId: claim.task.id });
          } else {
            this.recordError(`Task ${claim.task.id} failed.`, error);
          }
        });
    }
  }

  private async probeBackends(): Promise<DaemonBackendReport[]> {
    return Promise.all([...this.adapters.values()].map(async (adapter) => {
      const backendId = this.backends.get(adapter.provider);
      if (!backendId) throw new Error(`No configured backend id for ${adapter.provider}.`);
      let probe: RuntimeProbe;
      try {
        probe = await adapter.probe(this.controller.signal);
      } catch (error) {
        return errorReport(backendId, adapter.provider, error);
      }
      let models: RuntimeModel[] = [];
      if (probe.installed && probe.compatible && probe.authStatus === "ready") {
        try {
          models = await adapter.listModels(this.controller.signal);
        } catch (error) {
          this.recordError(`${adapter.provider} model discovery failed.`, error);
          return modelDiscoveryErrorReport(backendId, probe, error);
        }
      }
      return reportFromProbe(backendId, probe, models);
    }));
  }

  private async sendHeartbeat(inspectionId?: string): Promise<void> {
    const checkout = await this.checkoutHeartbeat(inspectionId);
    const payload: DaemonHeartbeatPayload = {
      daemonVersion: this.options.config.daemonVersion,
      uptimeSeconds: Math.max(0, Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000)),
      backends: this.reports,
      checkout,
      recentError: this.recentError
    };
    const response = await this.options.transport.heartbeat(payload, this.controller.signal);
    for (const request of response.rootFinalizations ?? []) this.wakeRootFinalization(request);
    if (response.refreshRequestId && response.refreshRequestId !== inspectionId) {
      await this.refreshRuntime(response.refreshRequestId);
    } else if (response.refreshRequested && !response.refreshRequestId) {
      this.reports = await this.probeBackends();
    }
    await this.flushDiagnostics();
    if (response.restartRequested) await this.stop();
  }

  private async checkoutHeartbeat(inspectionId?: string): Promise<DaemonHeartbeatPayload["checkout"]> {
    const { projectId, repositoryUrl, repositoryPath } = this.options.config;
    if (!projectId || !repositoryUrl || !repositoryPath) return undefined;
    const inspected = await this.options.git.inspectManagedProject(projectId, this.controller.signal);
    if (inspected.root !== repositoryPath) {
      throw new Error(`Configured repository path ${repositoryPath} does not match managed checkout ${inspected.root}.`);
    }
    return {
      repositoryUrl,
      path: inspected.root,
      headSha: inspected.headSha,
      configHash: inspected.snapshotHash,
      dirty: inspected.codeDirty,
      inspectionId,
      lastInspectedAt: new Date().toISOString()
    };
  }

  private recordError(message: string, error: unknown): void {
    this.recentError = `${message} ${error instanceof Error ? error.message : String(error)}`.slice(0, 4000);
    this.log("error", message, error);
    void this.publishStatus("error");
  }

  private publishStatus(state: BalletDaemonStatus["state"]): Promise<void> {
    return Promise.resolve(this.options.onStatus?.({
      state,
      startedAt: this.startedAt,
      activeTasks: this.activeTasks.size,
      websocketConnected: this.websocketConnected,
      recentError: this.recentError
    }));
  }

  private log(level: "info" | "warn" | "error", message: string, data?: unknown): void {
    this.options.onLog?.(level, message, data);
    const detail = serializeDiagnostic(data);
    this.diagnosticLines.push(`${new Date().toISOString()} [${level}] ${message}${detail ? ` ${detail}` : ""}`.slice(0, 16_000));
    if (this.diagnosticLines.length > 1000) this.diagnosticLines.splice(0, this.diagnosticLines.length - 1000);
  }

  private async flushDiagnostics(): Promise<void> {
    const batch = this.diagnosticLines.slice(0, 200);
    if (batch.length === 0) return;
    await this.options.transport.diagnostics(batch, this.controller.signal)
      .then(() => { this.diagnosticLines.splice(0, batch.length); })
      .catch(() => undefined);
  }
}

const serializeDiagnostic = (value: unknown): string => {
  if (value === undefined) return "";
  if (value instanceof Error) return value.message;
  try { return JSON.stringify(value); } catch { return String(value); }
};

const delay = (milliseconds: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  const finish = () => { signal.removeEventListener("abort", abort); resolve(); };
  const timer = setTimeout(finish, milliseconds);
  const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason); };
  signal.addEventListener("abort", abort, { once: true });
});
