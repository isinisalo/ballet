// This orchestration facade intentionally exceeds 300 lines because it is the single
// transaction/event boundary over the focused control-plane stores and preflight service.
import { EventEmitter } from "node:events";
import { v4 as uuid } from "uuid";
import type { z } from "zod";
import type {
    daemonCancelBodySchema,
    daemonCompleteBodySchema,
    daemonEventBatchBodySchema,
    daemonFailBodySchema,
    daemonTaskStateBodySchema
} from "../../shared/api/runtime-schemas.js";
import type { Agent, AgentExecutionState } from "../../shared/domain/agents.js";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import { RuntimeIntentSourceError } from "../runtime-config/RuntimeIntentRepository.js";
import type {
    AgentRuntimeConfiguration,
    AgentRun,
    ExecutionAgentSnapshot,
    ExecutionPolicy,
    ResolvedAgentExecution,
    ExecutionSpec,
    ExecutionTask,
    RootFinalizationReport,
    RootRunDisposition,
    TaskDispositionResult
} from "../../shared/domain/runtime.js";
import type { AdminAuthStore } from "./AdminAuthStore.js";
import type { AgentExecutionStore } from "./AgentExecutionStore.js";
import type { ControlPlaneDatabase } from "./ControlPlaneDatabase.js";
import { ControlPlaneConflictError, ControlPlanePreflightError, ControlPlaneRuntimeConfigurationError } from "./errors.js";
import type { ExecutionEventStore } from "./ExecutionEventStore.js";
import type { ExecutionTaskStore, FencedTaskInput, TaskClaim } from "./ExecutionTaskStore.js";
import type { DaemonIdentity, DaemonPairingPoll, PairingStore } from "./PairingStore.js";
import type { ProjectStore, RegisteredProject } from "./ProjectStore.js";
import type { RootFinalizationStore } from "./RootFinalizationStore.js";
import type { LoopPreflightResult, RuntimePreflightService } from "./RuntimePreflightService.js";
import type { DaemonHeartbeat, RuntimeRegistryStore } from "./RuntimeRegistryStore.js";

type CompleteInput = z.infer<typeof daemonCompleteBodySchema>;
type FailInput = z.infer<typeof daemonFailBodySchema>;
type CancelInput = z.infer<typeof daemonCancelBodySchema>;
type StateInput = z.infer<typeof daemonTaskStateBodySchema>;
type EventBatchInput = z.infer<typeof daemonEventBatchBodySchema>;

export interface ControlPlaneServiceOptions {
  database: ControlPlaneDatabase;
  admin: AdminAuthStore;
  pairing: PairingStore;
  projects: ProjectStore;
  registry: RuntimeRegistryStore;
  agents: AgentExecutionStore;
  tasks: ExecutionTaskStore;
  events: ExecutionEventStore;
  finalizations: RootFinalizationStore;
  preflight: RuntimePreflightService;
  now: () => Date;
  leaseSeconds?: number;
  resolveAgentSnapshot?: (agentId: string) => Promise<ExecutionAgentSnapshot> | ExecutionAgentSnapshot;
  listAgentIds?: () => Promise<string[]> | string[];
  onTaskState?: (task: ExecutionTask) => Promise<void> | void;
  /** Must be idempotent by task.id; terminal daemon requests may be retried. */
  onTaskTerminal?: (task: ExecutionTask, run?: AgentRun) => Promise<RootRunDisposition | void> | RootRunDisposition | void;
  freshCheckoutBeforeRun?: boolean;
  freshCheckoutTimeoutMs?: number;
}

export class ControlPlaneService {
  private project?: RegisteredProject;
  private readonly changes = new EventEmitter();
  private readonly checkoutRefreshes = new Map<string, {
    requestId: string;
    promise: Promise<void>;
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  constructor(private readonly options: ControlPlaneServiceOptions) {
    this.changes.setMaxListeners(200);
  }

  registerProject(input: { id: string; repositoryUrl: string; checkoutPath: string }) {
    const project = this.options.projects.register(input);
    this.project = project;
    this.options.preflight.setProject(project);
    return project;
  }
  adminBootstrapped() { return this.options.admin.hasAdmin(); }
  bootstrapAdmin(password: string) { return this.options.admin.bootstrap(password); }
  loginAdmin(password: string) { return this.options.admin.createSession(password); }
  authenticateAdmin(session: string, csrf?: string) { return this.options.admin.authenticate(session, csrf); }
  logoutAdmin(session: string) { this.options.admin.revoke(session); }

  createPairing(displayName?: string) {
    const project = this.requireActiveProject();
    return this.options.pairing.create(project.id, displayName);
  }
  getPairing(id: string) { return this.options.pairing.get(id); }
  approvePairing(id: string) { return this.options.pairing.approve(id); }
  pollPairing(input: DaemonPairingPoll) { return this.options.pairing.poll(input); }
  authenticateDaemon(token: string) { return this.options.pairing.authenticateDaemon(token); }

  listDevices(search?: string, status?: "all" | "online" | "issues") { return this.options.registry.list(this.requireActiveProject().id, search, status); }
  getDevice(id: string) { return this.requireActiveDevice(id); }
  requestDeviceRefresh(id: string) {
    this.requireActiveDevice(id);
    const active = this.checkoutRefreshes.get(id);
    const requestId = active?.requestId ?? uuid();
    const device = this.options.registry.requestRefresh(id, requestId);
    this.emit("refresh_requested", { deviceId: id, requestId });
    return device;
  }
  requestDeviceRestart(id: string) { this.requireActiveDevice(id); const device = this.options.registry.requestRestart(id); this.emit("restart_requested", { deviceId: id }); return device; }
  deviceLogs(id: string, limit?: number) { this.requireActiveDevice(id); return this.options.registry.logs(id, limit); }
  appendDeviceDiagnostics(id: string, lines: string[]) { lines.forEach((line) => this.options.registry.appendLog(id, "info", line)); }
  async revokeDevice(id: string) {
    this.requireActiveDevice(id);
    this.options.pairing.revokeDevice(id);
    for (const task of this.options.tasks.markRuntimeLost(id, "Runtime device was revoked.")) {
      const run = this.syncRun(task, { errorCode: task.errorCode, errorMessage: task.errorMessage });
      await this.dispatchTerminal(task, run);
    }
    this.emit("runtime_changed", { deviceId: id });
  }

  heartbeat(identity: DaemonIdentity, input: DaemonHeartbeat) {
    const result = this.options.registry.heartbeat(identity.deviceId, input);
    if (input.checkout) this.options.projects.updateCheckout(identity.deviceId, input.checkout);
    if (input.recentError) this.options.registry.appendLog(identity.deviceId, "error", input.recentError);
    const refreshRequestId = this.options.registry.pendingRefreshRequestId(identity.deviceId);
    const refreshed = Boolean(refreshRequestId && input.checkout?.inspectionId === refreshRequestId);
    this.options.registry.acknowledgeRequests(identity.deviceId, { refresh: refreshed, restart: result.restartRequested });
    if (refreshed) this.resolveCheckoutRefresh(identity.deviceId, refreshRequestId!);
    this.emit("runtime_changed", { deviceId: identity.deviceId });
    return {
      ...result,
      refreshRequested: Boolean(refreshRequestId && !refreshed),
      refreshRequestId: refreshed ? undefined : refreshRequestId,
      device: this.options.registry.require(identity.deviceId),
      rootFinalizations: this.options.finalizations.pendingForDevice(identity.deviceId)
    };
  }

  getAgentRuntime(agentId: string): AgentRuntimeConfiguration {
    this.requireActiveProject();
    return this.options.preflight.configuration(agentId);
  }
  putAgentRuntime(agentId: string, input: {
    runtimeBackendId: string;
    model: string;
    reasoning: string;
    policy: ExecutionPolicy;
  }): AgentRuntimeConfiguration {
    const project = this.requireActiveProject();
    const backend = this.options.registry.getBackend(input.runtimeBackendId);
    if (!backend || backend.projectId !== project.id) throw new ControlPlaneConflictError("Runtime backend is not available in the active project.");
    const candidate: ResolvedAgentExecution = {
      projectId: project.id, agentId, runtimeBackendId: backend.id, deviceId: backend.deviceId,
      provider: backend.provider, model: input.model, reasoning: input.reasoning, policy: input.policy
    };
    const blocking = this.options.preflight.agent(agentId, candidate).issues
      .filter((issue) => ["model_unavailable", "reasoning_unavailable", "policy_unsupported", "provider_mismatch", "mixed_device"].includes(issue.code));
    if (blocking.length > 0) throw new ControlPlanePreflightError("Agent runtime configuration is not supported.", blocking);
    let saved: AgentRuntimeConfiguration;
    try {
      saved = this.options.preflight.putConfiguration(agentId, {
        provider: backend.provider,
        model: input.model,
        reasoning: input.reasoning,
        policy: { network: input.policy.network }
      }, {
        runtimeBackendId: backend.id,
        readOnlyRoots: input.policy.readOnlyRoots
      });
    } catch (error) {
      if (error instanceof RuntimeIntentSourceError) {
        throw new ControlPlaneRuntimeConfigurationError(error.message, error.issues);
      }
      throw error;
    }
    this.emit("runtime_changed", { agentId });
    return saved;
  }

  removeAgentRuntime(agentId: string): void {
    this.requireActiveProject();
    try {
      this.options.preflight.removeConfiguration(agentId);
    } catch (error) {
      if (error instanceof RuntimeIntentSourceError) {
        throw new ControlPlaneRuntimeConfigurationError(error.message, error.issues);
      }
      throw error;
    }
    this.emit("runtime_changed", { agentId });
  }

  async runtimeConfigurationIssues() {
    const ids = this.options.listAgentIds ? await this.options.listAgentIds() : this.options.preflight.configuredAgentIds();
    return this.options.preflight.configurationIssues(ids);
  }

  async executionStates(): Promise<AgentExecutionState[]> {
    this.requireActiveProject();
    const ids = this.options.listAgentIds ? await this.options.listAgentIds() : this.options.preflight.configuredAgentIds();
    return this.options.preflight.executionStates(ids);
  }

  preflightLoop(loop: Pick<ProjectLoop, "steps">): LoopPreflightResult { return this.options.preflight.loop(loop); }
  preflightAgent(agentId: string) { return this.options.preflight.agent(agentId); }

  async startAgentRun(agentId: string, input?: string, source: "manual" | "schedule" = "manual"): Promise<AgentRun> {
    const activeProject = this.requireActiveProject();
    await this.refreshExecutionSnapshots([agentId]);
    const check = this.options.preflight.agent(agentId);
    if (!check.ok || !check.runtime || !check.project) throw new ControlPlanePreflightError("Agent run preflight failed.", check.issues);
    if (!this.options.resolveAgentSnapshot) throw new ControlPlaneConflictError("Agent snapshot resolver is not configured.");
    const agent = await this.options.resolveAgentSnapshot(agentId);
    this.assertActiveProject(activeProject.id);
    const runId = uuid();
    const taskId = uuid();
    const timestamp = this.options.now().toISOString();
    const spec: ExecutionSpec = {
      version: 1, projectId: activeProject.id, taskId, kind: "agent_run", rootRunId: runId,
      agentRunId: runId, input, agent, runtime: check.runtime, project: check.project, createdAt: timestamp
    };
    const transaction = this.options.database.connection().transaction(() => {
      this.options.tasks.create(spec);
      return this.options.agents.createRun({ id: runId, projectId: spec.projectId, agentId, rootRunId: runId, source,
        taskId, runInput: input, runtime: spec.runtime, project: spec.project, createdAt: timestamp });
    });
    const run = transaction() as AgentRun;
    this.emit("task_available", { runtimeBackendId: spec.runtime.runtimeBackendId });
    return run;
  }

  async refreshExecutionSnapshots(agentIds: readonly string[]): Promise<void> {
    if (!this.options.freshCheckoutBeforeRun) return;
    const byDevice = new Map<string, string[]>();
    for (const agentId of [...new Set(agentIds)]) {
      const deviceId = this.options.preflight.agent(agentId).deviceId;
      if (!deviceId) continue;
      const device = this.options.registry.get(deviceId);
      if (!device || device.status !== "online") continue;
      const agents = byDevice.get(deviceId) ?? [];
      agents.push(agentId);
      byDevice.set(deviceId, agents);
    }
    await Promise.all([...byDevice].map(async ([deviceId, agents]) => {
      try {
        await this.refreshDeviceCheckout(deviceId);
      } catch (error) {
        throw new ControlPlanePreflightError("Runtime checkout refresh failed.", agents.map((agentId) => ({
          agentId,
          code: "offline" as const,
          message: error instanceof Error ? error.message : "Runtime did not return a fresh checkout snapshot."
        })));
      }
    }));
  }

  enqueueLoopStep(input: {
    rootRunId: string; loopRunId: string; stepRunId: string; agentId: string;
    input?: string; agentSnapshot: ExecutionAgentSnapshot;
  }): ExecutionTask {
    const check = this.options.preflight.agent(input.agentId);
    if (!check.ok || !check.runtime || !check.project) throw new ControlPlanePreflightError("Loop step preflight failed.", check.issues);
    const taskId = uuid();
    const spec: ExecutionSpec = {
      version: 1, projectId: this.requireActiveProject().id, taskId, kind: "loop_step", rootRunId: input.rootRunId,
      loopRunId: input.loopRunId, stepRunId: input.stepRunId, input: input.input, agent: input.agentSnapshot,
      runtime: check.runtime, project: check.project, createdAt: this.options.now().toISOString()
    };
    const task = this.options.tasks.create(spec);
    this.emit("task_available", { runtimeBackendId: spec.runtime.runtimeBackendId });
    return task;
  }

  createTask(spec: ExecutionSpec) { const task = this.options.tasks.create(spec); this.emit("task_available", { runtimeBackendId: task.runtimeBackendId }); return task; }
  getRun(id: string) { const run = this.options.agents.requireRun(id); this.assertActiveProject(run.projectId); return run; }
  latestRun(agentId: string) { return this.options.agents.latest(this.requireActiveProject().id, agentId); }
  getTask(id: string) { const task = this.options.tasks.require(id); this.assertActiveProject(task.projectId); return task; }
  backendDeviceId(id: string) { return this.options.registry.getBackend(id)?.deviceId; }

  claimTask(identity: DaemonIdentity, backendId: string): (TaskClaim & {
    leaseDurationMs: number;
    renewAfterMs: number;
  }) | undefined {
    const backend = this.options.registry.getBackend(backendId);
    const device = backend ? this.options.registry.get(backend.deviceId) : undefined;
    if (!backend || backend.deviceId !== identity.deviceId || backend.health !== "ready"
      || backend.authStatus !== "ready" || device?.status !== "online") {
      throw new ControlPlaneConflictError("Runtime backend cannot claim tasks.");
    }
    const transaction = this.options.database.connection().transaction(() => {
      const claim = this.options.tasks.claim(identity.deviceId, backendId, this.options.leaseSeconds);
      if (claim) this.syncRun(claim.task);
      return claim;
    });
    const claim = transaction() as TaskClaim | undefined;
    if (!claim) return undefined;
    const leaseDurationMs = (this.options.leaseSeconds ?? 60) * 1000;
    return { ...claim, leaseDurationMs, renewAfterMs: Math.max(1_000, Math.floor(leaseDurationMs / 3)) };
  }
  renewLease(identity: DaemonIdentity, taskId: string, body: { taskToken: string; fencing: number }) {
    const task = this.options.tasks.renew(this.fenced(identity, taskId, body), this.options.leaseSeconds);
    return { accepted: true, leaseUntil: task.leaseUntil, cancelRequested: Boolean(task.cancelRequestedAt) };
  }
  setTaskState(identity: DaemonIdentity, taskId: string, body: StateInput) {
    const transaction = this.options.database.connection().transaction(() => {
      const task = this.options.tasks.setState({ ...this.fenced(identity, taskId, body), status: body.status });
      this.syncRun(task);
      return task;
    });
    const task = transaction() as ExecutionTask;
    void this.options.onTaskState?.(task);
    this.emit("task_state", { taskId, status: task.status });
    return task;
  }
  appendEvents(identity: DaemonIdentity, taskId: string, body: EventBatchInput) {
    const transaction = this.options.database.connection().transaction(() => {
      this.options.tasks.assertFenced(this.fenced(identity, taskId, body));
      return this.options.events.appendBatch(taskId, body.events);
    });
    const result = transaction() as { accepted: number; lastSequence: number };
    this.emit("execution_event", { taskId });
    return result;
  }

  async completeTask(identity: DaemonIdentity, taskId: string, body: CompleteInput): Promise<ExecutionTask & TaskDispositionResult> {
    const transaction = this.options.database.connection().transaction(() => {
      const task = this.options.tasks.complete({ ...this.fenced(identity, taskId, body), outcome: body.outcome });
      const run = this.syncRun(task, { outcome: body.outcome, branch: body.branch, worktreePath: body.worktreePath });
      return { task, run };
    });
    const { task, run } = transaction() as { task: ExecutionTask; run?: AgentRun };
    const rootDisposition = await this.dispatchTerminal(task, run);
    this.authorizeRootFinalization(identity, task, body, rootDisposition);
    return { ...task, rootDisposition };
  }
  async failTask(identity: DaemonIdentity, taskId: string, body: FailInput): Promise<ExecutionTask & TaskDispositionResult> {
    const transaction = this.options.database.connection().transaction(() => {
      const task = this.options.tasks.fail({ ...this.fenced(identity, taskId, body), errorCode: body.errorCode, errorMessage: body.errorMessage });
      const run = this.syncRun(task, { errorCode: body.errorCode, errorMessage: body.errorMessage, worktreePath: body.worktreePath });
      return { task, run };
    });
    const { task, run } = transaction() as { task: ExecutionTask; run?: AgentRun };
    const rootDisposition = await this.dispatchTerminal(task, run);
    this.authorizeRootFinalization(identity, task, body, rootDisposition);
    return { ...task, rootDisposition };
  }
  async cancelClaimedTask(identity: DaemonIdentity, taskId: string, body: CancelInput): Promise<ExecutionTask & TaskDispositionResult> {
    const transaction = this.options.database.connection().transaction(() => {
      const task = this.options.tasks.cancelFenced(this.fenced(identity, taskId, body));
      const run = this.syncRun(task, { worktreePath: body.worktreePath });
      return { task, run };
    });
    const { task, run } = transaction() as { task: ExecutionTask; run?: AgentRun };
    const rootDisposition = await this.dispatchTerminal(task, run);
    this.authorizeRootFinalization(identity, task, body, rootDisposition);
    return { ...task, rootDisposition };
  }

  reportRootFinalization(identity: DaemonIdentity, rootRunId: string, body: {
    taskToken: string;
    fencing: number;
  } & RootFinalizationReport): void {
    const { taskToken, fencing, ...report } = body;
    const transaction = this.options.database.connection().transaction(() => {
      const result = this.options.finalizations.report(rootRunId, {
        deviceId: identity.deviceId,
        taskToken,
        fencing
      }, report);
      this.assertActiveProject(result.task.projectId);
      this.options.agents.applyRootFinalization(result.task, report);
      return result.task;
    });
    const task = transaction() as ExecutionTask;
    this.emit("root_finalized", { rootRunId, taskId: task.id, deviceId: identity.deviceId });
  }

  requestRootFinalization(input: {
    projectId: string;
    deviceId: string;
    rootRunId: string;
    success: boolean;
    snapshotHash: string;
  }): void {
    this.assertActiveProject(input.projectId);
    this.requireActiveDevice(input.deviceId);
    this.options.finalizations.authorizeRequested(
      input.projectId,
      input.deviceId,
      input.rootRunId,
      input.success,
      input.snapshotHash
    );
    this.emit("root_finalize_requested", input);
  }

  reportRequestedRootFinalization(identity: DaemonIdentity, rootRunId: string, body: {
    projectId: string;
  } & RootFinalizationReport): void {
    const { projectId, ...report } = body;
    this.assertActiveProject(projectId);
    const result = this.options.finalizations.reportRequested(projectId, identity.deviceId, rootRunId, report);
    if (result.task) this.options.agents.applyRootFinalization(result.task, report);
    this.emit("root_finalized", { rootRunId, taskId: result.task?.id, deviceId: identity.deviceId });
  }
  async cancelRun(runId: string): Promise<AgentRun> {
    this.getRun(runId);
    const transaction = this.options.database.connection().transaction(() => {
      const run = this.options.agents.requireRun(runId);
      const task = this.options.tasks.cancel(run.taskId);
      const updated = this.syncRun(task);
      return { task, updated };
    });
    const { task, updated } = transaction() as { task: ExecutionTask; updated?: AgentRun };
    if (task.status === "cancelled") await this.dispatchTerminal(task, updated);
    else this.emit("task_cancel_requested", { taskId: task.id, deviceId: task.deviceId });
    return this.options.agents.requireRun(runId);
  }

  async cancelTask(taskId: string): Promise<ExecutionTask> {
    const transaction = this.options.database.connection().transaction(() => {
      const task = this.options.tasks.cancel(taskId);
      const run = this.syncRun(task);
      return { task, run };
    });
    const { task, run } = transaction() as { task: ExecutionTask; run?: AgentRun };
    if (task.status === "cancelled") await this.dispatchTerminal(task, run);
    else this.emit("task_cancel_requested", { taskId: task.id, deviceId: task.deviceId });
    return task;
  }

  eventPage(taskId: string, after?: number, limit?: number) { this.getTask(taskId); return this.options.events.page(taskId, after, limit); }
  onChange(listener: (type: string, payload: Record<string, unknown>) => void) { this.changes.on("change", listener); return () => this.changes.off("change", listener); }

  async markOfflineRuntimes(offlineBefore: string): Promise<string[]> {
    const devices = this.options.registry.markOffline(offlineBefore);
    for (const deviceId of devices) {
      for (const task of this.options.tasks.markRuntimeLost(deviceId, "Runtime heartbeat was lost.")) {
        const run = this.syncRun(task, { errorCode: task.errorCode, errorMessage: task.errorMessage });
        await this.dispatchTerminal(task, run);
      }
    }
    return devices;
  }

  async sweepExpiredLeases(expiredBefore = this.options.now().toISOString()): Promise<ExecutionTask[]> {
    const tasks = this.options.tasks.sweepExpiredLeases(expiredBefore);
    for (const task of tasks) {
      const run = this.syncRun(task, { errorCode: task.errorCode, errorMessage: task.errorMessage });
      await this.dispatchTerminal(task, run);
    }
    return tasks;
  }

  private fenced(identity: DaemonIdentity, taskId: string, body: { taskToken: string; fencing: number }): FencedTaskInput {
    return { deviceId: identity.deviceId, taskId, taskToken: body.taskToken, fencing: body.fencing };
  }
  private syncRun(task: ExecutionTask, detail?: Parameters<AgentExecutionStore["syncTask"]>[1]): AgentRun | undefined {
    this.options.agents.syncTask(task, detail);
    return task.spec.agentRunId ? this.options.agents.getRun(task.spec.agentRunId) : undefined;
  }
  private async dispatchTerminal(task: ExecutionTask, run?: AgentRun): Promise<RootRunDisposition | undefined> {
    const disposition = await this.options.onTaskTerminal?.(task, run)
      ?? (task.kind === "agent_run" ? {
        terminal: true,
        success: task.status === "succeeded"
          && (task.outcome?.outcome === "ready" || task.outcome?.outcome === "approved")
      } : undefined);
    this.emit("task_terminal", { taskId: task.id });
    return disposition;
  }
  private authorizeRootFinalization(
    identity: DaemonIdentity,
    task: ExecutionTask,
    body: { taskToken: string; fencing: number },
    disposition?: RootRunDisposition
  ): void {
    if (!disposition?.terminal) return;
    this.options.finalizations.authorize(task, {
      deviceId: identity.deviceId,
      taskToken: body.taskToken,
      fencing: body.fencing
    }, disposition);
  }
  private emit(type: string, payload: Record<string, unknown>) { this.changes.emit("change", type, payload); }
  private refreshDeviceCheckout(deviceId: string): Promise<void> {
    const active = this.checkoutRefreshes.get(deviceId);
    if (active) return active.promise;
    const requestId = uuid();
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((accept, decline) => { resolve = accept; reject = decline; });
    const timer = setTimeout(() => {
      const current = this.checkoutRefreshes.get(deviceId);
      if (current?.requestId !== requestId) return;
      this.checkoutRefreshes.delete(deviceId);
      reject(new Error("Runtime did not return a fresh checkout snapshot before Start timed out."));
    }, this.options.freshCheckoutTimeoutMs ?? 30_000);
    timer.unref();
    this.checkoutRefreshes.set(deviceId, { requestId, promise, resolve, reject, timer });
    this.options.registry.requestRefresh(deviceId, requestId);
    this.emit("refresh_requested", { deviceId, requestId });
    return promise;
  }
  private resolveCheckoutRefresh(deviceId: string, requestId: string): void {
    const current = this.checkoutRefreshes.get(deviceId);
    if (!current || current.requestId !== requestId) return;
    clearTimeout(current.timer);
    this.checkoutRefreshes.delete(deviceId);
    current.resolve();
  }
  private requireActiveProject() { const project = this.project ?? this.options.projects.active(); if (!project) throw new ControlPlaneConflictError("No active project is registered."); return project; }
  private requireActiveDevice(id: string) {
    const device = this.options.registry.require(id);
    if (device.projectId !== this.requireActiveProject().id) throw new ControlPlaneConflictError("Runtime device is not in the active project.");
    return device;
  }
  private assertActiveProject(projectId: string) {
    if (projectId !== this.requireActiveProject().id) throw new ControlPlaneConflictError("Resource is not in the active project.");
  }
}

export const agentSnapshotFromAgent = (agent: Agent, configHash: string): ExecutionAgentSnapshot => ({
  id: agent.id, name: agent.name, description: agent.description, instructions: agent.instructions,
  skillIds: agent.skills.map((skill) => skill.id), ...(agent.avatar ? { avatar: agent.avatar } : {}), configHash
});
