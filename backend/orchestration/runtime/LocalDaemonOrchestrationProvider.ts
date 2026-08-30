import type { AgentDefinition } from "../../../shared/orchestration/environment.js";
import type { ExecutionSpecV14 } from "../../../shared/orchestration/execution.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/orchestration/primitives.js";
import type { RuntimeCapabilitySnapshot } from "../../../shared/orchestration/runtime.js";
import type { LocalDaemonStore } from "../persistence/LocalDaemonStore.js";
import type { OrchestrationProviderPreflightPort } from "./EnvironmentRunPlanner.js";
import type { ProviderPermissionSpec } from "./ProviderPermissions.js";
import type { OrchestrationRuntimeProvider, ProviderTerminal } from "./RuntimeProvider.js";

const EXECUTION_TIMEOUT_MS = 30 * 60_000;

export class LocalDaemonOrchestrationProvider implements OrchestrationRuntimeProvider, OrchestrationProviderPreflightPort {
  constructor(private readonly daemon: LocalDaemonStore) {}

  async inspect(agent: AgentDefinition): Promise<RuntimeCapabilitySnapshot> {
    const binding = this.daemon.binding(agent.id);
    if (!binding) throw new Error(`Agent ${agent.id} has no local execution binding.`);
    const status = this.daemon.status();
    if (status.status !== "online") throw new Error(`Local daemon is ${status.status}.`);
    const provider = status.providers.find((candidate) => candidate.provider === binding.provider);
    if (!provider || provider.health !== "ready" || !provider.cliVersion) {
      throw new Error(provider?.healthMessage ?? `${binding.provider} is unavailable on the local daemon.`);
    }
    const model = provider.capabilities.models.find(({ id }) => id === binding.model);
    if (!model) throw new Error(`Model ${binding.model} is unavailable for ${binding.provider}.`);
    if (!model.reasoningOptions.includes(binding.reasoningEffort)) {
      throw new Error(`Reasoning effort ${binding.reasoningEffort} is unavailable for ${binding.model}.`);
    }
    const supportedModels = provider.capabilities.models.map(({ id }) => id).sort();
    const supportedReasoningEfforts = [...new Set(provider.capabilities.models
      .flatMap(({ reasoningOptions }) => reasoningOptions))].sort();
    const content = {
      agentId: agent.id, provider: binding.provider, model: binding.model,
      reasoningEffort: binding.reasoningEffort, networkAccess: binding.policy.network,
      readOnlyRoots: binding.policy.readOnlyRoots, cliVersion: provider.cliVersion,
      supportedModels, supportedReasoningEfforts, supportsReadOnly: true,
      supportsWorkspaceWrite: provider.capabilities.policy.workspaceWrite
    };
    return { ...content, capabilitySha256: hash(content) };
  }

  async execute(spec: ExecutionSpecV14, permissions: ProviderPermissionSpec): Promise<ProviderTerminal> {
    if (permissions.provider !== spec.runtime.provider
      || permissions.networkAccess !== spec.permissions.networkAccess
      || permissions.approvalPolicy !== spec.permissions.approvalPolicy) {
      throw new Error("Local daemon permission snapshot differs from the ExecutionSpec.");
    }
    const deadline = Date.now() + EXECUTION_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const terminal = this.daemon.terminal(spec.taskId);
      if (terminal?.rawOutput !== undefined) {
        return { kind: "output", providerOutcomeKey: terminal.providerOutcomeKey, raw: terminal.rawOutput };
      }
      if (terminal?.errorMessage !== undefined) {
        return { kind: "failure", providerOutcomeKey: terminal.providerOutcomeKey, errorMessage: terminal.errorMessage };
      }
      if (this.daemon.leaseExpired(spec.taskId)) {
        return { kind: "failure", providerOutcomeKey: `local-daemon:${spec.taskId}`,
          errorMessage: "Local daemon lease expired while the provider task was active." };
      }
      await delay(100);
    }
    return { kind: "failure", providerOutcomeKey: `local-daemon:${spec.taskId}`,
      errorMessage: "Local daemon task did not finish within 30 minutes." };
  }

  async cancel(taskId: string): Promise<void> { this.daemon.requestCancellation(taskId); }
}

const hash = (value: unknown): string => sha256(canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue));
const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
