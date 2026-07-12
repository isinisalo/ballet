import type { AgentExecutionState } from "../../shared/domain/agents.js";
import type {
  AgentRuntimeConfiguration,
  ExecutionPolicy,
  PortableAgentRuntimeIntent,
  RuntimeConfigurationIssue
} from "../../shared/domain/runtime.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import type { ExecutionStore } from "./ExecutionStore.js";
import type { LocalRuntimeService } from "./LocalRuntimeService.js";
import type { LocalSettings, LocalSettingsRepository } from "./LocalSettingsRepository.js";

export class RuntimeConfigurationService {
  private readonly projectConfig = new ProjectConfigurationRepository();
  private mutation: Promise<void> = Promise.resolve();

  constructor(
    private readonly root: string,
    private readonly settings: LocalSettingsRepository,
    private readonly runtime: LocalRuntimeService,
    private readonly executions: ExecutionStore
  ) {}

  async get(agentId: string): Promise<AgentRuntimeConfiguration> {
    const loaded = this.projectConfig.load(this.root);
    const roots = await this.settings.rootsFor(agentId);
    if (!loaded.config) return { localPolicy: { readOnlyRoots: roots }, issues: loaded.issues };
    const intent = loaded.config.agents[agentId];
    const issues: RuntimeConfigurationIssue[] = [];
    if (!intent) issues.push({
      code: "missing_intent", path: `agents.${agentId}`, agentId,
      message: "Agent has no runtime configuration in .ballet/project.json."
    });
    const provider = intent ? this.runtime.providerStatus(intent.provider) : undefined;
    if (intent && (!provider || provider.health !== "ready")) issues.push({
      code: "provider_unavailable", path: `agents.${agentId}.provider`, agentId,
      message: provider?.healthMessage ?? `The local ${intent.provider} CLI is not ready.`
    });
    return {
      intent,
      localPolicy: { readOnlyRoots: roots },
      resolved: intent ? {
        agentId, provider: intent.provider, model: intent.model, reasoning: intent.reasoning,
        policy: { network: intent.policy.network, readOnlyRoots: roots }
      } : undefined,
      issues
    };
  }

  async list(agentIds: readonly string[]): Promise<Record<string, AgentRuntimeConfiguration>> {
    return Object.fromEntries(await Promise.all(agentIds.map(async (agentId) => [agentId, await this.get(agentId)] as const)));
  }

  async put(agentId: string, input: {
    provider: PortableAgentRuntimeIntent["provider"];
    model: string;
    reasoning: string;
    policy: ExecutionPolicy;
  }): Promise<AgentRuntimeConfiguration> {
    return this.serialize(async () => {
      const original = await this.settings.load();
      const next = withAgentRoots(original, agentId, input.policy.readOnlyRoots);
      await this.settings.write(next);
      try {
        this.projectConfig.putAgentIntent(this.root, agentId, {
          provider: input.provider, model: input.model, reasoning: input.reasoning,
          policy: { network: input.policy.network }
        });
      } catch (error) {
        await this.settings.write(original);
        throw error;
      }
      return this.get(agentId);
    });
  }

  async remove(agentId: string): Promise<void> {
    return this.serialize(async () => {
      const original = await this.settings.load();
      const next = withAgentRoots(original, agentId, undefined);
      await this.settings.write(next);
      try { this.projectConfig.removeAgentIntent(this.root, agentId); }
      catch (error) { await this.settings.write(original); throw error; }
    });
  }

  async executionStates(
    agentIds: readonly string[],
    suppliedConfigurations?: Record<string, AgentRuntimeConfiguration>
  ): Promise<AgentExecutionState[]> {
    const configurations = suppliedConfigurations ?? await this.list(agentIds);
    const active = this.executions.activeTasks();
    return agentIds.map((agentId) => {
      const configuration = configurations[agentId]!;
      const task = active.find((candidate) => candidate.spec.agent.id === agentId);
      if (task) return {
        agentId, status: task.status === "running" ? "running" : "busy",
        provider: task.spec.runtime.provider, reasoning: task.spec.runtime.reasoning, activeTaskId: task.id
      };
      if (!configuration.resolved) return { agentId, status: "unbound", reason: configuration.issues[0]?.message };
      const unavailable = configuration.issues.find((issue) => issue.code === "provider_unavailable");
      return unavailable
        ? { agentId, status: "offline", provider: configuration.resolved.provider, reason: unavailable.message }
        : { agentId, status: "idle", provider: configuration.resolved.provider, reasoning: configuration.resolved.reasoning };
    });
  }

  private async serialize<T>(operation: () => Promise<T>): Promise<T> {
    const predecessor = this.mutation;
    let release!: () => void;
    this.mutation = new Promise<void>((resolve) => { release = resolve; });
    await predecessor;
    try { return await operation(); }
    finally { release(); }
  }
}

const withAgentRoots = (settings: LocalSettings, agentId: string, roots?: string[]): LocalSettings => {
  const agentReadOnlyRoots = { ...(settings.agentReadOnlyRoots ?? {}) };
  if (roots) agentReadOnlyRoots[agentId] = roots;
  else delete agentReadOnlyRoots[agentId];
  return {
    ...settings,
    agentReadOnlyRoots: Object.keys(agentReadOnlyRoots).length > 0 ? agentReadOnlyRoots : undefined
  };
};
