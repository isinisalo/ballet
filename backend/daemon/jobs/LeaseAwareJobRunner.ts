import { z } from "zod";
import { agentOutcomeSchema } from "../../../shared/api/runtime-schemas.js";
import type { AgentOutcome, ExecutionSpec, RuntimeProvider } from "../../../shared/domain/runtime.js";
import type { GitWorkspaceManager } from "../git/GitWorkspaceManager.js";
import type { PreparedGitWorkspace } from "../git/GitWorkspaceTypes.js";
import type { CliRuntimeAdapter, RuntimeEvent, RuntimePermissionPolicy } from "../providers/CliRuntimeAdapter.js";
import type { ClaimedExecutionTask, DaemonControlPlane, TaskDispositionResult } from "../transport/DaemonControlPlane.js";
import { DaemonTransportError } from "../transport/HttpWsDaemonTransport.js";
import { runtimeEventToUpload } from "./runtimeEventUpload.js";
import { validateExecutionClaim } from "./ExecutionClaimValidator.js";
import { WorkspacePermissionPolicy } from "./WorkspacePermissionPolicy.js";

export class LeaseLostError extends Error {
  constructor(message = "Execution lease was lost.") {
    super(message);
    this.name = "LeaseLostError";
  }
}

export class TaskCancelledError extends Error {
  constructor(message = "Execution was cancelled by the control plane.") {
    super(message);
    this.name = "TaskCancelledError";
  }
}

interface ActiveExecution {
  controller: AbortController;
  adapter: CliRuntimeAdapter;
  cancellation?: TaskCancelledError;
}

export interface LeaseAwareJobRunnerOptions {
  deviceId: string;
  adapters: readonly CliRuntimeAdapter[];
  runtimeBackends: ReadonlyArray<{ id: string; provider: RuntimeProvider }>;
  transport: DaemonControlPlane;
  git: GitWorkspaceManager;
  permissionPolicy?: RuntimePermissionPolicy;
}

export class LeaseAwareJobRunner {
  private readonly adapters: Map<RuntimeProvider, CliRuntimeAdapter>;
  private readonly active = new Map<string, ActiveExecution>();

  constructor(private readonly options: LeaseAwareJobRunnerOptions) {
    this.adapters = new Map(options.adapters.map((adapter) => [adapter.provider, adapter]));
  }

  async run(claim: ClaimedExecutionTask): Promise<void> {
    const spec = validateExecutionClaim(claim, this.options.deviceId, this.options.runtimeBackends);
    const adapter = this.adapters.get(spec.runtime.provider);
    if (!adapter) throw new Error(`No ${spec.runtime.provider} runtime adapter is configured.`);
    const controller = new AbortController();
    const active: ActiveExecution = { controller, adapter };
    this.active.set(claim.task.id, active);
    let workspace: PreparedGitWorkspace | undefined;
    let leaseFailure: LeaseLostError | undefined;
    let taskSettled = false;
    const stopLease = new AbortController();
    const leaseLoop = this.renewLease(
      claim,
      stopLease.signal,
      async (error) => {
        leaseFailure = error;
        controller.abort(error);
        await adapter.cancel(claim.task.id, error.message);
      },
      async (error) => this.cancelActive(claim.task.id, error)
    );
    try {
      await this.verifyRuntimePolicy(adapter, spec, controller.signal);
      await this.options.transport.setTaskState(claim, "preparing", controller.signal);
      workspace = await this.options.git.prepare({
        executionId: claim.task.id,
        rootRunId: spec.rootRunId,
        projectId: spec.projectId,
        repositoryUrl: spec.project.repositoryUrl,
        headSha: spec.project.headSha,
        expectedSnapshotHash: spec.project.snapshotHash
      }, controller.signal);
      await this.options.transport.setTaskState(claim, "running", controller.signal);
      const result = await this.executeAdapter(adapter, claim, spec, workspace, controller.signal);
      if (active.cancellation) throw active.cancellation;
      if (leaseFailure) throw leaseFailure;
      const disposition = await this.options.transport.complete(claim, {
        outcome: withBranchArtifact(result.outcome, workspace.branch),
        branch: workspace.branch,
        worktreePath: workspace.path
      }, controller.signal);
      stopLease.abort();
      await leaseLoop;
      if (active.cancellation) throw active.cancellation;
      taskSettled = true;
      await this.applyRootDisposition(claim, spec, workspace, disposition, controller.signal);
    } catch (error) {
      stopLease.abort();
      await leaseLoop.catch(() => undefined);
      if (isCancellationConflict(error)) active.cancellation ??= new TaskCancelledError();
      const failure = active.cancellation ?? leaseFailure ?? (error instanceof Error ? error : new Error(String(error)));
      if (taskSettled) {
        if (workspace) await this.options.git.release(workspace).catch(() => undefined);
      } else if (failure instanceof TaskCancelledError) {
        const disposition = await this.options.transport.cancel(claim, { worktreePath: workspace?.path }).catch(() => undefined);
        taskSettled = Boolean(disposition);
        if (workspace && disposition) await this.applyRootDisposition(claim, spec, workspace, disposition).catch(() => this.options.git.release(workspace!));
        else if (workspace) await this.options.git.release(workspace).catch(() => undefined);
      } else {
        const disposition = await this.options.transport.fail(claim, {
          errorCode: failureCode(failure),
          errorMessage: failure.message,
          worktreePath: workspace?.path
        }).catch(() => undefined);
        taskSettled = Boolean(disposition);
        if (workspace && disposition) await this.applyRootDisposition(claim, spec, workspace, disposition).catch(() => this.options.git.release(workspace!));
        else if (workspace) await this.options.git.release(workspace).catch(() => undefined);
      }
      throw failure;
    } finally {
      this.active.delete(claim.task.id);
    }
  }

  async cancel(taskId: string, reason = "Control plane requested cancellation."): Promise<void> {
    await this.cancelActive(taskId, new TaskCancelledError(reason));
  }

  private async executeAdapter(
    adapter: CliRuntimeAdapter,
    claim: ClaimedExecutionTask,
    spec: ExecutionSpec,
    workspace: PreparedGitWorkspace,
    signal: AbortSignal
  ): Promise<{ outcome: AgentOutcome; sessionId?: string }> {
    let sequence = 0;
    let outcome: AgentOutcome | undefined;
    let sessionId: string | undefined;
    const schema = z.toJSONSchema(agentOutcomeSchema) as Record<string, unknown>;
    for await (const event of adapter.execute({
      executionId: claim.task.id,
      prompt: spec.input ?? "Complete the assigned task and return the required outcome.",
      workingDirectory: workspace.path,
      model: spec.runtime.model,
      reasoning: spec.runtime.reasoning,
      policy: spec.runtime.policy,
      systemInstructions: executionInstructions(spec.agent),
      outputSchema: schema,
      signal,
      permissionPolicy: this.options.permissionPolicy ?? new WorkspacePermissionPolicy(workspace.path, spec.runtime.policy)
    })) {
      if (event.type === "session.started") sessionId = event.sessionId;
      if (event.type === "execution.completed") {
        const parsed = agentOutcomeSchema.safeParse(event.structuredOutput);
        if (!parsed.success) throw new Error(`Runtime outcome failed schema validation: ${z.prettifyError(parsed.error)}`);
        outcome = parsed.data;
      }
      await this.options.transport.appendEvents(claim, [runtimeEventToUpload(event, sequence++, spec.runtime.provider)], signal);
    }
    if (!outcome) throw new Error("Runtime completed without a validated agent outcome.");
    return { outcome, sessionId };
  }

  private async verifyRuntimePolicy(adapter: CliRuntimeAdapter, spec: ExecutionSpec, signal: AbortSignal): Promise<void> {
    const probe = await adapter.probe(signal);
    if (!probe.installed || !probe.compatible) throw new Error(probe.reason ?? `${adapter.provider} is unavailable or unsupported.`);
    if (probe.authStatus !== "ready") throw new Error(probe.reason ?? `${adapter.provider} authentication is required.`);
    if (probe.version !== spec.runtime.cliVersion) {
      throw new Error(`${adapter.provider} version changed from task snapshot ${spec.runtime.cliVersion} to ${probe.version ?? "unknown"}.`);
    }
    if (!probe.policyCapabilities.workspaceWrite) throw new Error(`${adapter.provider} cannot enforce workspace-write isolation.`);
    if (spec.runtime.policy.network && !probe.policyCapabilities.networkControl) {
      throw new Error(`${adapter.provider} cannot enforce the requested network policy.`);
    }
    if (spec.runtime.policy.readOnlyRoots.length > 0 && !probe.policyCapabilities.readOnlyRoots) {
      throw new Error(`${adapter.provider} cannot enforce additional read-only roots.`);
    }
    if (spec.runtime.model !== "provider-default") {
      const models = await adapter.listModels(signal);
      if (!models.some((model) => model.id === spec.runtime.model)) {
        throw new Error(`${adapter.provider} model ${spec.runtime.model} is no longer available.`);
      }
    }
  }

  private async applyRootDisposition(
    claim: ClaimedExecutionTask,
    spec: ExecutionSpec,
    workspace: PreparedGitWorkspace,
    result: TaskDispositionResult,
    signal?: AbortSignal
  ): Promise<void> {
    const disposition = result.rootDisposition;
    if (!disposition?.terminal) {
      await this.options.git.release(workspace);
      return;
    }
    const finalized = await this.options.git.finalize(workspace, disposition.success, signal);
    await this.options.transport.reportRootFinalization(claim, spec.rootRunId, {
      success: finalized.success,
      retained: finalized.retained,
      branch: finalized.branch,
      worktreePath: finalized.worktreePath,
      commitSha: finalized.commitSha,
      changedFiles: finalized.changedFiles,
      snapshotHash: finalized.snapshotHash
    }, signal);
    await this.options.git.acknowledgeFinalization(spec.projectId, spec.rootRunId);
  }

  private async renewLease(
    claim: ClaimedExecutionTask,
    signal: AbortSignal,
    lost: (error: LeaseLostError) => Promise<void>,
    cancelled: (error: TaskCancelledError) => Promise<void>
  ): Promise<void> {
    let deadline = new Date(claim.task.leaseUntil ?? Date.now() + claim.leaseDurationMs).getTime();
    let retryDelay = claim.renewAfterMs;
    while (!signal.aborted) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        await lost(new LeaseLostError("Execution lease expired before it could be renewed."));
        return;
      }
      await abortableDelay(Math.min(Math.max(1, retryDelay), remaining), signal).catch(() => undefined);
      if (signal.aborted) return;
      if (Date.now() >= deadline) {
        await lost(new LeaseLostError("Execution lease expired before it could be renewed."));
        return;
      }
      try {
        const attemptSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(Math.max(1, deadline - Date.now()))
        ]);
        const result = await this.options.transport.renewLease(claim, attemptSignal);
        if (result.cancelRequested) {
          await cancelled(new TaskCancelledError()).catch(() => undefined);
          return;
        }
        if (!result.accepted) {
          await lost(new LeaseLostError("Execution lease renewal was rejected."));
          return;
        }
        if (result.leaseUntil) deadline = new Date(result.leaseUntil).getTime();
        else deadline = Date.now() + claim.leaseDurationMs;
        retryDelay = claim.renewAfterMs;
      } catch (error) {
        if (signal.aborted) return;
        if (Date.now() >= deadline) {
          await lost(new LeaseLostError(`Execution lease expired while renewal failed: ${error instanceof Error ? error.message : String(error)}`));
          return;
        }
        retryDelay = Math.min(1_000, Math.max(1, deadline - Date.now()));
      }
    }
  }

  private async cancelActive(taskId: string, cancellation: TaskCancelledError): Promise<void> {
    const active = this.active.get(taskId);
    if (!active) return;
    active.cancellation ??= cancellation;
    active.controller.abort(active.cancellation);
    await active.adapter.cancel(taskId, active.cancellation.message);
  }
}

const abortableDelay = (milliseconds: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  const finish = () => { signal.removeEventListener("abort", abort); resolve(); };
  const timer = setTimeout(finish, milliseconds);
  const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason); };
  signal.addEventListener("abort", abort, { once: true });
});

const withBranchArtifact = (
  outcome: AgentOutcome,
  branch: string
): AgentOutcome => ({
  ...outcome,
  artifacts: {
    ...outcome.artifacts,
    branch
  }
});

const executionInstructions = (agent: ExecutionSpec["agent"]): string => {
  if (agent.skillIds.length === 0) return agent.instructions;
  return `${agent.instructions}\n\nBallet execution snapshot skills: ${agent.skillIds.join(", ")}. Read their project-local SKILL.md files under .agents/skills before applying them.`;
};

const isCancellationConflict = (error: unknown): boolean =>
  error instanceof DaemonTransportError
  && error.status === 409
  && /cancel(?:lation)?/i.test(error.message);

const failureCode = (failure: Error): "runtime_lost" | "invalid_outcome" | "policy_denied" | "unsupported_version" | "execution_failed" => {
  if (failure instanceof LeaseLostError) return "runtime_lost";
  if (/schema|outcome/i.test(failure.message)) return "invalid_outcome";
  if (/policy|isolation|read-only roots/i.test(failure.message)) return "policy_denied";
  if (/unsupported|newer is required|unavailable/i.test(failure.message)) return "unsupported_version";
  return "execution_failed";
};

export const terminalRuntimeEvent = (message: string): RuntimeEvent => ({
  type: "execution.failed",
  message,
  retryable: false
});
