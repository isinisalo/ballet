import type { DashboardRunStatus } from "../../shared/domain/runs.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import type { RootRunStore } from "./RootRunStore.js";

type TerminalStatus = Extract<DashboardRunStatus, "completed" | "blocked" | "failed" | "cancelled">;

export class RootFinalizationCoordinator {
  private readonly active = new Map<string, Promise<void>>();

  constructor(
    private readonly roots: RootRunStore,
    private readonly executions: ExecutionStore,
    private readonly workspaces: LocalWorkspaceManager,
    private readonly onChanged: (rootRunId: string) => void
  ) {}

  async finalize(rootRunId: string, terminal: TerminalStatus): Promise<void> {
    const existing = this.active.get(rootRunId);
    if (existing) return existing;
    const operation = this.run(rootRunId, terminal).finally(() => this.active.delete(rootRunId));
    this.active.set(rootRunId, operation);
    return operation;
  }

  private async run(rootRunId: string, terminal: TerminalStatus): Promise<void> {
    const tasks = this.executions.listByRoot(rootRunId);
    if (tasks.some((task) => ["queued", "running"].includes(task.status))) return;
    let root = this.roots.require(rootRunId);
    if (root.finalization?.status === "completed") return;
    root = root.status === "finalizing"
      ? root
      : this.roots.startFinalization(rootRunId, terminal === "completed", terminal);
    let report;
    try { report = await this.workspaces.finalize(root, terminal === "completed"); }
    catch (error) {
      this.roots.failFinalization(rootRunId, error instanceof Error ? error.message : String(error));
      this.onChanged(rootRunId);
      return;
    }
    root = this.roots.finishFinalization(rootRunId, report);
    if (report.success) await this.workspaces.cleanupSuccessful(root).catch(() => undefined);
    this.onChanged(rootRunId);
  }
}
