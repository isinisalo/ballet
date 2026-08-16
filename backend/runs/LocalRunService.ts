import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ExecutionTask } from "../../shared/domain/runtime.js";
import type {
  RootRunDetail,
  RootRunListQuery,
  RootRunListResponse,
  RootRunStateProjection,
  RespondToNodeRunRequest,
  StartRootRunRequest
} from "../../shared/domain/runs.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import type { ProjectContext } from "../project/ProjectContext.js";
import type { DispatchLoopScheduleResult, RuntimeDatabase } from "../runtime-db.js";
import {
  LoopRunConflictError, LoopRunNotFoundError, LoopRunStateError
} from "../runtime/LoopRunErrors.js";
import { LoopExecutionPlanner } from "./LoopExecutionPlanner.js";
import { RootFinalizationCoordinator } from "./RootFinalizationCoordinator.js";
import { RootRunExecutionCoordinator } from "./RootRunExecutionCoordinator.js";
import { RootRunStore, type StoredRootRun } from "./RootRunStore.js";
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
  private readonly planner: LoopExecutionPlanner;
  private readonly coordinator: RootRunExecutionCoordinator;

  constructor(private readonly options: LocalRunServiceOptions) {
    this.workspaces = new LocalWorkspaceManager(options.context);
    this.finalizer = new RootFinalizationCoordinator(
      options.roots,
      options.executions,
      this.workspaces,
      (rootRunId) => this.changed(rootRunId)
    );
    this.planner = new LoopExecutionPlanner(options.configurations, options.runtime);
    this.coordinator = new RootRunExecutionCoordinator({
      ...options,
      finalizer: this.finalizer,
      workspaces: this.workspaces
    });
  }

  async start(
    input: StartRootRunRequest,
    source: "manual" | "schedule" = "manual",
    schedule?: { workLoopNodeId: string; scheduledFor: string }
  ): Promise<RootRunDetail> {
    const rootRunId = randomUUID();
    let workspace;
    try {
      workspace = await this.workspaces.prepare(rootRunId);
    } catch (error) {
      throw new LoopRunStateError(
        `Run workspace preflight failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    try {
      const snapshot = await this.planner.create(workspace, input.targetId, input.input ?? "");
      assertScheduledStart(snapshot, schedule);
      await this.workspaces.verifyPreparedSnapshot(workspace);
      const timestamp = new Date().toISOString();
      this.options.connection().transaction(() => {
        this.options.roots.create({
          rootRunId,
          kind: "loop",
          targetId: input.targetId,
          source,
          input: input.input,
          worktreePath: workspace.path,
          branch: workspace.branch,
          headSha: workspace.headSha,
          configHash: workspace.configHash,
          snapshotHash: workspace.snapshotHash,
          executionSnapshot: snapshot,
          createdAt: timestamp
        });
        this.options.database.startLoopRun(rootRunId, input.input, source, schedule);
        this.coordinator.preflightPending(rootRunId);
      })();
    } catch (error) {
      await this.workspaces.discard(workspace);
      throw error;
    }
    try {
      await this.coordinator.enqueuePending(rootRunId);
      await this.coordinator.sync(rootRunId);
    } catch (error) {
      await this.coordinator.failRoot(this.options.roots.require(rootRunId), error);
      throw error;
    }
    this.changed(rootRunId);
    return this.detailRequired(rootRunId);
  }

  async dispatchScheduled(input: {
    loopId: string;
    workLoopNodeId: string;
    definitionHash: string;
    scheduledFor: string;
    nextRunAt?: string;
    updatedAt: string;
    canDispatch: () => boolean;
  }): Promise<DispatchLoopScheduleResult> {
    if (!input.canDispatch()) return { status: "stale" };
    const occurrence = {
      loopId: input.loopId,
      workLoopNodeId: input.workLoopNodeId,
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
        { workLoopNodeId: input.workLoopNodeId, scheduledFor: input.scheduledFor }
      );
      const run = detail.loopRuns[0];
      if (!run) throw new Error("Scheduled Root Run did not create a Loop Run.");
      const completed = this.options.database.finishReservedScheduleOccurrence({
        loopId: input.loopId,
        workLoopNodeId: input.workLoopNodeId,
        scheduledFor: input.scheduledFor,
        status: "started",
        loopRunId: run.loopRunId,
        updatedAt: input.updatedAt
      });
      return completed ? { status: "started", run } : { status: "stale" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const completed = this.options.database.finishReservedScheduleOccurrence({
        loopId: input.loopId,
        workLoopNodeId: input.workLoopNodeId,
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
        const repair = this.options.database.readRootRepair(run.rootRunId);
        return { ...publicRootSummary(run), current: currentPosition(run, loops, tasks, repair) };
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
    const runtime = this.options.database.readRootRuntime(rootRunId);
    return {
      ...publicRootSummary(root),
      current: currentPosition(root, loopRuns, tasks, runtime.repair),
      executionSnapshot: root.executionSnapshot,
      loopRuns,
      tasks,
      ...runtime
    };
  }

  state(rootRunId: string): RootRunStateProjection | undefined {
    if (!this.options.roots.get(rootRunId)) return undefined;
    return this.options.database.readRootState(rootRunId);
  }

  async cancel(rootRunId: string): Promise<RootRunDetail> {
    const root = this.options.roots.require(rootRunId);
    if (!isActiveRootStatus(root.status) || root.status === "finalizing") return this.detailRequired(rootRunId);
    await this.coordinator.cancelRoot(root);
    return this.detailRequired(rootRunId);
  }

  async respond(
    rootRunId: string,
    nodeRunId: string,
    request: RespondToNodeRunRequest
  ): Promise<RootRunDetail> {
    const root = this.options.roots.require(rootRunId);
    const node = this.options.database.getNodeRun(nodeRunId);
    if (!node || node.rootRunId !== rootRunId) {
      throw new LoopRunNotFoundError(`Node Run ${nodeRunId} was not found in Root Run ${rootRunId}.`);
    }
    if (request.kind !== "resume") assertHumanNodeResponse(root, node, request.kind);
    try {
      this.options.connection().transaction(() => {
        if (request.kind === "resume") {
          this.options.database.resumeNode(rootRunId, nodeRunId, request.response);
        } else {
          this.options.database.applyNodeOutcome(rootRunId, nodeRunId, request.outcome);
        }
        this.coordinator.preflightPending(rootRunId);
      })();
    } catch (error) {
      if (error instanceof LoopRunStateError) throw new LoopRunConflictError(error.message);
      throw error;
    }
    await this.coordinator.enqueuePending(rootRunId);
    await this.coordinator.sync(rootRunId);
    this.changed(rootRunId);
    return this.detailRequired(rootRunId);
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

const assertScheduledStart = (
  snapshot: Awaited<ReturnType<LoopExecutionPlanner["create"]>>,
  schedule?: { workLoopNodeId: string }
): void => {
  if (!schedule) return;
  const loop = snapshot.loops.find((candidate) => candidate.id === snapshot.rootLoopId);
  const start = loop?.nodes.find((candidate) => candidate.id === loop.startNodeId);
  if (!loop || start?.work.type !== "scheduled" || start.id !== schedule.workLoopNodeId) {
    throw new LoopRunStateError(
      `Scheduled Work Node ${schedule.workLoopNodeId} is not the immutable start of Loop ${snapshot.rootLoopId}.`
    );
  }
};

const assertHumanNodeResponse = (
  root: StoredRootRun,
  node: NonNullable<ReturnType<RuntimeDatabase["getNodeRun"]>>,
  role: "work" | "validation"
): void => {
  const loop = root.executionSnapshot.loops.find((candidate) => candidate.id === node.loopId);
  const definition = loop?.nodes.find((candidate) => candidate.id === node.workLoopNodeId);
  const human = role === "work" ? definition?.work.type === "human" : definition?.validation.type === "human";
  if (node.role !== role || !human || node.executionTaskId) {
    throw new LoopRunConflictError(`Node Run ${node.nodeRunId} is not a Human ${role} Node awaiting this outcome.`);
  }
};
