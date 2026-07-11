import type { AgentExecutionState } from "../../shared/domain/agents.js";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeConfiguration,
  ExecutionProjectSnapshot,
  ExecutionRuntimeSnapshot,
  PortableAgentRuntimeIntent,
  ResolvedAgentExecution,
  RuntimeBackend,
  RuntimeConfigurationIssue,
  RuntimePreflightIssue
} from "../../shared/domain/runtime.js";
import { RuntimeIntentRepository } from "../runtime-config/RuntimeIntentRepository.js";
import type { AgentExecutionStore } from "./AgentExecutionStore.js";
import { valueHash } from "./crypto.js";
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
  private project?: RegisteredProject;

  constructor(
    private readonly projects: ProjectStore,
    private readonly registry: RuntimeRegistryStore,
    private readonly agents: AgentExecutionStore,
    private readonly intents = new RuntimeIntentRepository()
  ) {}

  setProject(project: RegisteredProject): void {
    this.project = project;
  }

  configuration(agentId: string): AgentRuntimeConfiguration {
    const project = this.activeProject();
    if (!project) return { issues: [missingAttachment(agentId, "No active project is registered.")] };
    const loaded = this.intents.load(project.checkoutPath);
    const attachment = this.agents.getAttachment(project.id, agentId);
    if (!loaded.config) return { attachment, issues: loaded.issues };
    const intent = loaded.config.agents[agentId];
    const issues: RuntimeConfigurationIssue[] = [];
    if (!intent) issues.push({
      code: "missing_intent",
      path: `agents.${agentId}`,
      agentId,
      message: "Agent has no portable runtime intent in .ballet/runtime.json."
    });
    if (!attachment) issues.push(missingAttachment(agentId, "No compatible computer is attached on this machine."));
    const resolved = intent && attachment
      ? this.resolve(project, agentId, intent, attachment, issues)
      : undefined;
    return { intent, attachment, resolved, issues };
  }

  configurationIssues(agentIds: readonly string[]): RuntimeConfigurationIssue[] {
    const project = this.activeProject();
    if (!project) return [missingAttachment("*", "No active project is registered.")];
    const loaded = this.intents.load(project.checkoutPath);
    if (!loaded.config) return loaded.issues;
    const known = new Set(agentIds);
    const issues = agentIds.flatMap((agentId) => this.configuration(agentId).issues);
    for (const agentId of Object.keys(loaded.config.agents)) {
      if (!known.has(agentId)) issues.push({
        code: "orphan_intent",
        path: `agents.${agentId}`,
        agentId,
        message: `Runtime intent ${agentId} has no matching agent and was left unchanged.`
      });
    }
    for (const agentId of this.agents.attachedAgentIds(project.id)) {
      if (!known.has(agentId)) issues.push({
        code: "orphan_attachment",
        path: `attachments.${agentId}`,
        agentId,
        message: `Local runtime attachment ${agentId} has no matching agent.`
      });
    }
    return issues;
  }

  configuredAgentIds(): string[] {
    const project = this.activeProject();
    if (!project) return [];
    const loaded = this.intents.load(project.checkoutPath);
    return [...new Set([
      ...Object.keys(loaded.config?.agents ?? {}),
      ...this.agents.attachedAgentIds(project.id)
    ])].sort();
  }

  putConfiguration(
    agentId: string,
    intent: PortableAgentRuntimeIntent,
    attachment: Pick<AgentRuntimeAttachment, "runtimeBackendId" | "readOnlyRoots">
  ): AgentRuntimeConfiguration {
    const project = this.activeProject();
    if (!project) return { issues: [missingAttachment(agentId, "No active project is registered.")] };
    this.intents.put(project.checkoutPath, agentId, intent);
    this.agents.putAttachment({ projectId: project.id, agentId, ...attachment });
    return this.configuration(agentId);
  }

  removeConfiguration(agentId: string): void {
    const project = this.activeProject();
    if (!project) return;
    this.intents.remove(project.checkoutPath, agentId);
    this.agents.removeAttachment(project.id, agentId);
  }

  executionStates(agentIds: readonly string[]): AgentExecutionState[] {
    return agentIds.map((agentId) => {
      const configuration = this.configuration(agentId);
      return this.agents.executionState(agentId, configuration.resolved, configuration.issues[0]?.message);
    });
  }

  agent(agentId: string, executionOverride?: ResolvedAgentExecution): AgentPreflightResult {
    const project = this.activeProject();
    if (!project) return failure(agentId, "offline", "No active project is registered.");
    const configuration = executionOverride ? undefined : this.configuration(agentId);
    const execution = executionOverride ?? configuration?.resolved;
    if (!execution) {
      const issues = configuration?.issues.map((issue) => toPreflightIssue(issue, agentId)) ?? [];
      return issues.length > 0 ? { ok: false, issues } : failure(agentId, "unbound", "Agent runtime is not configured.");
    }
    const backend = this.registry.getBackend(execution.runtimeBackendId);
    const issues = this.backendIssues(agentId, execution, backend);
    const device = backend ? this.registry.get(backend.deviceId) : undefined;
    const projectSnapshot = device ? this.projectSnapshot(project, device.id, agentId, issues) : undefined;
    const runtime = backend && device && issues.every((issue) => !blockingRuntimeCodes.has(issue.code))
      ? runtimeSnapshot(backend, device.displayName, execution)
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
      for (const snapshot of snapshots) issues.push({
        agentId: snapshot.agentId,
        stepId: snapshot.stepId,
        code: "mixed_device",
        message: "Every agent step in a loop run must use a runtime on the same device."
      });
    }
    return { ok: issues.length === 0, deviceId: deviceIds.size === 1 ? [...deviceIds][0] : undefined, issues, snapshots };
  }

  private resolve(
    project: RegisteredProject,
    agentId: string,
    intent: PortableAgentRuntimeIntent,
    attachment: AgentRuntimeAttachment,
    issues: RuntimeConfigurationIssue[]
  ): ResolvedAgentExecution | undefined {
    const backend = this.registry.getBackend(attachment.runtimeBackendId);
    if (!backend || backend.projectId !== project.id) {
      issues.push({
        code: "attachment_backend_missing",
        path: `attachments.${agentId}.runtimeBackendId`,
        agentId,
        message: "Attached runtime backend is not available in the active project."
      });
      return undefined;
    }
    if (backend.provider !== intent.provider) {
      issues.push({
        code: "provider_mismatch",
        path: `agents.${agentId}.provider`,
        agentId,
        message: `Portable provider ${intent.provider} does not match attached backend provider ${backend.provider}.`
      });
      return undefined;
    }
    return {
      projectId: project.id,
      agentId,
      runtimeBackendId: backend.id,
      deviceId: backend.deviceId,
      provider: intent.provider,
      model: intent.model,
      reasoning: intent.reasoning,
      policy: { network: intent.policy.network, readOnlyRoots: attachment.readOnlyRoots }
    };
  }

  private backendIssues(agentId: string, execution: ResolvedAgentExecution, backend?: RuntimeBackend): RuntimePreflightIssue[] {
    const issues: RuntimePreflightIssue[] = [];
    const add = (code: RuntimePreflightIssue["code"], message: string) => issues.push({ agentId, code, message });
    if (!backend) { add("offline", "Attached runtime backend does not exist."); return issues; }
    const device = this.registry.get(backend.deviceId);
    if (!device || device.status !== "online") add("offline", "Attached runtime device is offline.");
    if (backend.authStatus !== "ready") add("auth_required", "Runtime CLI authentication is not ready.");
    if (backend.health !== "ready") add("backend_unhealthy", backend.healthMessage ?? `Runtime backend health is ${backend.health}.`);
    if (!backend.cliVersion) add("backend_unhealthy", "Runtime backend did not report an exact CLI version.");
    const model = backend.capabilities.models.find((candidate) => candidate.id === execution.model);
    if (!model) add("model_unavailable", `Model ${execution.model} is not available on the exact runtime backend.`);
    else {
      const available = model.reasoningOptions.length === 0
        ? execution.reasoning === "provider-default"
        : model.reasoningOptions.includes(execution.reasoning);
      if (!available) add("reasoning_unavailable", `Reasoning option ${execution.reasoning} is not available for ${execution.model}.`);
    }
    if (!backend.capabilities.policy.workspaceWrite
      || (execution.policy.network && !backend.capabilities.policy.networkControl)
      || (execution.policy.readOnlyRoots.length > 0 && !backend.capabilities.policy.readOnlyRoots)) {
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
    return {
      checkoutId: checkout.id,
      repositoryUrl: checkout.repositoryUrl,
      headSha: checkout.headSha,
      configHash: checkout.configHash,
      snapshotHash: checkout.configHash
    };
  }

  private activeProject(): RegisteredProject | undefined {
    return this.project ?? this.projects.active();
  }
}

const blockingRuntimeCodes = new Set<RuntimePreflightIssue["code"]>([
  "offline", "auth_required", "backend_unhealthy", "model_unavailable", "reasoning_unavailable",
  "policy_unsupported", "provider_mismatch", "mixed_device", "invalid_runtime_config"
]);

const runtimeSnapshot = (backend: RuntimeBackend, deviceName: string, execution: ResolvedAgentExecution): ExecutionRuntimeSnapshot => ({
  deviceId: backend.deviceId,
  deviceName,
  runtimeBackendId: backend.id,
  provider: backend.provider,
  cliVersion: backend.cliVersion!,
  model: execution.model,
  reasoning: execution.reasoning,
  policy: execution.policy,
  capabilityHash: valueHash(backend.capabilities)
});

const toPreflightIssue = (issue: RuntimeConfigurationIssue, fallbackAgentId: string): RuntimePreflightIssue => ({
  agentId: issue.agentId ?? fallbackAgentId,
  code: issue.code === "provider_mismatch"
    ? "provider_mismatch"
    : issue.code === "invalid_json" || issue.code === "invalid_schema"
      ? "invalid_runtime_config"
      : "unbound",
  message: issue.message
});

const missingAttachment = (agentId: string, message: string): RuntimeConfigurationIssue => ({
  code: "missing_attachment",
  path: `attachments.${agentId}`,
  agentId,
  message
});

const failure = (agentId: string, code: RuntimePreflightIssue["code"], message: string): AgentPreflightResult => ({
  ok: false,
  issues: [{ agentId, code, message }]
});
