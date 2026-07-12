// Run orchestration is intentionally one transaction/process boundary: it owns
// root lifecycle, Loop progression, task queueing, and idempotent Git finalization.
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { AppData } from "../../shared/api/workspaceData.js";
import { resolveLoopTheme } from "../../shared/domain/loopThemes.js";
import type {
  ExecutionSpec,
  ExecutionTask,
  StepRunResult
} from "../../shared/domain/runtime.js";
import type { RootRunDetail, RootRunListQuery, RootRunListResponse, StartRootRunRequest } from "../../shared/domain/runs.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import { LoopThemeRepository } from "../loop-themes/LoopThemeRepository.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import type { ProjectContext } from "../project/ProjectContext.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import type { DispatchLoopScheduleResult } from "../runtime-db.js";
import { renderLoopStepPrompt } from "../integration/LoopStepPrompt.js";
import { validateLoopRunStart } from "../services/LoopRunStartPolicy.js";
import { RootRunStore, type StoredRootRun } from "./RootRunStore.js";
import { RootFinalizationCoordinator } from "./RootFinalizationCoordinator.js";
import { agentSnapshot } from "./LoopExecutionSnapshot.js";
import { LoopExecutionPlanner } from "./LoopExecutionPlanner.js";
import {
  currentPosition,
  decodeRunCursor,
  encodeRunCursor,
  isActiveRootStatus,
  publicRootSummary
} from "./RunReadProjection.js";

export interface LocalRunServiceOptions {
  context: ProjectContext;
  connection: () => Database.Database;
  database: RuntimeDatabase;
  roots: RootRunStore;
  executions: ExecutionStore;
  runtime: LocalRuntimeService;
  configurations: RuntimeConfigurationService;
  queue: LocalExecutionQueue;
  readData(): Promise<AppData>;
  onChanged?(rootRunId: string): void;
}

export class LocalRunService {
  private readonly workspaces: LocalWorkspaceManager;
  private readonly finalizer: RootFinalizationCoordinator;
  private readonly projectConfigurations = new ProjectConfigurationRepository();
  private readonly loopThemeRepository = new LoopThemeRepository();
  private readonly planner: LoopExecutionPlanner;

  constructor(private readonly options: LocalRunServiceOptions) {
    this.workspaces = new LocalWorkspaceManager(options.context);
    this.finalizer = new RootFinalizationCoordinator(
      options.roots, options.executions, this.workspaces, (rootRunId) => this.changed(rootRunId)
    );
    this.planner = new LoopExecutionPlanner(options.configurations, options.runtime);
  }

  async start(
    input: StartRootRunRequest,
    source: "manual" | "schedule" = "manual",
    schedule?: { stepId: string; scheduledFor: string }
  ): Promise<RootRunDetail> {
    const data = await this.options.readData();
    const rootRunId = randomUUID();
    if (input.kind === "agent") {
      const agent = data.agents.find((candidate) => candidate.id === input.targetId && candidate.enabled);
      if (!agent) throw new Error(`Agent ${input.targetId} was not found or is disabled.`);
      const configuration = await this.options.configurations.get(agent.id);
      if (!configuration.resolved) throw new Error(configuration.issues[0]?.message ?? `Agent ${agent.id} has no runtime configuration.`);
      const snapshot = await this.options.runtime.preflight(configuration.resolved);
      const workspace = await this.workspaces.prepare(rootRunId);
      if (workspace.snapshotHash !== snapshot.project.snapshotHash) {
        await this.workspaces.discard(workspace);
        throw new Error("Project configuration changed during Run startup.");
      }
      const timestamp = new Date().toISOString();
      const taskId = randomUUID();
      const spec: ExecutionSpec = {
        version: 1, taskId, kind: "agent_run", rootRunId, input: input.input,
        agent: agentSnapshot(agent), runtime: snapshot.runtime,
        project: { ...snapshot.project, snapshotHash: workspace.snapshotHash }, createdAt: timestamp
      };
      try {
        this.options.connection().transaction(() => {
          this.options.roots.create({
            rootRunId, kind: "agent", targetId: agent.id, source, input: input.input,
            worktreePath: workspace.path, branch: workspace.branch, headSha: workspace.headSha,
            configHash: workspace.configHash, snapshotHash: workspace.snapshotHash, createdAt: timestamp
          });
          this.options.executions.create(spec);
        })();
      } catch (error) {
        await this.workspaces.discard(workspace);
        throw error;
      }
      this.options.queue.wake(snapshot.runtime.provider);
    } else {
      await this.startLoop(data, rootRunId, input.targetId, input.input, source, schedule);
    }
    this.changed(rootRunId);
    return this.detailRequired(rootRunId);
  }

  async dispatchScheduled(input: {
    loopId: string; stepId: string; definitionHash: string; scheduledFor: string;
    nextRunAt?: string; updatedAt: string; canDispatch: () => boolean;
  }): Promise<DispatchLoopScheduleResult> {
    if (!input.canDispatch()) return { status: "stale" };
    const reserved = this.options.database.completeLoopScheduleOccurrence({
      loopId: input.loopId, stepId: input.stepId, definitionHash: input.definitionHash,
      scheduledFor: input.scheduledFor, nextRunAt: input.nextRunAt, status: "started",
      updatedAt: input.updatedAt
    });
    if (!reserved) return { status: "stale" };
    try {
      const detail = await this.start(
        { kind: "loop", targetId: input.loopId }, "schedule",
        { stepId: input.stepId, scheduledFor: input.scheduledFor }
      );
      const run = detail.loopRuns[0];
      if (!run) throw new Error("Scheduled root did not create a Loop Run.");
      const completed = this.options.database.finishReservedScheduleOccurrence({
        loopId: input.loopId, stepId: input.stepId, scheduledFor: input.scheduledFor,
        status: "started", runId: run.runId, updatedAt: input.updatedAt
      });
      return completed ? { status: "started", run } : { status: "stale" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const completed = this.options.database.finishReservedScheduleOccurrence({
        loopId: input.loopId, stepId: input.stepId, scheduledFor: input.scheduledFor,
        status: "skipped", error: message, updatedAt: input.updatedAt
      });
      return completed ? { status: "skipped", error: message } : { status: "stale" };
    }
  }

  list(query: RootRunListQuery = {}): RootRunListResponse {
    const limit = Math.max(1, Math.min(200, query.limit ?? 50));
    const runs = this.options.roots.list()
      .filter((run) => !query.kind || run.kind === query.kind)
      .filter((run) => !query.state || (query.state === "active") === isActiveRootStatus(run.status));
    const cursor = query.cursor ? decodeRunCursor(query.cursor) : undefined;
    const offset = cursor ? Math.max(0, runs.findIndex((run) => run.rootRunId === cursor) + 1) : 0;
    const items = runs.slice(offset, offset + limit);
    return {
      items: items.map((run) => {
        const loops = run.kind === "loop" ? this.options.database.listRootLoopRuns(run.rootRunId) : [];
        const tasks = this.options.executions.listByRoot(run.rootRunId);
        return { ...publicRootSummary(run), current: currentPosition(loops, tasks, run.targetId) };
      }),
      nextCursor: offset + items.length < runs.length && items.length > 0 ? encodeRunCursor(items.at(-1)!.rootRunId) : undefined
    };
  }

  detail(rootRunId: string): RootRunDetail | undefined {
    const root = this.options.roots.get(rootRunId);
    if (!root) return undefined;
    const loops = root.kind === "loop" ? this.options.database.listRootLoopRuns(rootRunId) : [];
    const tasks = this.options.executions.listByRoot(rootRunId);
    return { ...publicRootSummary(root), current: currentPosition(loops, tasks, root.targetId), loopRuns: loops, tasks };
  }

  async cancel(rootRunId: string): Promise<RootRunDetail> {
    const root = this.options.roots.require(rootRunId);
    if (!isActiveRootStatus(root.status)) return this.detailRequired(rootRunId);
    if (root.status === "finalizing") return this.detailRequired(rootRunId);
    if (root.kind === "loop") {
      for (const run of this.options.database.listRootLoopRuns(rootRunId)) {
        if (["running", "waiting_for_human"].includes(run.status)) this.options.database.cancelLoopRun(run.runId);
      }
    }
    this.options.roots.setStatus(rootRunId, "cancelled");
    for (const task of this.options.executions.listByRoot(rootRunId)) {
      if (["queued", "running"].includes(task.status)) await this.options.queue.cancel(task.id);
    }
    await this.finalizer.finalize(rootRunId, "cancelled");
    return this.detailRequired(rootRunId);
  }

  async respond(rootRunId: string, stepRunId: string, result: StepRunResult, input: string): Promise<RootRunDetail> {
    const root = this.options.roots.require(rootRunId);
    if (root.kind !== "loop") throw new Error("Only a Loop Run can contain a human gate.");
    const step = this.options.database.getStepRun(stepRunId);
    if (!step) throw new Error(`Step Run ${stepRunId} was not found.`);
    if (!this.options.database.listRootLoopRuns(rootRunId).some((run) => run.runId === step.runId)) {
      throw new Error(`Step Run ${stepRunId} does not belong to Root Run ${rootRunId}.`);
    }
    const snapshot = await this.runConfiguration(root);
    this.options.database.respondToStepRun(snapshot.automation, snapshot.loopThemes, step.runId, stepRunId, result, input);
    await this.enqueuePending(rootRunId);
    await this.syncLoopRoot(rootRunId);
    this.changed(rootRunId);
    return this.detailRequired(rootRunId);
  }

  async handleTerminal(task: ExecutionTask): Promise<void> {
    const root = this.options.roots.require(task.rootRunId);
    if (root.status === "cancelled" || (root.status === "finalizing" && root.finalizationTerminalStatus === "cancelled")) {
      await this.finalizer.finalize(root.rootRunId, "cancelled");
      return;
    }
    if (task.kind === "agent_run") {
      const successful = task.status === "succeeded" && task.outcome
        && ["ready", "approved"].includes(task.outcome.outcome);
      const status = task.status === "cancelled" ? "cancelled" : successful ? "completed"
        : task.status === "succeeded" ? "blocked" : "failed";
      this.options.roots.setStatus(root.rootRunId, status, {
        outcome: task.outcome, errorCode: task.errorCode, errorMessage: task.errorMessage,
        runtime: task.spec.runtime
      });
      await this.finalizer.finalize(root.rootRunId, status);
      return;
    }
    if (!task.spec.stepRunId) throw new Error("Loop task has no Step Run id.");
    if (task.errorCode === "interrupted") {
      const timestamp = new Date().toISOString();
      this.options.connection().transaction(() => {
        this.options.connection().prepare(`
          UPDATE step_runs SET status = 'failed', error = ?, completed_at = ?, updated_at = ?
          WHERE step_run_id = ? AND status IN ('queued','running')
        `).run(task.errorMessage ?? "Execution interrupted.", timestamp, timestamp, task.spec.stepRunId);
        this.options.connection().prepare(`
          UPDATE loop_runs SET status = 'failed', completed_at = ?, updated_at = ?
          WHERE run_id = ? AND status IN ('running','waiting_for_human')
        `).run(timestamp, timestamp, task.spec.loopRunId);
        this.options.roots.setStatus(task.rootRunId, "failed", {
          errorCode: task.errorCode, errorMessage: task.errorMessage, runtime: task.spec.runtime
        });
      })();
      await this.finalizer.finalize(task.rootRunId, "failed");
      return;
    }
    const snapshot = await this.runConfiguration(root);
    this.options.database.completeAgentStep(snapshot.automation, snapshot.loopThemes, {
      stepRunId: task.spec.stepRunId,
      outcome: task.outcome,
      error: task.status === "succeeded" ? undefined : task.errorMessage ?? task.status
    });
    await this.enqueuePending(task.rootRunId);
    await this.syncLoopRoot(task.rootRunId);
  }

  handleStarted(task: ExecutionTask): void {
    if (task.kind === "loop_step" && task.spec.stepRunId) this.options.database.markStepRunRunning(task.spec.stepRunId);
    this.options.roots.setStatus(task.rootRunId, "running", { runtime: task.spec.runtime });
    this.changed(task.rootRunId);
  }

  async reconcile(): Promise<void> {
    const roots = this.options.roots.list();
    await this.workspaces.cleanupOrphans(new Set(roots.map((root) => root.rootRunId)));
    for (const root of roots) {
      if (root.status === "finalizing") await this.finalizer.finalize(root.rootRunId, root.finalizationTerminalStatus ?? "failed");
      else if (await this.applyUnreconciledTerminal(root)) continue;
      else if (root.kind === "loop" && isActiveRootStatus(root.status)) {
        await this.enqueuePending(root.rootRunId);
        await this.syncLoopRoot(root.rootRunId);
      } else if (root.status === "completed" && root.finalization?.report?.success) {
        await this.workspaces.cleanupSuccessful(root).catch(() => undefined);
      }
    }
  }

  private async startLoop(
    data: AppData,
    rootRunId: string,
    loopId: string,
    input: string | undefined,
    source: "manual" | "schedule",
    schedule?: { stepId: string; scheduledFor: string }
  ): Promise<void> {
    if (data.automationIssues.length > 0) throw new Error("Cannot start a Loop while project.json is invalid.");
    await validateLoopRunStart(data, loopId, input);
    const loop = data.automation.loops.find((candidate) => candidate.id === loopId);
    if (!loop) throw new Error(`Loop ${loopId} was not found.`);
    const plan = await this.planner.create(data, loopId);
    const workspace = await this.workspaces.prepare(rootRunId);
    if (plan && workspace.snapshotHash !== plan.project.snapshotHash) {
      await this.workspaces.discard(workspace);
      throw new Error("Project configuration changed during Run startup.");
    }
    const timestamp = new Date().toISOString();
    try {
      this.options.connection().transaction(() => {
        this.options.roots.create({
          rootRunId, kind: "loop", targetId: loopId, source, input,
          worktreePath: workspace.path, branch: workspace.branch, headSha: workspace.headSha,
          configHash: workspace.configHash, snapshotHash: workspace.snapshotHash, createdAt: timestamp
        });
        this.options.database.startLoopRun(data.automation, loopId, resolveLoopTheme(data.loopThemes, loop.theme),
          rootRunId, input, source, plan, schedule);
      })();
    } catch (error) {
      await this.workspaces.discard(workspace);
      throw error;
    }
    await this.enqueuePending(rootRunId);
    await this.syncLoopRoot(rootRunId);
  }

  private async enqueuePending(rootRunId: string): Promise<void> {
    const runs = this.options.database.listRootLoopRuns(rootRunId);
    const pending = runs.flatMap((run) => run.stepRuns.map((step) => ({ run, step })))
      .find(({ run, step }) => run.status === "running" && step.type === "agent"
        && step.status === "queued" && !step.executionTaskId);
    if (!pending?.step.agentId) return;
    const plan = runs.find((run) => run.executionPlan)?.executionPlan;
    const snapshot = plan?.steps.find((candidate) => candidate.loopId === pending.run.loopId
      && candidate.stepId === pending.step.stepId && candidate.agentId === pending.step.agentId);
    if (!snapshot || !plan) throw new Error(`Loop execution snapshot is missing ${pending.run.loopId}:${pending.step.stepId}.`);
    const taskId = randomUUID();
    const spec: ExecutionSpec = {
      version: 1, taskId, kind: "loop_step", rootRunId, loopRunId: pending.run.runId,
      stepRunId: pending.step.stepRunId, input: renderLoopStepPrompt(runs, pending.run, pending.step),
      agent: snapshot.agent, runtime: snapshot.runtime, project: plan.project, createdAt: new Date().toISOString()
    };
    this.options.connection().transaction(() => {
      this.options.executions.create(spec);
      this.options.database.bindStepExecution(pending.step.stepRunId, taskId, snapshot.runtime);
    })();
    this.options.queue.wake(snapshot.runtime.provider);
  }

  private async syncLoopRoot(rootRunId: string): Promise<void> {
    const runs = this.options.database.listRootLoopRuns(rootRunId);
    if (runs.some((run) => run.status === "waiting_for_human")) {
      this.options.roots.setStatus(rootRunId, "waiting_for_human"); return;
    }
    if (runs.some((run) => run.status === "running")) {
      const queued = this.options.executions.listByRoot(rootRunId).some((task) => task.status === "queued");
      this.options.roots.setStatus(rootRunId, queued ? "queued" : "running"); return;
    }
    const status = runs.some((run) => run.status === "failed") ? "failed"
      : runs.some((run) => run.status === "blocked") ? "blocked"
        : runs.some((run) => run.status === "cancelled") ? "cancelled" : "completed";
    this.options.roots.setStatus(rootRunId, status);
    await this.finalizer.finalize(rootRunId, status);
  }

  private detailRequired(rootRunId: string): RootRunDetail {
    const detail = this.detail(rootRunId);
    if (!detail) throw new Error(`Root Run ${rootRunId} was not found.`);
    return detail;
  }

  private changed(rootRunId: string): void { this.options.onChanged?.(rootRunId); }

  private async runConfiguration(root: StoredRootRun) {
    const configuration = this.projectConfigurations.load(root.worktreePath);
    if (!configuration.config) throw new Error("Run configuration snapshot is invalid.");
    const themes = await this.loopThemeRepository.load(root.worktreePath);
    if (themes.issues.length > 0) throw new Error("Run Loop theme snapshot is invalid.");
    return { automation: configuration.config, loopThemes: themes.themes };
  }

  private async applyUnreconciledTerminal(root: StoredRootRun): Promise<boolean> {
    if (!isActiveRootStatus(root.status)) return false;
    const terminal = this.options.executions.listByRoot(root.rootRunId).find((task) => {
      if (!["succeeded", "failed", "cancelled"].includes(task.status)) return false;
      if (task.kind === "agent_run") return root.kind === "agent";
      const step = task.spec.stepRunId ? this.options.database.getStepRun(task.spec.stepRunId) : undefined;
      return Boolean(step && ["queued", "running"].includes(step.status));
    });
    if (!terminal) return false;
    await this.handleTerminal(terminal);
    return true;
  }
}
