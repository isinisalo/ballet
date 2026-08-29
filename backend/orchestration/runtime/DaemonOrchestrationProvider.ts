import { v5 as uuidv5 } from "uuid";
import type { AgentDefinition } from "../../../shared/orchestration/environment.js";
import type { ExecutionSpecV13 } from "../../../shared/orchestration/execution.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/orchestration/primitives.js";
import type { RuntimeCapabilitySnapshot } from "../../../shared/orchestration/runtime.js";
import type { ExecutionSpec, ExecutionTask } from "../../../shared/domain/runtime.js";
import type { ControlPlaneService } from "../../control-plane/ControlPlaneService.js";
import type { OrchestrationProviderPreflightPort } from "./EnvironmentRunPlanner.js";
import type { ProviderPermissionSpec } from "./ProviderPermissions.js";
import type { OrchestrationRuntimeProvider, ProviderTerminal } from "./RuntimeProvider.js";

const ORCHESTRATION_NAMESPACE = "936ecb7b-4279-5a50-9f58-5a9ea67cfc16";
const DAEMON_TASK_TIMEOUT_MS = 30 * 60_000;

export class DaemonOrchestrationProvider implements OrchestrationRuntimeProvider, OrchestrationProviderPreflightPort {
  constructor(private readonly controlPlane: ControlPlaneService, private readonly projectId: string) {}

  async inspect(agent: AgentDefinition, project: { headSha: string; configHash: string }): Promise<RuntimeCapabilitySnapshot> {
    await this.controlPlane.refreshExecutionSnapshots([agent.id]);
    const result = this.controlPlane.preflightAgent(agent.id);
    if (!result.ok || !result.runtime || !result.project) {
      throw new Error(result.issues.map(({ message }) => message).join("; ") || `Agent ${agent.id} runtime is unavailable.`);
    }
    if (result.project.headSha !== project.headSha || result.project.configHash !== project.configHash) {
      throw new Error(`Agent ${agent.id} daemon checkout does not match the current project HEAD and Project Config.`);
    }
    const device = this.controlPlane.getDevice(result.runtime.deviceId);
    const backend = device.backends.find(({ id }) => id === result.runtime!.runtimeBackendId);
    if (!backend) throw new Error(`Agent ${agent.id} runtime backend disappeared during preflight.`);
    const binding = this.controlPlane.getBinding(agent.id);
    if (!binding) throw new Error(`Agent ${agent.id} has no execution binding.`);
    const supportedModels = backend.capabilities.models.map(({ id }) => id).sort();
    const supportedReasoningEfforts = [...new Set(backend.capabilities.models.flatMap(({ reasoningOptions }) => reasoningOptions))].sort();
    if (supportedReasoningEfforts.length === 0) supportedReasoningEfforts.push("provider-default");
    const content = {
      agentId: agent.id, deviceId: result.runtime.deviceId, runtimeBackendId: result.runtime.runtimeBackendId,
      provider: result.runtime.provider, model: result.runtime.model, reasoningEffort: result.runtime.reasoning,
      networkAccess: binding.policy.network, readOnlyRoots: binding.policy.readOnlyRoots,
      cliVersion: result.runtime.cliVersion, supportedModels, supportedReasoningEfforts,
      supportsReadOnly: true, supportsWorkspaceWrite: backend.capabilities.policy.workspaceWrite
    };
    return { ...content, capabilitySha256: hash(content) };
  }

  async execute(spec: ExecutionSpecV13, permissions: ProviderPermissionSpec): Promise<ProviderTerminal> {
    await this.controlPlane.refreshExecutionSnapshots([spec.runtime.agentId]);
    const check = this.controlPlane.preflightAgent(spec.runtime.agentId);
    if (!check.ok || !check.runtime || !check.project) {
      return failure(spec, check.issues.map(({ message }) => message).join("; ") || "Daemon runtime preflight failed.");
    }
    if (check.runtime.deviceId !== spec.runtime.deviceId || check.runtime.runtimeBackendId !== spec.runtime.runtimeBackendId
      || check.runtime.provider !== spec.runtime.provider || check.runtime.model !== spec.runtime.model
      || check.runtime.reasoning !== spec.runtime.reasoningEffort) {
      return failure(spec, "Agent execution binding changed after the immutable Environment snapshot.");
    }
    if (check.project.headSha !== spec.project.headSha) return failure(spec, "Daemon checkout HEAD differs from the immutable Environment snapshot.");
    const taskId = taskUuid(spec.taskId);
    const rootRunId = rootUuid(spec.environmentRunId);
    const daemonSpec: ExecutionSpec = {
      version: 1,
      projectId: this.projectId,
      taskId,
      kind: "loop_step",
      rootRunId,
      input: spec.evidence.prompt,
      workspaceAccess: permissions.sandbox,
      agent: {
        id: spec.runtime.agentId,
        name: spec.evidence.agent.name,
        description: spec.evidence.agent.description,
        instructions: daemonEnvelopeInstruction(spec),
        skillIds: [...spec.evidence.agent.skillResources],
        configHash: spec.project.configHash
      },
      runtime: { ...check.runtime, policy: { network: permissions.networkAccess, readOnlyRoots: [] } },
      project: check.project,
      createdAt: spec.createdAt
    };
    const existing = optionalTask(this.controlPlane, taskId);
    if (!existing) this.controlPlane.createTask(daemonSpec);
    let terminal: ExecutionTask;
    try {
      terminal = await waitForTerminal(this.controlPlane, taskId);
    } catch (error) {
      return failure(spec, error instanceof Error ? error.message : "Daemon task timed out.");
    }
    if (terminal.status !== "succeeded" || !terminal.outcome) {
      return failure(spec, terminal.errorMessage ?? `Daemon task ended in ${terminal.status}.`);
    }
    return { kind: "output", providerOutcomeKey: `${terminal.runtimeBackendId}:${terminal.id}`, raw: terminal.outcome.summary };
  }

  async cancel(taskId: string): Promise<void> {
    const existing = optionalTask(this.controlPlane, taskUuid(taskId));
    if (existing && !["succeeded", "failed", "cancelled"].includes(existing.status)) {
      await this.controlPlane.cancelTask(existing.id);
    }
  }
}

export const daemonRootRunId = (value: string): string => rootUuid(value);

const daemonEnvelopeInstruction = (spec: ExecutionSpecV13): string => `You are the ${spec.evidence.role} Agent in Ballet's immutable Environment Run. The task prompt requires one role-outcome JSON object. Perform the task, then return the daemon envelope. Set outcome to "ready", set summary to a JSON-serialized string containing exactly that required role-outcome object, and set checks to an array. Do not put prose outside that nested JSON string.`;
const failure = (spec: ExecutionSpecV13, errorMessage: string): ProviderTerminal => ({ kind: "failure", providerOutcomeKey: `daemon:${spec.taskId}`, errorMessage });
const taskUuid = (value: string): string => uuidv5(`task:${value}`, ORCHESTRATION_NAMESPACE);
const rootUuid = (value: string): string => uuidv5(`root:${value}`, ORCHESTRATION_NAMESPACE);
const hash = (value: unknown): string => sha256(canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue));
const optionalTask = (service: ControlPlaneService, id: string): ExecutionTask | undefined => {
  try { return service.getTask(id); } catch { return undefined; }
};
const waitForTerminal = (service: ControlPlaneService, taskId: string): Promise<ExecutionTask> => new Promise((resolve, reject) => {
  let settled = false;
  const cleanup = (): void => { clearTimeout(timer); unsubscribe(); };
  const settle = (): boolean => {
    const task = service.getTask(taskId);
    if (!["succeeded", "failed", "cancelled"].includes(task.status)) return false;
    settled = true; cleanup(); resolve(task); return true;
  };
  const unsubscribe = service.onChange((_type, payload) => { if (payload.taskId === taskId) settle(); });
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true; cleanup(); reject(new Error(`Daemon task ${taskId} did not finish within 30 minutes.`));
  }, DAEMON_TASK_TIMEOUT_MS);
  settle();
});
