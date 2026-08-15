import type Database from "better-sqlite3";
import type { ExecutionTask } from "../../shared/domain/runtime.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import { WorkLoopRuntimeUnavailableError } from "../runtime/LoopRunErrors.js";
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

type RootTerminalization = { status: "failed"; error: string } | { status: "cancelled" };

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
    if (runs.some((run) => run.status === "waiting_for_input")) {
      this.options.roots.setStatus(rootRunId, "waiting_for_input");
      return;
    }
    if (runs.some((run) => ["queued", "running"].includes(run.status))) {
      const queued = this.options.executions.listByRoot(rootRunId).some((task) => task.status === "queued");
      this.options.roots.setStatus(rootRunId, queued ? "queued" : "running");
      return;
    }
    const status = runs.some((run) => run.status === "failed") ? "failed"
      : runs.some((run) => run.status === "blocked") ? "blocked"
        : runs.some((run) => run.status === "cancelled") ? "cancelled" : "completed";
    await this.options.finalizer.finalize(rootRunId, status);
  }

  async handleTerminal(task: ExecutionTask): Promise<void> {
    const root = this.options.roots.require(task.rootRunId);
    if (!isActiveRootStatus(root.status)) return;
    await this.failRoot(root, new WorkLoopRuntimeUnavailableError());
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
          await this.options.finalizer.finalize(root.rootRunId, root.finalizationTerminalStatus ?? "failed");
        } else if (await this.applyUnreconciledTerminal(root)) {
          continue;
        } else if (isActiveRootStatus(root.status)) {
          await this.enqueuePending(root.rootRunId);
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
    await this.terminalizeRoot(root.rootRunId, { status: "failed", error: message });
  }

  async cancelRoot(root: StoredRootRun): Promise<void> {
    await this.terminalizeRoot(root.rootRunId, { status: "cancelled" });
  }

  private async applyUnreconciledTerminal(root: StoredRootRun): Promise<boolean> {
    if (!isActiveRootStatus(root.status)) return false;
    const terminal = this.options.executions.listByRoot(root.rootRunId).find((task) => {
      if (!["succeeded", "failed", "cancelled"].includes(task.status)) return false;
      const node = this.options.database.getNodeRun(task.spec.nodeRunId);
      return Boolean(node && node.executionTaskId === task.id && ["queued", "running"].includes(node.status));
    });
    if (!terminal) return false;
    await this.handleTerminal(terminal);
    return true;
  }

  private async terminalizeRoot(rootRunId: string, detail: RootTerminalization): Promise<void> {
    const timestamp = new Date().toISOString();
    const persisted = this.options.connection().transaction(() => {
      const current = this.options.roots.require(rootRunId);
      if (!terminalizableRootStatuses.has(current.status)) return { root: current, taskIds: [] as string[] };
      this.options.database.terminalizeActiveRootRuns(
        rootRunId,
        detail.status,
        detail.status === "failed" ? detail.error : undefined,
        timestamp
      );
      const taskIds = this.options.executions.cancelActiveByRoot(rootRunId, timestamp);
      const root = this.options.roots.startFinalization(
        rootRunId,
        false,
        detail.status,
        detail.status === "failed"
          ? { errorCode: "orchestration_failed", errorMessage: detail.error, timestamp }
          : { timestamp }
      );
      return { root, taskIds };
    })();
    await this.interrupt(persisted.taskIds, `Root Run ${detail.status}.`);
    if (persisted.root.status === "finalizing") await this.options.finalizer.finalize(rootRunId, detail.status);
    this.options.onChanged?.(rootRunId);
  }

  private async interrupt(taskIds: string[], reason: string): Promise<void> {
    await Promise.allSettled(taskIds.map((taskId) => this.options.queue.interrupt(taskId, reason)));
  }
}

const terminalizableRootStatuses = new Set<StoredRootRun["status"]>([
  "queued", "running", "waiting_for_input"
]);
