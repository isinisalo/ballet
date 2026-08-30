import { z } from "zod";
import type { ExecutionPolicy, LocalDaemonEvent, LocalDaemonTaskClaim, RuntimeProvider } from "../../../shared/domain/runtime.js";
import { roleOutcomeV11Schema } from "../../../shared/orchestration/schemas/outcomeSchemas.js";
import type { CliRuntimeAdapter, RuntimeEvent, RuntimePermissionPolicy } from "../providers/CliRuntimeAdapter.js";
import type { LocalDaemonTransport } from "../transport/LocalDaemonTransport.js";
import { WorkspacePermissionPolicy } from "./WorkspacePermissionPolicy.js";

export class LeaseLostError extends Error {
  constructor(message = "Execution lease was lost.") { super(message); this.name = "LeaseLostError"; }
}
export class TaskCancelledError extends Error {
  constructor(message = "Execution was cancelled by Ballet.") { super(message); this.name = "TaskCancelledError"; }
}

interface ActiveExecution { controller: AbortController; adapter: CliRuntimeAdapter; cancellation?: TaskCancelledError }

export class LeaseAwareJobRunner {
  private readonly adapters: Map<RuntimeProvider, CliRuntimeAdapter>;
  private readonly active = new Map<string, ActiveExecution>();

  constructor(private readonly options: {
    adapters: readonly CliRuntimeAdapter[];
    transport: LocalDaemonTransport;
    permissionPolicy?: RuntimePermissionPolicy;
  }) { this.adapters = new Map(options.adapters.map((adapter) => [adapter.provider, adapter])); }

  async run(claim: LocalDaemonTaskClaim): Promise<void> {
    const { spec } = claim;
    const adapter = this.adapters.get(spec.runtime.provider);
    if (!adapter) throw new Error(`No ${spec.runtime.provider} adapter is configured.`);
    const controller = new AbortController();
    const active: ActiveExecution = { controller, adapter };
    this.active.set(claim.taskId, active);
    const stopLease = new AbortController();
    let leaseFailure: LeaseLostError | undefined;
    const lease = this.leaseLoop(claim, stopLease.signal, async (error) => {
      leaseFailure = error; controller.abort(error); await adapter.cancel(claim.taskId, error.message);
    }, async () => this.cancel(claim.taskId));
    const outcomeKey = `${spec.runtime.provider}:${claim.taskId}:${claim.fencing}`;
    try {
      await this.verifyRuntime(adapter, claim, controller.signal);
      const raw = await this.executeAdapter(adapter, claim, controller.signal);
      if (active.cancellation) throw active.cancellation;
      if (leaseFailure) throw leaseFailure;
      await this.options.transport.complete(claim, outcomeKey, raw, controller.signal);
    } catch (error) {
      const failure = active.cancellation ?? leaseFailure ?? (error instanceof Error ? error : new Error(String(error)));
      await this.options.transport.fail(claim, outcomeKey, failure.message).catch(() => undefined);
      throw failure;
    } finally {
      stopLease.abort(); await lease.catch(() => undefined); this.active.delete(claim.taskId);
    }
  }

  async cancel(taskId: string, reason = "Ballet requested cancellation."): Promise<void> {
    const active = this.active.get(taskId);
    if (!active) return;
    active.cancellation ??= new TaskCancelledError(reason);
    active.controller.abort(active.cancellation);
    await active.adapter.cancel(taskId, active.cancellation.message);
  }

  private async executeAdapter(adapter: CliRuntimeAdapter, claim: LocalDaemonTaskClaim, signal: AbortSignal): Promise<string> {
    const { spec } = claim;
    let sequence = 0; let raw: string | undefined;
    const policy: ExecutionPolicy = { network: claim.permissions.network, readOnlyRoots: claim.permissions.readOnlyRoots };
    const permissionPolicy = this.options.permissionPolicy
      ?? new WorkspacePermissionPolicy(spec.project.checkoutRoot, policy, claim.permissions.workspaceAccess);
    const schema = z.toJSONSchema(roleOutcomeV11Schema) as Record<string, unknown>;
    for await (const event of adapter.execute({
      executionId: claim.taskId, prompt: spec.evidence.prompt,
      workingDirectory: spec.project.checkoutRoot, model: spec.runtime.model,
      reasoning: spec.runtime.reasoningEffort, workspaceAccess: claim.permissions.workspaceAccess,
      policy, outputSchema: schema, signal, permissionPolicy
    })) {
      if (event.type === "execution.completed") {
        raw = event.structuredOutput === undefined ? event.output : JSON.stringify(event.structuredOutput);
      }
      await this.options.transport.appendEvents(claim, [toEvent(event, ++sequence, spec.runtime.provider)], signal);
    }
    if (!raw) throw new Error("Provider completed without structured output.");
    return raw;
  }

  private async verifyRuntime(adapter: CliRuntimeAdapter, claim: LocalDaemonTaskClaim, signal: AbortSignal): Promise<void> {
    const probe = await adapter.probe(signal); const { spec } = claim;
    if (!probe.installed || !probe.compatible) throw new Error(probe.reason ?? `${adapter.provider} is unavailable.`);
    if (probe.authStatus !== "ready") throw new Error(probe.reason ?? `${adapter.provider} authentication is required.`);
    if (probe.version !== spec.runtime.cliVersion) throw new Error(
      `${adapter.provider} version changed from ${spec.runtime.cliVersion} to ${probe.version ?? "unknown"}.`);
    if (claim.permissions.workspaceAccess === "workspace-write" && !probe.policyCapabilities.workspaceWrite) {
      throw new Error(`${adapter.provider} cannot enforce workspace-write isolation.`);
    }
    if (claim.permissions.network && !probe.policyCapabilities.networkControl) {
      throw new Error(`${adapter.provider} cannot enforce network policy.`);
    }
    if (claim.permissions.readOnlyRoots.length > 0 && !probe.policyCapabilities.readOnlyRoots) {
      throw new Error(`${adapter.provider} cannot enforce additional read-only roots.`);
    }
    const models = await adapter.listModels(signal);
    if (!models.some(({ id }) => id === spec.runtime.model)) throw new Error(
      `${adapter.provider} model ${spec.runtime.model} is no longer available.`);
  }

  private async leaseLoop(
    claim: LocalDaemonTaskClaim, signal: AbortSignal,
    lost: (error: LeaseLostError) => Promise<void>, cancelled: () => Promise<void>
  ): Promise<void> {
    let deadline = new Date(claim.leaseUntil).getTime();
    while (!signal.aborted) {
      await abortableDelay(Math.min(claim.renewAfterMs, Math.max(1, deadline - Date.now())), signal).catch(() => undefined);
      if (signal.aborted) return;
      if (Date.now() >= deadline) { await lost(new LeaseLostError()); return; }
      try {
        const result = await this.options.transport.renew(claim, AbortSignal.any([
          signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))
        ]));
        if (result.cancelRequested) { await cancelled(); return; }
        if (!result.accepted) { await lost(new LeaseLostError("Execution lease renewal was rejected.")); return; }
        deadline = new Date(result.leaseUntil ?? Date.now() + claim.leaseDurationMs).getTime();
      } catch (error) {
        if (Date.now() >= deadline) {
          await lost(new LeaseLostError(`Execution lease expired during renewal: ${String(error)}`)); return;
        }
      }
    }
  }
}

const toEvent = (event: RuntimeEvent, sequence: number, provider: RuntimeProvider): LocalDaemonEvent => {
  const base = { sequence, source: provider, createdAt: new Date().toISOString(), terminal: false } as const;
  switch (event.type) {
    case "execution.started": return { ...base, kind: "system", level: "info", phase: "started", message: `${provider} execution started.` };
    case "assistant.delta": return { ...base, kind: "agent", level: "info", phase: "delta", message: event.text };
    case "assistant.message": return { ...base, kind: "agent", level: "info", phase: "completed", message: event.text };
    case "reasoning.summary": return { ...base, kind: "think", level: "info", phase: "completed", message: event.text };
    case "diagnostic": return { ...base, kind: "info", level: event.level === "warning" ? "warn" : event.level,
      phase: "completed", message: event.message };
    case "execution.failed": return { ...base, terminal: true, kind: "error", level: "error", phase: "completed", message: event.message };
    case "execution.completed": return { ...base, terminal: true, kind: "system", level: "info", phase: "completed", message: "Provider execution completed." };
    default: return { ...base, kind: "tool", level: "info", phase: "completed", message: event.type };
  }
};
const abortableDelay = (milliseconds: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  const finish = () => { signal.removeEventListener("abort", abort); resolve(); };
  const timer = setTimeout(finish, milliseconds);
  const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason); };
  signal.addEventListener("abort", abort, { once: true });
});
