import type Database from "better-sqlite3";
import type { ExecutionTask } from "../../shared/domain/runtime.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import { StatePatchValidationError } from "../runtime/state/StatePatch.js";
import type { RootFinalizationCoordinator } from "./RootFinalizationCoordinator.js";
import type { RootRunStore, StoredRootRun } from "./RootRunStore.js";
import { isActiveRootStatus } from "./RunReadProjection.js";
import { createNodeExecutionSpec, type NodeExecutionPlanInput } from "./NodeExecutionPlan.js";
import type { TrackerOutbox } from "../tracker/TrackerOutbox.js";

export interface RootRunExecutionCoordinatorOptions {
  connection: () => Database.Database;
  database: RuntimeDatabase;
  roots: RootRunStore;
  executions: ExecutionStore;
  queue: LocalExecutionQueue;
  finalizer: RootFinalizationCoordinator;
  workspaces: LocalWorkspaceManager;
  tracker: TrackerOutbox;
  onChanged?(rootRunId: string): void;
}

type RootTerminalization = {
  status: "failed";
  error: string;
  errorCode: "invalid_state_patch" | "orchestration_failed";
} | { status: "cancelled" };

type PendingNodePlan = Omit<NodeExecutionPlanInput, "state" | "events">;

export class RootRunExecutionCoordinator {
  constructor(private readonly options: RootRunExecutionCoordinatorOptions) {}

  async enqueuePending(rootRunId: string): Promise<void> {
    const root = this.options.roots.require(rootRunId);
    if (!await this.options.tracker.reconcileOrPause(root)) return;
    const plan = this.pendingNode(rootRunId);
    if (!plan) return;
    if (plan.node.executionTaskId) {
      const task = this.options.executions.require(plan.node.executionTaskId);
      if (task.status === "queued") this.options.queue.wake(task.spec.runtime.provider);
      return;
    }
    const spec = createNodeExecutionSpec({
      ...plan,
      state: this.options.database.state.current(rootRunId),
      events: this.options.database.listControlFlowEvents(rootRunId)
    });
    this.options.connection().transaction(() => {
      const current = this.options.database.getNodeRun(plan.node.nodeRunId);
      if (!current || current.status !== "queued" || current.executionTaskId) return;
      this.options.executions.create(spec);
    })();
    this.options.queue.wake(spec.runtime.provider);
  }

  preflightPending(rootRunId: string): void {
    const plan = this.pendingNode(rootRunId);
    if (!plan || plan.node.executionTaskId) return;
    createNodeExecutionSpec({
      ...plan,
      state: this.options.database.state.current(rootRunId),
      events: this.options.database.listControlFlowEvents(rootRunId)
    });
  }

  async sync(rootRunId: string): Promise<void> {
    const runs = this.options.database.listRootLoopRuns(rootRunId);
    const root = this.options.roots.require(rootRunId);
    const activeNode = root.activeNodeRunId
      ? this.options.database.getNodeRun(root.activeNodeRunId)
      : undefined;
    if (activeNode && ["queued", "running"].includes(activeNode.status)) {
      const queued = this.options.executions.listByRoot(rootRunId).some((task) => task.status === "queued");
      this.options.roots.setStatus(rootRunId, queued ? "queued" : "running");
      return;
    }
    if (activeNode?.status === "waiting_for_input") {
      this.options.roots.setStatus(rootRunId, "waiting_for_input");
      return;
    }
    if (runs.some((run) => ["queued", "running"].includes(run.status))) {
      const queued = this.options.executions.listByRoot(rootRunId).some((task) => task.status === "queued");
      this.options.roots.setStatus(rootRunId, queued ? "queued" : "running");
      return;
    }
    if (runs.some((run) => run.status === "waiting_for_input")) {
      this.options.roots.setStatus(rootRunId, "waiting_for_input");
      return;
    }
    if (!await this.options.tracker.reconcileOrPause(this.options.roots.require(rootRunId))) return;
    const persistedRoot = this.options.roots.require(rootRunId);
    const status = persistedRoot.errorCode === "orchestrator_blocked" ? "blocked"
      : persistedRoot.errorCode ? "failed"
      : runs.some((run) => run.status === "failed") ? "failed"
      : runs.some((run) => run.status === "blocked") ? "blocked"
        : runs.some((run) => run.status === "cancelled") ? "cancelled" : "completed";
    await this.options.finalizer.finalize(rootRunId, status);
  }

  async handleTerminal(task: ExecutionTask): Promise<void> {
    const root = this.options.roots.require(task.rootRunId);
    if (!isActiveRootStatus(root.status)) {
      if (root.status === "finalizing") await this.options.finalizer.finalize(
        root.rootRunId,
        root.finalizationTerminalStatus ?? "failed"
      );
      return;
    }
    try {
      const persisted = this.options.executions.require(task.id);
      const node = this.options.database.getNodeRun(persisted.spec.nodeRunId);
      if (!node || node.executionTaskId !== persisted.id) return;
      if (persisted.status === "succeeded") {
        const outcome = persisted.outcome;
        if (!outcome) throw new Error(`Execution task ${persisted.id} has no canonical outcome.`);
        this.options.connection().transaction(() => {
          this.options.database.applyNodeOutcome(root.rootRunId, node.nodeRunId, outcome);
          this.preflightPending(root.rootRunId);
        })();
      } else if (["interrupted", "failed", "cancelled"].includes(node.status)) {
        this.options.database.reconcileTerminalNode(node.nodeRunId);
        await this.sync(root.rootRunId);
        this.options.onChanged?.(root.rootRunId);
        return;
      } else if (persisted.status === "cancelled") {
        await this.cancelRoot(root);
        return;
      } else {
        throw new Error(persisted.errorMessage ?? `Execution task ${persisted.id} failed.`);
      }
      await this.enqueuePending(root.rootRunId);
      await this.sync(root.rootRunId);
      this.options.onChanged?.(root.rootRunId);
    } catch (error) {
      await this.failRoot(root, error);
    }
  }

  handleStarted(task: ExecutionTask): boolean {
    const accepted = this.options.connection().transaction(() => {
      const persisted = this.options.executions.get(task.id);
      if (persisted?.status !== "running" || !this.options.database.isExecutionNodeRunnable(
        task.rootRunId,
        task.spec.nodeRunId,
        task.id
      )) {
        if (persisted && ["queued", "running"].includes(persisted.status)) {
          this.options.executions.requestCancel(task.id);
        }
        return false;
      }
      this.options.database.markNodeRunRunning(task.spec.nodeRunId);
      this.options.roots.setStatus(task.rootRunId, "running");
      return true;
    })();
    if (accepted) this.options.onChanged?.(task.rootRunId);
    return accepted;
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
          await this.sync(root.rootRunId);
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
    await this.terminalizeRoot(root.rootRunId, {
      status: "failed",
      error: message,
      errorCode: error instanceof StatePatchValidationError ? "invalid_state_patch" : "orchestration_failed"
    });
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

  private pendingNode(rootRunId: string): PendingNodePlan | undefined {
    const root = this.options.roots.require(rootRunId);
    if (!root.activeNodeRunId) return undefined;
    const node = this.options.database.getNodeRun(root.activeNodeRunId);
    if (!node || node.rootRunId !== rootRunId || node.status !== "queued") return undefined;
    const run = this.options.database.listRootLoopRuns(rootRunId)
      .find((candidate) => candidate.loopRunId === node.loopRunId);
    const jobRun = node.jobRunId
      ? this.options.database.getJobRun(node.jobRunId)
      : undefined;
    if (!run || (run.status !== "running" && !(node.role === "orchestrator" && run.status === "completed"))
      || (node.role !== "orchestrator" && !jobRun)) return undefined;
    const orchestrationRequest = node.role === "orchestrator"
      ? this.options.database.orchestration.forOrchestrator(node.nodeRunId)
      : undefined;
    return { root, run, jobRun, node, orchestrationRequest };
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
        timestamp,
        detail.status === "failed" ? detail.errorCode : undefined
      );
      const taskIds = this.options.executions.cancelActiveByRoot(rootRunId, timestamp);
      const root = this.options.roots.startFinalization(
        rootRunId,
        false,
        detail.status,
        detail.status === "failed"
          ? { errorCode: detail.errorCode, errorMessage: detail.error, timestamp }
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
