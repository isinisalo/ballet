import type Database from "better-sqlite3";
import type { ExecutionTask } from "../../shared/domain/runtime.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import { WorkLoopRuntimeUnavailableError } from "../runtime/LoopRunErrors.js";
import { failedRuntimeOutcome } from "../runtime/RuntimeOutcomes.js";
import type { RootFinalizationCoordinator } from "./RootFinalizationCoordinator.js";
import type { RootRunStore, StoredRootRun } from "./RootRunStore.js";
import { isActiveRootStatus } from "./RunReadProjection.js";

export interface RootRunExecutionCoordinatorOptions {
  connection: () => Database.Database;
  database: RuntimeDatabase;
  roots: RootRunStore;
  executions: ExecutionStore;
  queue: LocalExecutionQueue;
  finalizer: RootFinalizationCoordinator;
  workspaces: LocalWorkspaceManager;
  onChanged?(rootRunId: string): void;
}

type TerminalStatus = "completed" | "blocked" | "failed" | "cancelled";
type RootTerminalization = {
  status: "failed";
  outcome: ReturnType<typeof failedRuntimeOutcome>;
  error: string;
} | { status: "cancelled" };

export class RootRunExecutionCoordinator {
  constructor(private readonly options: RootRunExecutionCoordinatorOptions) {}

  async enqueuePending(_rootRunId: string): Promise<void> {
    void _rootRunId;
    throw new WorkLoopRuntimeUnavailableError();
  }

  preflightPending(_rootRunId: string): void {
    void _rootRunId;
    throw new WorkLoopRuntimeUnavailableError();
  }

  async sync(rootRunId: string): Promise<void> {
    const runs = this.options.database.listRootLoopRuns(rootRunId);
    if (runs.some((run) => run.status === "waiting_for_human")) {
      this.options.roots.setStatus(rootRunId, "waiting_for_human");
      return;
    }
    if (runs.some((run) => run.status === "running")) {
      const queued = this.options.executions.listByRoot(rootRunId)
        .some((task) => task.status === "queued");
      this.options.roots.setStatus(rootRunId, queued ? "queued" : "running");
      return;
    }
    const status = runs.some((run) => run.status === "failed") ? "failed"
      : runs.some((run) => run.status === "blocked") ? "blocked"
        : runs.some((run) => run.status === "cancelled") ? "cancelled" : "completed";
    const outcome = [...this.options.executions.listByRoot(rootRunId)].reverse()
      .find((task) => task.outcome)?.outcome;
    this.options.roots.setStatus(rootRunId, status, { outcome });
    await this.options.finalizer.finalize(rootRunId, status);
  }

  async handleTerminal(task: ExecutionTask): Promise<void> {
    const root = this.options.roots.require(task.rootRunId);
    const terminal = terminalStatus(root);
    if (terminal) {
      await this.options.finalizer.finalize(root.rootRunId, terminal);
      return;
    }
    try {
      this.options.database.completeExecutionStep({
        stepRunId: task.spec.stepRunId,
        executionTaskId: task.id,
        outcome: task.status === "succeeded" ? task.outcome : undefined,
        error: task.status === "succeeded" ? undefined : task.errorMessage ?? `Execution ${task.status}.`
      });
      await this.enqueuePending(task.rootRunId);
      await this.sync(task.rootRunId);
    } catch (error) {
      await this.failRoot(root, error);
    }
  }

  handleStarted(task: ExecutionTask): boolean {
    if (["queued", "running"].includes(task.status)) this.options.executions.requestCancel(task.id);
    return false;
  }

  async reconcile(): Promise<void> {
    const roots = this.options.roots.list();
    await this.options.workspaces.cleanupOrphans(new Set(roots.map((root) => root.rootRunId)));
    for (const root of roots) {
      try {
        if (root.status === "finalizing") {
          await this.recoverTerminalRoot(root, root.finalizationTerminalStatus ?? "failed");
        } else if (await this.applyUnreconciledTerminal(root)) {
          continue;
        } else if (isActiveRootStatus(root.status)) {
          await this.enqueuePending(root.rootRunId);
          await this.sync(root.rootRunId);
        } else if (isTerminalRootStatus(root.status) && !root.finalization) {
          await this.recoverTerminalRoot(root, root.status);
        } else if (root.status === "completed" && root.finalization?.report?.success) {
          await this.options.workspaces.cleanupSuccessful(root).catch(() => undefined);
        }
      } catch (error) {
        if (isActiveRootStatus(root.status)) await this.failRoot(root, error);
      }
    }
  }

  async failRoot(root: StoredRootRun, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const outcome = failedRuntimeOutcome(message);
    await this.terminalizeRoot(root.rootRunId, { status: "failed", outcome, error: message });
  }

  async cancelRoot(root: StoredRootRun): Promise<void> {
    await this.terminalizeRoot(root.rootRunId, { status: "cancelled" });
  }

  private async applyUnreconciledTerminal(root: StoredRootRun): Promise<boolean> {
    if (!isActiveRootStatus(root.status)) return false;
    const terminal = this.options.executions.listByRoot(root.rootRunId).find((task) => {
      if (!["succeeded", "failed", "cancelled"].includes(task.status)) return false;
      const step = this.options.database.getStepRun(task.spec.stepRunId);
      return Boolean(step && step.executionTaskId === task.id && ["queued", "running"].includes(step.status));
    });
    if (!terminal) return false;
    await this.handleTerminal(terminal);
    return true;
  }

  private changed(rootRunId: string): void {
    this.options.onChanged?.(rootRunId);
  }

  private async terminalizeRoot(rootRunId: string, detail: RootTerminalization): Promise<void> {
    const timestamp = new Date().toISOString();
    const persisted = this.options.connection().transaction(() => {
      const current = this.options.roots.require(rootRunId);
      if (!terminalizableRootStatuses.has(current.status)) return { root: current, taskIds: [] as string[] };
      this.options.database.terminalizeActiveRootRuns(rootRunId, detail, timestamp);
      const taskIds = this.options.executions.cancelActiveByRoot(rootRunId, timestamp);
      const root = this.options.roots.setStatus(rootRunId, detail.status, detail.status === "failed" ? {
        outcome: detail.outcome,
        errorCode: "orchestration_failed",
        errorMessage: detail.error,
        timestamp
      } : { timestamp });
      return { root, taskIds };
    })() as { root: StoredRootRun; taskIds: string[] };
    await this.interrupt(persisted.taskIds, `Root Run ${detail.status}.`);
    const terminal = terminalStatus(persisted.root);
    if (terminal) await this.options.finalizer.finalize(rootRunId, terminal);
    this.changed(rootRunId);
  }

  private async recoverTerminalRoot(root: StoredRootRun, terminal: TerminalStatus): Promise<void> {
    const timestamp = new Date().toISOString();
    const taskIds = this.options.connection().transaction(() => {
      const detail: RootTerminalization = terminal === "failed"
        ? {
            status: "failed",
            outcome: root.outcome?.state === "failed"
              ? root.outcome as ReturnType<typeof failedRuntimeOutcome>
              : failedRuntimeOutcome(root.errorMessage ?? "Root Run failed."),
            error: root.errorMessage ?? "Root Run failed."
          }
        : { status: "cancelled" };
      this.options.database.terminalizeActiveRootRuns(root.rootRunId, detail, timestamp);
      return this.options.executions.cancelActiveByRoot(root.rootRunId, timestamp);
    })() as string[];
    await this.interrupt(taskIds, `Root Run ${terminal}.`);
    await this.options.finalizer.finalize(root.rootRunId, terminal);
  }

  private async interrupt(taskIds: string[], reason: string): Promise<void> {
    await Promise.allSettled(taskIds.map((taskId) => this.options.queue.interrupt(taskId, reason)));
  }
}

const terminalizableRootStatuses = new Set<StoredRootRun["status"]>([
  "queued", "running", "waiting_for_human"
]);
const isTerminalRootStatus = (status: StoredRootRun["status"]): status is TerminalStatus =>
  ["completed", "blocked", "failed", "cancelled"].includes(status);
const terminalStatus = (root: StoredRootRun): TerminalStatus | undefined =>
  isTerminalRootStatus(root.status)
    ? root.status
    : root.status === "finalizing" ? root.finalizationTerminalStatus : undefined;
