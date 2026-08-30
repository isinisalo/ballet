import type { GovernanceAgentDefinition } from "../../../shared/orchestration/environment.js";
import type { LocalProviderStatus } from "../../../shared/domain/runtime.js";
import type { ExecutionSpecV17 } from "../../../shared/orchestration/execution.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/orchestration/primitives.js";
import type { RuntimeActionCapabilitySnapshot, RuntimeAgentCapabilitySnapshot } from "../../../shared/orchestration/runtime.js";
import type { LocalDaemonStore } from "../persistence/LocalDaemonStore.js";
import type { OrchestrationProviderPreflightPort } from "./EnvironmentRunPlanner.js";
import type { ProviderPermissionSpec } from "./ProviderPermissions.js";
import type { OrchestrationRuntimeProvider, ProviderTerminal } from "./RuntimeProvider.js";

const EXECUTION_TIMEOUT_MS = 30 * 60_000;

export class LocalDaemonOrchestrationProvider implements OrchestrationRuntimeProvider, OrchestrationProviderPreflightPort {
  constructor(private readonly daemon: LocalDaemonStore) {}

  async inspectAgent(agent: GovernanceAgentDefinition): Promise<RuntimeAgentCapabilitySnapshot> {
    const provider = this.readyProvider();
    const model = requireModel(provider, agent.model, agent.reasoningEffort);
    const content = {
      subject: { kind: "agent" as const, agentId: agent.id }, provider: "codex" as const,
      model: agent.model, reasoningEffort: agent.reasoningEffort,
      cliVersion: provider.cliVersion!, supportedModels: provider.capabilities.models.map(({ id }) => id).sort(),
      supportedReasoningEfforts: [...model.reasoningOptions].sort(), supportsReadOnly: true,
      supportsWorkspaceWrite: provider.capabilities.policy.workspaceWrite
    };
    return { ...content, capabilitySha256: hash(content) };
  }

  async inspectAction(actionId: string): Promise<RuntimeActionCapabilitySnapshot> {
    const binding = this.daemon.actionBinding(actionId);
    if (!binding) throw new Error(`Action ${actionId} has no local execution binding.`);
    const provider = this.readyProvider();
    if (!provider.capabilities.policy.workspaceWrite) {
      throw new Error("Codex cannot provide managed workspace-write for Work.");
    }
    const validation = requireModel(provider, binding.validation.model, binding.validation.reasoningEffort);
    const work = requireModel(provider, binding.work.model, binding.work.reasoningEffort);
    const supportedModels = provider.capabilities.models.map(({ id }) => id).sort();
    const content = {
      subject: { kind: "action" as const, actionId }, provider: "codex" as const,
      cliVersion: provider.cliVersion!, supportsReadOnly: true,
      supportsWorkspaceWrite: provider.capabilities.policy.workspaceWrite,
      roles: {
        validation: { ...binding.validation, supportedModels, supportedReasoningEfforts: [...validation.reasoningOptions].sort() },
        work: { ...binding.work, supportedModels, supportedReasoningEfforts: [...work.reasoningOptions].sort() }
      }
    };
    return { ...content, capabilitySha256: hash(content) };
  }

  private readyProvider(): LocalProviderStatus {
    const status = this.daemon.status();
    if (status.status !== "online") throw new Error(`Local daemon is ${status.status}.`);
    const provider = status.providers.find((candidate) => candidate.provider === "codex");
    if (!provider || provider.health !== "ready" || !provider.cliVersion) {
      throw new Error(provider?.healthMessage ?? "Codex is unavailable on the local daemon.");
    }
    return provider;
  }

  async execute(spec: ExecutionSpecV17, permissions: ProviderPermissionSpec): Promise<ProviderTerminal> {
    if (permissions.provider !== spec.runtime.provider || permissions.approvalPolicy !== spec.permissions.approvalPolicy) {
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
const requireModel = (provider: LocalProviderStatus, modelId: string, reasoningEffort: string) => {
  const model = provider.capabilities.models.find(({ id }) => id === modelId);
  if (!model) throw new Error(`Model ${modelId} is unavailable for ${provider.provider}.`);
  if (!model.reasoningOptions.includes(reasoningEffort)) throw new Error(`Reasoning effort ${reasoningEffort} is unavailable for ${modelId}.`);
  return model;
};
const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
