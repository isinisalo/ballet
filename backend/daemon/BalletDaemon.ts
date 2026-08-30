import type { LocalProviderStatus, RuntimeProvider } from "../../shared/domain/runtime.js";
import type { DaemonConfig } from "./config/DaemonConfigStore.js";
import type { LeaseAwareJobRunner } from "./jobs/LeaseAwareJobRunner.js";
import type { CliRuntimeAdapter } from "./providers/CliRuntimeAdapter.js";
import { errorReport, reportFromProbe } from "./runtimeBackendReport.js";
import type { LocalDaemonTransport } from "./transport/LocalDaemonTransport.js";

export interface BalletDaemonStatus {
  state: "starting" | "running" | "stopping" | "error";
  startedAt: string;
  activeTasks: number;
  recentError?: string;
}

export class BalletDaemon {
  private readonly adapters: Map<RuntimeProvider, CliRuntimeAdapter>;
  private readonly controller = new AbortController();
  private readonly activeProviders = new Set<RuntimeProvider>();
  private readonly activeTasks = new Set<Promise<void>>();
  private reports: LocalProviderStatus[] = [];
  private recentError?: string;
  private readonly diagnosticLines: string[] = [];
  private readonly startedAt = new Date().toISOString();

  constructor(private readonly options: {
    config: DaemonConfig; adapters: readonly CliRuntimeAdapter[]; transport: LocalDaemonTransport;
    runner: LeaseAwareJobRunner; heartbeatIntervalMs?: number; pollIntervalMs?: number;
    onStatus?(status: BalletDaemonStatus): Promise<void> | void;
    onLog?(level: "info" | "warn" | "error", message: string, data?: unknown): void;
  }) { this.adapters = new Map(options.adapters.map((adapter) => [adapter.provider, adapter])); }

  async run(): Promise<void> {
    this.log("info", "Checkout-local Ballet daemon starting.", { instanceId: this.options.config.instanceId });
    await this.publishStatus("starting"); this.reports = await this.probeProviders();
    await this.sendHeartbeat().catch((error) => this.recordError("Initial heartbeat failed.", error));
    await this.publishStatus("running");
    await Promise.all([this.heartbeatLoop(), this.pollLoop()]);
    await Promise.allSettled([...this.activeTasks]);
    await this.publishStatus("stopping"); this.log("info", "Checkout-local Ballet daemon stopped.");
  }

  async stop(): Promise<void> { this.controller.abort(new Error("Daemon shutdown requested.")); }

  private async heartbeatLoop(): Promise<void> {
    while (!this.controller.signal.aborted) {
      await delay(this.options.heartbeatIntervalMs ?? 15_000, this.controller.signal).catch(() => undefined);
      if (this.controller.signal.aborted) return;
      await this.sendHeartbeat().catch((error) => this.recordError("Heartbeat failed.", error));
    }
  }

  private async pollLoop(): Promise<void> {
    while (!this.controller.signal.aborted) {
      for (const report of this.reports.filter(({ health }) => health === "ready")) this.claimProvider(report.provider);
      await delay(this.options.pollIntervalMs ?? 1_000, this.controller.signal).catch(() => undefined);
    }
  }

  private claimProvider(provider: RuntimeProvider): void {
    if (this.activeProviders.has(provider) || this.controller.signal.aborted) return;
    const task = this.claimLoop(provider).finally(() => {
      this.activeProviders.delete(provider); this.activeTasks.delete(task); void this.publishStatus("running");
    });
    this.activeProviders.add(provider); this.activeTasks.add(task); void this.publishStatus("running");
  }

  private async claimLoop(provider: RuntimeProvider): Promise<void> {
    while (!this.controller.signal.aborted) {
      const claim = await this.options.transport.claim(provider, this.controller.signal)
        .catch((error) => { this.recordError(`${provider} claim failed.`, error); return undefined; });
      if (!claim) return;
      this.log("info", "Execution task claimed.", { taskId: claim.taskId, provider });
      await this.options.runner.run(claim)
        .then(() => this.log("info", "Execution task completed.", { taskId: claim.taskId, provider }))
        .catch((error) => this.recordError(`Execution task ${claim.taskId} failed.`, error));
    }
  }

  private async probeProviders(): Promise<LocalProviderStatus[]> {
    return Promise.all((["codex"] as const).map(async (provider) => {
      const adapter = this.adapters.get(provider);
      if (!adapter) return errorReport(provider, new Error(`${provider} adapter is not configured.`));
      try {
        const probe = await adapter.probe(this.controller.signal);
        const models = probe.installed && probe.compatible && probe.authStatus === "ready"
          ? await adapter.listModels(this.controller.signal) : [];
        return reportFromProbe(probe, models, this.activeProviders.has(provider));
      } catch (error) { return errorReport(provider, error, this.activeProviders.has(provider)); }
    }));
  }

  private async sendHeartbeat(): Promise<void> {
    this.reports = this.reports.map((report) => ({ ...report, busy: this.activeProviders.has(report.provider) }));
    const response = await this.options.transport.heartbeat({
      pid: process.pid, daemonVersion: this.options.config.daemonVersion,
      uptimeSeconds: Math.max(0, Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000)),
      activeTaskCount: this.activeTasks.size, providers: this.reports, recentError: this.recentError
    }, this.controller.signal);
    if (response.refreshRequested) {
      this.reports = await this.probeProviders(); await this.options.transport.acknowledge("refresh", this.controller.signal);
    }
    if (response.restartRequested) {
      await this.options.transport.acknowledge("restart", this.controller.signal); await this.stop();
    }
    await this.flushDiagnostics();
  }

  private recordError(message: string, error: unknown): void {
    this.recentError = `${message} ${error instanceof Error ? error.message : String(error)}`.slice(0, 4000);
    this.log("error", message, error); void this.publishStatus("error");
  }
  private publishStatus(state: BalletDaemonStatus["state"]): Promise<void> {
    return Promise.resolve(this.options.onStatus?.({ state, startedAt: this.startedAt,
      activeTasks: this.activeTasks.size, recentError: this.recentError }));
  }
  private log(level: "info" | "warn" | "error", message: string, data?: unknown): void {
    this.options.onLog?.(level, message, data);
    this.diagnosticLines.push(`${new Date().toISOString()} [${level}] ${message}${data === undefined ? "" : ` ${serialize(data)}`}`.slice(0, 16_000));
    if (this.diagnosticLines.length > 1000) this.diagnosticLines.splice(0, this.diagnosticLines.length - 1000);
  }
  private async flushDiagnostics(): Promise<void> {
    const batch = this.diagnosticLines.slice(0, 200); if (batch.length === 0) return;
    await this.options.transport.diagnostics(batch, this.controller.signal)
      .then(() => { this.diagnosticLines.splice(0, batch.length); }).catch(() => undefined);
  }
}

const serialize = (value: unknown): string => { try { return JSON.stringify(value); } catch { return String(value); } };
const delay = (milliseconds: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  const finish = () => { signal.removeEventListener("abort", abort); resolve(); };
  const timer = setTimeout(finish, milliseconds);
  const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason); };
  signal.addEventListener("abort", abort, { once: true });
});
