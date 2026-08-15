import type Database from "better-sqlite3";
import type {
  ExecutionTask,
  RespondToStepRunRequest
} from "../../shared/domain/runtime.js";
import type {
  RootRunDetail,
  RootRunListQuery,
  RootRunListResponse,
  StartRootRunRequest
} from "../../shared/domain/runs.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import type { ProjectContext } from "../project/ProjectContext.js";
import type { DispatchLoopScheduleResult, RuntimeDatabase } from "../runtime-db.js";
import { LoopRunNotFoundError, WorkLoopRuntimeUnavailableError } from "../runtime/LoopRunErrors.js";
import { RootFinalizationCoordinator } from "./RootFinalizationCoordinator.js";
import { RootRunExecutionCoordinator } from "./RootRunExecutionCoordinator.js";
import { RootRunStore } from "./RootRunStore.js";
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
  onChanged?(rootRunId: string): void;
}

export class LocalRunService {
  private readonly workspaces: LocalWorkspaceManager;
  private readonly finalizer: RootFinalizationCoordinator;
  private readonly coordinator: RootRunExecutionCoordinator;

  constructor(private readonly options: LocalRunServiceOptions) {
    this.workspaces = new LocalWorkspaceManager(options.context);
    this.finalizer = new RootFinalizationCoordinator(
      options.roots,
      options.executions,
      this.workspaces,
      (rootRunId) => this.changed(rootRunId)
    );
    this.coordinator = new RootRunExecutionCoordinator({
      ...options,
      finalizer: this.finalizer,
      workspaces: this.workspaces
    });
  }

  async start(
    _input: StartRootRunRequest,
    _source: "manual" | "schedule" = "manual",
    _schedule?: { stepId: string; scheduledFor: string }
  ): Promise<RootRunDetail> {
    void _input;
    void _source;
    void _schedule;
    throw new WorkLoopRuntimeUnavailableError();
  }

  async dispatchScheduled(input: {
    loopId: string;
    stepId: string;
    definitionHash: string;
    scheduledFor: string;
    nextRunAt?: string;
    updatedAt: string;
    canDispatch: () => boolean;
  }): Promise<DispatchLoopScheduleResult> {
    if (!input.canDispatch()) return { status: "stale" };
    const occurrence = {
      loopId: input.loopId,
      stepId: input.stepId,
      definitionHash: input.definitionHash,
      scheduledFor: input.scheduledFor,
      nextRunAt: input.nextRunAt,
      updatedAt: input.updatedAt
    };
    if (!this.options.database.completeLoopScheduleOccurrence({ ...occurrence, status: "started" })) {
      return { status: "stale" };
    }
    try {
      const detail = await this.start(
        { kind: "loop", targetId: input.loopId },
        "schedule",
        { stepId: input.stepId, scheduledFor: input.scheduledFor }
      );
      const run = detail.loopRuns[0];
      if (!run) throw new Error("Scheduled Root Run did not create a Loop Run.");
      const completed = this.options.database.finishReservedScheduleOccurrence({
        loopId: input.loopId,
        stepId: input.stepId,
        scheduledFor: input.scheduledFor,
        status: "started",
        runId: run.runId,
        updatedAt: input.updatedAt
      });
      return completed ? { status: "started", run } : { status: "stale" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const completed = this.options.database.finishReservedScheduleOccurrence({
        loopId: input.loopId,
        stepId: input.stepId,
        scheduledFor: input.scheduledFor,
        status: "skipped",
        error: message,
        updatedAt: input.updatedAt
      });
      return completed ? { status: "skipped", error: message } : { status: "stale" };
    }
  }

  list(query: RootRunListQuery = {}): RootRunListResponse {
    const limit = Math.max(1, Math.min(200, query.limit ?? 50));
    const runs = this.options.roots.list()
      .filter((run) => !query.state || (query.state === "active") === isActiveRootStatus(run.status));
    const cursor = query.cursor ? decodeRunCursor(query.cursor) : undefined;
    const offset = cursor ? Math.max(0, runs.findIndex((run) => run.rootRunId === cursor) + 1) : 0;
    const items = runs.slice(offset, offset + limit);
    return {
      items: items.map((run) => {
        const loops = this.options.database.listRootLoopRuns(run.rootRunId);
        const tasks = this.options.executions.listByRoot(run.rootRunId);
        return { ...publicRootSummary(run), current: currentPosition(loops, tasks) };
      }),
      nextCursor: offset + items.length < runs.length && items.length > 0
        ? encodeRunCursor(items.at(-1)!.rootRunId)
        : undefined
    };
  }

  detail(rootRunId: string): RootRunDetail | undefined {
    const root = this.options.roots.get(rootRunId);
    if (!root) return undefined;
    const loopRuns = this.options.database.listRootLoopRuns(rootRunId);
    const tasks = this.options.executions.listByRoot(rootRunId);
    return {
      ...publicRootSummary(root),
      current: currentPosition(loopRuns, tasks),
      executionSnapshot: root.executionSnapshot,
      loopRuns,
      tasks
    };
  }

  async cancel(rootRunId: string): Promise<RootRunDetail> {
    const root = this.options.roots.require(rootRunId);
    if (!isActiveRootStatus(root.status) || root.status === "finalizing") return this.detailRequired(rootRunId);
    await this.coordinator.cancelRoot(root);
    return this.detailRequired(rootRunId);
  }

  async respond(
    _rootRunId: string,
    _stepRunId: string,
    _request: RespondToStepRunRequest
  ): Promise<RootRunDetail> {
    void _rootRunId;
    void _stepRunId;
    void _request;
    throw new WorkLoopRuntimeUnavailableError();
  }

  handleTerminal(task: ExecutionTask): Promise<void> {
    return this.coordinator.handleTerminal(task);
  }

  handleStarted(task: ExecutionTask): boolean {
    return this.coordinator.handleStarted(task);
  }

  reconcile(): Promise<void> {
    return this.coordinator.reconcile();
  }

  private detailRequired(rootRunId: string): RootRunDetail {
    const detail = this.detail(rootRunId);
    if (!detail) throw new LoopRunNotFoundError(`Root Run ${rootRunId} was not found.`);
    return detail;
  }

  private changed(rootRunId: string): void {
    this.options.onChanged?.(rootRunId);
  }
}
