import type { ProjectLoop } from "../../shared/domain/automation.js";
import type {
  AgentExecutionBinding,
  ExecutionProjectSnapshot,
  ExecutionRuntimeSnapshot,
  RuntimeBackend,
  RuntimePreflightIssue
} from "../../shared/domain/runtime.js";
import { valueHash } from "./crypto.js";
import type { AgentExecutionStore } from "./AgentExecutionStore.js";
import type { ProjectStore, RegisteredProject } from "./ProjectStore.js";
import type { RuntimeRegistryStore } from "./RuntimeRegistryStore.js";

export interface AgentPreflightResult {
  ok: boolean;
  deviceId?: string;
  issues: RuntimePreflightIssue[];
  runtime?: ExecutionRuntimeSnapshot;
  project?: ExecutionProjectSnapshot;
}

export interface LoopPreflightResult {
  ok: boolean;
  deviceId?: string;
  issues: RuntimePreflightIssue[];
  snapshots: Array<{ stepId: string; agentId: string; runtime: ExecutionRuntimeSnapshot }>;
}

export class RuntimePreflightService {
  constructor(
    private readonly projects: ProjectStore,
    private readonly registry: RuntimeRegistryStore,
    private readonly agents: AgentExecutionStore
  ) {}

  agent(agentId: string, bindingOverride?: AgentExecutionBinding): AgentPreflightResult {
    const project = this.projects.active();
    if (!project) return failure(agentId, "offline", "No active project is registered.");
    const binding = bindingOverride ?? this.agents.getBinding(project.id, agentId);
    if (!binding) return failure(agentId, "unbound", "Agent has no execution runtime binding.");
    const backend = this.registry.getBackend(binding.runtimeBackendId);
    const issues = this.backendIssues(agentId, binding, backend);
    const device = backend ? this.registry.get(backend.deviceId) : undefined;
    const projectSnapshot = device ? this.projectSnapshot(project, device.id, agentId, issues) : undefined;
    const runtime = backend && device && issues.every((issue) => !["offline", "auth_required", "backend_unhealthy", "model_unavailable", "reasoning_unavailable", "policy_unsupported", "mixed_device"].includes(issue.code))
      ? runtimeSnapshot(backend, device.displayName, binding)
      : undefined;
    return { ok: issues.length === 0, deviceId: device?.id, issues, runtime, project: projectSnapshot };
  }

  loop(loop: Pick<ProjectLoop, "steps">): LoopPreflightResult {
    const issues: RuntimePreflightIssue[] = [];
    const snapshots: LoopPreflightResult["snapshots"] = [];
    const deviceIds = new Set<string>();
    for (const step of loop.steps) {
      if (step.type !== "agent") continue;
      const result = this.agent(step.agentId);
      issues.push(...result.issues.map((issue) => ({ ...issue, stepId: step.id })));
      if (result.runtime) {
        snapshots.push({ stepId: step.id, agentId: step.agentId, runtime: result.runtime });
        deviceIds.add(result.runtime.deviceId);
      }
    }
    if (deviceIds.size > 1) {
      for (const snapshot of snapshots) {
        issues.push({
          agentId: snapshot.agentId,
          stepId: snapshot.stepId,
          code: "mixed_device",
          message: "Every agent step in a loop run must use a runtime on the same device."
        });
      }
    }
    return {
      ok: issues.length === 0,
      deviceId: deviceIds.size === 1 ? [...deviceIds][0] : undefined,
      issues,
      snapshots
    };
  }

  private backendIssues(
    agentId: string,
    binding: AgentExecutionBinding,
    backend: RuntimeBackend | undefined
  ): RuntimePreflightIssue[] {
    const issues: RuntimePreflightIssue[] = [];
    const add = (code: RuntimePreflightIssue["code"], message: string) => issues.push({ agentId, code, message });
    if (!backend) {
      add("offline", "Bound runtime backend does not exist.");
      return issues;
    }
    const device = this.registry.get(backend.deviceId);
    if (!device || device.status !== "online") add("offline", "Bound runtime device is offline.");
    if (backend.authStatus !== "ready") add("auth_required", "Runtime CLI authentication is not ready.");
    if (backend.health !== "ready") add("backend_unhealthy", backend.healthMessage ?? `Runtime backend health is ${backend.health}.`);
    if (!backend.cliVersion) add("backend_unhealthy", "Runtime backend did not report an exact CLI version.");
    const model = backend.capabilities.models.find((candidate) => candidate.id === binding.model);
    if (!model) add("model_unavailable", `Model ${binding.model} is not available on the exact runtime backend.`);
    else {
      const reasoningAvailable = model.reasoningOptions.length === 0
        ? binding.reasoning === "provider-default"
        : model.reasoningOptions.includes(binding.reasoning);
      if (!reasoningAvailable) add("reasoning_unavailable", `Reasoning option ${binding.reasoning} is not available for ${binding.model}.`);
    }
    if (!backend.capabilities.policy.workspaceWrite
      || (binding.policy.network && !backend.capabilities.policy.networkControl)
      || (binding.policy.readOnlyRoots.length > 0 && !backend.capabilities.policy.readOnlyRoots)) {
      add("policy_unsupported", "Runtime backend cannot enforce the selected execution policy.");
    }
    return issues;
  }

  private projectSnapshot(project: RegisteredProject, deviceId: string, agentId: string, issues: RuntimePreflightIssue[]): ExecutionProjectSnapshot | undefined {
    const checkout = this.projects.checkout(project.id, deviceId);
    if (!checkout || !checkout.headSha || !checkout.configHash) {
      issues.push({ agentId, code: "offline", message: "Runtime checkout has not reported an immutable head and config hash." });
      return undefined;
    }
    if (checkout.dirty) issues.push({ agentId, code: "dirty_checkout", message: "Runtime checkout has uncommitted changes." });
    const base = {
      checkoutId: checkout.id,
      repositoryUrl: checkout.repositoryUrl,
      headSha: checkout.headSha,
      configHash: checkout.configHash
    };
    return { ...base, snapshotHash: checkout.configHash };
  }
}

const runtimeSnapshot = (backend: RuntimeBackend, deviceName: string, binding: AgentExecutionBinding): ExecutionRuntimeSnapshot => ({
  deviceId: backend.deviceId,
  deviceName,
  runtimeBackendId: backend.id,
  provider: backend.provider,
  cliVersion: backend.cliVersion!,
  model: binding.model,
  reasoning: binding.reasoning,
  policy: binding.policy,
  capabilityHash: valueHash(backend.capabilities)
});

const failure = (agentId: string, code: RuntimePreflightIssue["code"], message: string): AgentPreflightResult => ({
  ok: false,
  issues: [{ agentId, code, message }]
});
