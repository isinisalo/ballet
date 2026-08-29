import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  LocalProviderStatus,
  LocalRuntime,
  RuntimeCapabilities,
  RuntimeProvider
} from "../../shared/domain/localRuntime.js";
import type { ProjectContext } from "../project/ProjectContext.js";
import type { LocalSettingsRepository } from "./LocalSettingsRepository.js";
import { runGit } from "./git/gitProcess.js";
import type { CliRuntimeAdapter, RuntimeModel, RuntimeProbe } from "./providers/CliRuntimeAdapter.js";
import { CodexAppServerAdapter } from "./providers/codex/CodexAppServerAdapter.js";
import { CopilotSdkAdapter } from "./providers/copilot/CopilotSdkAdapter.js";

export interface LocalRuntimeServiceOptions {
  context: ProjectContext;
  executionStore?: { activeCount(provider?: RuntimeProvider): number; runningCount(provider: RuntimeProvider): number };
  settings: LocalSettingsRepository;
  codexCommand?: string;
  copilotCommand?: string;
  adapters?: CliRuntimeAdapter[];
}

export class LocalRuntimeService {
  private readonly startedAt = new Date();
  private readonly adapters: Map<RuntimeProvider, CliRuntimeAdapter>;
  private readonly statuses = new Map<RuntimeProvider, LocalProviderStatus>();

  constructor(private readonly options: LocalRuntimeServiceOptions) {
    const adapters = options.adapters ?? [
      new CodexAppServerAdapter({ command: options.codexCommand }),
      new CopilotSdkAdapter({ command: options.copilotCommand })
    ];
    this.adapters = new Map(adapters.map((adapter) => [adapter.provider, adapter]));
  }

  get startedAtIso(): string { return this.startedAt.toISOString(); }

  async start(): Promise<void> {
    await Promise.all((["codex", "copilot"] as const).map((provider) => this.refreshProvider(provider)));
  }

  adapter(provider: RuntimeProvider): CliRuntimeAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`No local ${provider} adapter is configured.`);
    return adapter;
  }

  providerStatus(provider: RuntimeProvider): LocalProviderStatus {
    return this.withActivity(provider);
  }

  async refresh(): Promise<LocalRuntime> {
    await Promise.all((["codex", "copilot"] as const).map((provider) => this.refreshProvider(provider)));
    return this.snapshot();
  }

  async snapshot(): Promise<LocalRuntime> {
    const checkout = await inspectCheckout(this.options.context.root);
    return {
      instanceId: this.options.context.instanceId,
      hostname: os.hostname(),
      platform: "darwin",
      architecture: process.arch === "x64" ? "x64" : "arm64",
      checkout: {
        path: this.options.context.root,
        headSha: checkout.headSha,
        configHash: checkout.configHash,
        dirty: checkout.codeDirty
      },
      uptimeSeconds: Math.max(0, Math.floor((Date.now() - this.startedAt.getTime()) / 1000)),
      startedAt: this.startedAt.toISOString(),
      providers: (["codex", "copilot"] as const).map((provider) => this.withActivity(provider)),
      activeRunCount: this.options.executionStore?.activeCount() ?? 0,
      logsPath: this.options.context.logsPath
    };
  }

  private async refreshProvider(provider: RuntimeProvider): Promise<LocalProviderStatus> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      const missing = unavailable(provider, provider, "No adapter is configured.");
      this.statuses.set(provider, missing);
      return missing;
    }
    let probe: RuntimeProbe;
    try {
      probe = await adapter.probe();
    } catch (error) {
      const failed = unavailable(provider, provider, error instanceof Error ? error.message : String(error));
      this.statuses.set(provider, failed);
      return failed;
    }
    let models: RuntimeModel[] = [];
    let modelError: string | undefined;
    if (probe.installed && probe.compatible && probe.authStatus === "ready") {
      try { models = await adapter.listModels(); } catch (error) {
        modelError = error instanceof Error ? error.message : String(error);
      }
    }
    const capabilities: RuntimeCapabilities = {
      models: models.map((model) => ({
        id: model.id, label: model.name, reasoningOptions: model.reasoningOptions ?? [],
        defaultReasoning: model.defaultReasoning
      })),
      supportsStructuredOutput: true,
      policy: probe.policyCapabilities,
      refreshedAt: new Date().toISOString()
    };
    const health = !probe.installed ? "error"
      : !probe.compatible ? "unsupported_version"
        : probe.authStatus !== "ready" ? "auth_required"
          : modelError ? "error" : "ready";
    const status: LocalProviderStatus = {
      provider, command: probe.command, installed: probe.installed, compatible: probe.compatible,
      cliVersion: probe.version, authStatus: probe.authStatus, health,
      healthMessage: probe.reason ?? modelError, capabilities,
      busy: (this.options.executionStore?.runningCount(provider) ?? 0) > 0,
      activeRunCount: this.options.executionStore?.activeCount(provider) ?? 0
    };
    this.statuses.set(provider, status);
    return status;
  }

  private withActivity(provider: RuntimeProvider): LocalProviderStatus {
    const status = this.statuses.get(provider) ?? unavailable(provider, provider, "Runtime has not been probed yet.");
    const activeRunCount = this.options.executionStore?.activeCount(provider) ?? 0;
    return { ...status, activeRunCount, busy: (this.options.executionStore?.runningCount(provider) ?? 0) > 0 };
  }
}

const unavailable = (provider: RuntimeProvider, command: string, message: string): LocalProviderStatus => ({
  provider, command, installed: false, compatible: false, authStatus: "unknown", health: "error",
  healthMessage: message, capabilities: {
    models: [], supportsStructuredOutput: true,
    policy: { workspaceWrite: false, networkControl: false, readOnlyRoots: false },
    refreshedAt: new Date().toISOString()
  }, busy: false, activeRunCount: 0
});

const hash = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const inspectCheckout = async (root: string) => {
  const [head, status, config] = await Promise.all([
    runGit(["rev-parse", "HEAD"], { cwd: root }),
    runGit(["status", "--porcelain"], { cwd: root }),
    readFile(path.join(root, ".ballet", "project.json"), "utf8")
  ]);
  return { headSha: head.stdout.trim(), configHash: hash(config), codeDirty: Boolean(status.stdout.trim()) };
};
