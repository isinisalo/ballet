import type { AgentOutcome, ExecutionTask, RuntimeProvider } from "../../shared/domain/runtime.js";
import path from "node:path";
import { agentOutcomeSchema } from "../../shared/api/runtime-schemas.js";
import { WorkspacePermissionPolicy } from "./WorkspacePermissionPolicy.js";
import type { ExecutionStore } from "./ExecutionStore.js";
import type { LocalRuntimeService } from "./LocalRuntimeService.js";
import { toExecutionEvent } from "./RuntimeEventMapper.js";

export interface LocalExecutionQueueOptions {
  store: ExecutionStore;
  runtime: LocalRuntimeService;
  worktreesRoot: string;
  onTerminal(task: ExecutionTask): Promise<void> | void;
  onStarted?(task: ExecutionTask): Promise<void> | void;
  onOrchestrationError?(error: unknown, task: ExecutionTask): void;
  onChanged?(rootRunId: string): void;
}

export class LocalExecutionQueue {
  private readonly active = new Map<RuntimeProvider, Promise<void>>();
  private readonly controllers = new Map<string, AbortController>();
  private stopping = false;

  constructor(private readonly options: LocalExecutionQueueOptions) {}

  async start(): Promise<void> {
    const interrupted = this.options.store.recoverInterrupted();
    for (const task of interrupted) {
      this.appendTerminal(task, "Execution was interrupted by a Ballet restart.");
      await this.applyTerminal(task);
    }
    this.wake();
  }

  wake(provider?: RuntimeProvider): void {
    if (this.stopping) return;
    for (const candidate of provider ? [provider] : ["codex", "copilot"] as const) {
      if (this.active.has(candidate)) continue;
      const promise = this.pump(candidate).finally(() => {
        this.active.delete(candidate);
        if (!this.stopping && this.options.store.queued(candidate)) this.wake(candidate);
      });
      this.active.set(candidate, promise);
    }
  }

  async cancel(taskId: string): Promise<ExecutionTask> {
    const task = this.options.store.requestCancel(taskId);
    if (task.status === "cancelled") {
      this.appendTerminal(task, "Execution cancelled before it started.");
      await this.applyTerminal(task);
    }
    else {
      this.controllers.get(taskId)?.abort(new Error("Run cancellation requested."));
      await this.options.runtime.adapter(task.spec.runtime.provider).cancel(taskId, "Run cancellation requested.");
    }
    this.options.onChanged?.(task.rootRunId);
    return this.options.store.require(taskId);
  }

  async shutdown(timeoutMs = 90_000): Promise<void> {
    this.stopping = true;
    for (const task of this.options.store.activeTasks()) await this.cancel(task.id);
    await Promise.race([
      Promise.allSettled([...this.active.values()]),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    ]);
  }

  private async pump(provider: RuntimeProvider): Promise<void> {
    while (!this.stopping) {
      const queued = this.options.store.queued(provider);
      if (!queued) return;
      await this.execute(queued);
    }
  }

  private async execute(queued: ExecutionTask): Promise<void> {
    const task = this.options.store.start(queued.id);
    const controller = new AbortController();
    this.controllers.set(task.id, controller);
    this.options.onChanged?.(task.rootRunId);
    let outcome: AgentOutcome | undefined;
    let terminal: ExecutionTask;
    let sequence = 0;
    try {
      await this.options.onStarted?.(task);
      const expected = task.spec.runtime;
      await this.options.runtime.verify(expected);
      const adapter = this.options.runtime.adapter(expected.provider);
      for await (const event of adapter.execute({
        executionId: task.id,
        prompt: task.spec.input ?? "Complete the assigned work.",
        systemInstructions: task.spec.agent.instructions,
        workingDirectory: this.rootWorktree(task),
        model: expected.model,
        reasoning: expected.reasoning,
        policy: expected.policy,
        signal: controller.signal,
        permissionPolicy: new WorkspacePermissionPolicy(this.rootWorktree(task), expected.policy),
        outputSchema: outcomeJsonSchema
      })) {
        this.options.store.appendEvent(task.id, toExecutionEvent(event, sequence++, expected.provider));
        if (event.type === "execution.completed") {
          const parsed = agentOutcomeSchema.safeParse(event.structuredOutput);
          if (!parsed.success) throw new Error(`Agent returned an invalid structured outcome: ${parsed.error.message}`);
          outcome = parsed.data as AgentOutcome;
        }
      }
      if (!outcome) throw new Error("Runtime completed without a structured agent outcome.");
      terminal = this.options.store.finish(task.id, "succeeded", { outcome });
      this.appendTerminal(terminal, terminal.status === "cancelled" ? "Execution cancelled." : "Execution succeeded.");
    } catch (error) {
      const cancelled = controller.signal.aborted || Boolean(this.options.store.require(task.id).cancelRequestedAt);
      terminal = this.options.store.finish(task.id, cancelled ? "cancelled" : "failed", cancelled ? {} : {
        errorCode: "execution_failed", errorMessage: error instanceof Error ? error.message : String(error)
      });
      this.appendTerminal(terminal, cancelled ? "Execution cancelled." : terminal.errorMessage ?? "Execution failed.", sequence);
    } finally {
      this.controllers.delete(task.id);
      this.options.onChanged?.(task.rootRunId);
    }
    await this.applyTerminal(terminal!);
  }

  private rootWorktree(task: ExecutionTask): string {
    return path.join(this.options.worktreesRoot, task.spec.rootRunId);
  }

  private appendTerminal(task: ExecutionTask, message: string, sequence?: number): void {
    this.options.store.appendEvent(task.id, {
      sequence: sequence ?? Number.MAX_SAFE_INTEGER,
      source: "ballet",
      kind: task.status === "failed" ? "error" : task.status === "cancelled" ? "warn" : "system",
      level: task.status === "failed" ? "error" : task.status === "cancelled" ? "warn" : "info",
      phase: "completed", message, terminal: true, createdAt: new Date().toISOString()
    });
  }

  private async applyTerminal(task: ExecutionTask): Promise<void> {
    try { await this.options.onTerminal(task); }
    catch (error) { this.options.onOrchestrationError?.(error, task); }
  }
}

const outcomeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["outcome", "summary", "checks"],
  properties: {
    outcome: { enum: ["ready", "blocked", "needs_input", "approved", "changes-requested", "failed"] },
    summary: { type: "string" },
    artifacts: { type: "object" },
    checks: { type: "array", items: { type: "object" } }
  }
};
