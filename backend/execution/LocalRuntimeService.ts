import { createHash } from "node:crypto";
import os from "node:os";
import type {
  ExecutionProjectSnapshot,
  ExecutionRuntimeSnapshot,
  LocalProviderStatus,
  LocalRuntime,
  ResolvedAgentExecution,
  RuntimeCapabilities,
  RuntimeProvider
} from "../../shared/domain/runtime.js";
import type { ProjectContext } from "../project/ProjectContext.js";
import type { ExecutionStore } from "./ExecutionStore.js";
import type { LocalSettingsRepository } from "./LocalSettingsRepository.js";
import { LocalWorkspaceManager } from "./git/LocalWorkspaceManager.js";
import type { CliRuntimeAdapter, RuntimeModel, RuntimeProbe } from "./providers/CliRuntimeAdapter.js";
import { CodexAppServerAdapter } from "./providers/codex/CodexAppServerAdapter.js";
import { CopilotSdkAdapter } from "./providers/copilot/CopilotSdkAdapter.js";

export interface LocalRuntimeServiceOptions {
  context: ProjectContext;
  executionStore: ExecutionStore;
  settings: LocalSettingsRepository;
  codexCommand?: string;
  copilotCommand?: string;
  adapters?: CliRuntimeAdapter[];
}

export interface RuntimePreflightSnapshot {
  runtime: ExecutionRuntimeSnapshot;
  project: ExecutionProjectSnapshot;
}

export class LocalRuntimeService {
  private readonly startedAt = new Date();
  private readonly adapters: Map<RuntimeProvider, CliRuntimeAdapter>;
  private readonly statuses = new Map<RuntimeProvider, LocalProviderStatus>();
  private readonly workspace: LocalWorkspaceManager;

  constructor(private readonly options: LocalRuntimeServiceOptions) {
    const adapters = options.adapters ?? [
      new CodexAppServerAdapter({ command: options.codexCommand }),
      new CopilotSdkAdapter({ command: options.copilotCommand })
    ];
    this.adapters = new Map(adapters.map((adapter) => [adapter.provider, adapter]));
    this.workspace = new LocalWorkspaceManager(options.context);
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

  async verify(expected: ExecutionRuntimeSnapshot): Promise<void> {
    const status = await this.refreshProvider(expected.provider);
    if (status.health !== "ready" || status.cliVersion !== expected.cliVersion) {
      throw new Error(status.healthMessage ?? `${expected.provider} CLI changed after the Run was queued.`);
    }
    if (capabilityHash(status.capabilities) !== expected.capabilityHash) {
      throw new Error(`${expected.provider} capabilities changed after the Run was queued.`);
    }
    const model = status.capabilities.models.find((candidate) => candidate.id === expected.model);
    if (!model && expected.model !== "provider-default") throw new Error(`Model ${expected.model} is no longer available.`);
    if (model?.reasoningOptions.length && expected.reasoning !== "provider-default"
      && !model.reasoningOptions.includes(expected.reasoning)) throw new Error(`Reasoning ${expected.reasoning} is no longer available.`);
  }

  async refresh(): Promise<LocalRuntime> {
    await Promise.all((["codex", "copilot"] as const).map((provider) => this.refreshProvider(provider)));
    return this.snapshot();
  }

  async snapshot(): Promise<LocalRuntime> {
    const checkout = await this.workspace.inspect();
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
      activeRunCount: this.options.executionStore.activeCount(),
      logsPath: this.options.context.logsPath
    };
  }

  async preflight(execution: ResolvedAgentExecution): Promise<RuntimePreflightSnapshot> {
    const status = await this.refreshProvider(execution.provider);
    if (status.health !== "ready" || !status.cliVersion) {
      throw new Error(status.healthMessage ?? `${execution.provider} CLI is not ready.`);
    }
    const model = status.capabilities.models.find((candidate) => candidate.id === execution.model);
    if (!model && execution.model !== "provider-default") {
      throw new Error(`Model ${execution.model} is not available from the local ${execution.provider} CLI.`);
    }
    if (model && model.reasoningOptions.length > 0 && execution.reasoning !== "provider-default"
      && !model.reasoningOptions.includes(execution.reasoning)) {
      throw new Error(`Reasoning option ${execution.reasoning} is not available for ${execution.model}.`);
    }
    if (!status.capabilities.policy.workspaceWrite
      || (execution.policy.network && !status.capabilities.policy.networkControl)
      || (execution.policy.readOnlyRoots.length > 0 && !status.capabilities.policy.readOnlyRoots)) {
      throw new Error(`${execution.provider} cannot enforce the selected execution policy.`);
    }
    const checkout = await this.workspace.inspect();
    if (checkout.codeDirty) throw new Error(`Commit or stash source changes before running: ${checkout.dirtyPaths.join(", ")}`);
    return {
      runtime: {
        hostname: os.hostname(), provider: execution.provider, cliVersion: status.cliVersion,
        model: execution.model, reasoning: execution.reasoning, policy: execution.policy,
        capabilityHash: capabilityHash(status.capabilities)
      },
      project: {
        checkoutRoot: this.options.context.root,
        headSha: checkout.headSha,
        configHash: checkout.configHash,
        snapshotHash: checkout.configHash
      }
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
      busy: this.options.executionStore.runningCount(provider) > 0,
      activeRunCount: this.options.executionStore.activeCount(provider)
    };
    this.statuses.set(provider, status);
    return status;
  }

  private withActivity(provider: RuntimeProvider): LocalProviderStatus {
    const status = this.statuses.get(provider) ?? unavailable(provider, provider, "Runtime has not been probed yet.");
    const activeRunCount = this.options.executionStore.activeCount(provider);
    return { ...status, activeRunCount, busy: this.options.executionStore.runningCount(provider) > 0 };
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
const capabilityHash = (capabilities: RuntimeCapabilities): string => hash({
  models: capabilities.models,
  supportsStructuredOutput: capabilities.supportsStructuredOutput,
  policy: capabilities.policy
});
