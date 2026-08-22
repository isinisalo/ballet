import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ExecutionTask, NodeRun } from "../../shared/domain/runtime.js";
import type {
  RootRunDetail, RootRunListQuery, RootRunListResponse, RootRunStateProjection,
  RespondToNodeRunRequest, StartRootRunRequest
} from "../../shared/domain/runs.js";
import { composeExecutionPrompt, runtimeForNode } from "../execution/ExecutionComposition.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import type { ProjectContext } from "../project/ProjectContext.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import { GraphRunConflictError, GraphRunNotFoundError, GraphRunStateError } from "../runtime/GraphRunErrors.js";
import type { TkTracker } from "../tracker/TkTracker.js";
import type { TrackerOutbox } from "../tracker/TrackerOutbox.js";
import { GraphExecutionPlanner } from "./GraphExecutionPlanner.js";
import { RootRunStore } from "./RootRunStore.js";
import {
  currentPosition, decodeRunCursor, encodeRunCursor, isActiveRootStatus, publicRootSummary
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
  tracker: TkTracker;
  trackerOutbox: TrackerOutbox;
  onChanged?(rootRunId: string): void;
}

export class LocalRunService {
  private readonly workspaces: LocalWorkspaceManager;
  private readonly planner: GraphExecutionPlanner;

  constructor(private readonly options: LocalRunServiceOptions) {
    this.workspaces = new LocalWorkspaceManager(options.context);
    this.planner = new GraphExecutionPlanner(options.configurations, options.runtime);
  }

  async start(input: StartRootRunRequest): Promise<RootRunDetail> {
    const conflict = this.options.roots.active(input.kind, input.targetId);
    if (conflict) throw new GraphRunConflictError(
      `${input.kind === "graph" ? "Graph" : "Graph Node"} already has active Root Run ${conflict.rootRunId}.`
    );
    const rootRunId = randomUUID();
    let workspace;
    try {
      workspace = await this.workspaces.prepare(rootRunId);
    } catch (error) {
      throw new GraphRunStateError(`Run workspace preflight failed: ${message(error)}`);
    }
    try {
      const snapshot = await this.planner.create(workspace, input.kind, input.targetId);
      await this.workspaces.verifyPreparedSnapshot(workspace);
      await this.options.tracker.preflight(workspace.path, snapshot.issueTracker);
      const createdAt = new Date().toISOString();
      this.options.connection().transaction(() => {
        this.options.roots.create({
          rootRunId, kind: input.kind, targetId: input.targetId, input: input.input,
          worktreePath: workspace.path, branch: workspace.branch, headSha: workspace.headSha,
          configHash: workspace.configHash, snapshotHash: workspace.snapshotHash,
          executionSnapshot: snapshot, createdAt
        });
        this.options.database.initializeRoot(rootRunId);
      })();
    } catch (error) {
      await this.workspaces.discard(workspace);
      throw error;
    }
    await this.advance(rootRunId);
    this.changed(rootRunId);
    return this.detailRequired(rootRunId);
  }

  list(query: RootRunListQuery = {}): RootRunListResponse {
    const limit = Math.max(1, Math.min(100, query.limit ?? 50));
    const roots = this.options.roots.list().filter((root) =>
      !query.state || (query.state === "active") === isActiveRootStatus(root.status));
    const cursor = query.cursor ? decodeRunCursor(query.cursor) : undefined;
    const offset = cursor ? Math.max(0, roots.findIndex(({ rootRunId }) => rootRunId === cursor) + 1) : 0;
    const selected = roots.slice(offset, offset + limit);
    return {
      items: selected.map((root) => this.summary(root)),
      nextCursor: offset + selected.length < roots.length && selected.length > 0
        ? encodeRunCursor(selected.at(-1)!.rootRunId) : undefined
    };
  }

  detail(rootRunId: string): RootRunDetail | undefined {
    const root = this.options.roots.get(rootRunId);
    if (!root) return undefined;
    const graphNodeInvocations = this.options.database.listRootGraphNodeInvocations(rootRunId);
    const tasks = this.options.executions.listByRoot(rootRunId);
    const state = this.options.database.readRootState(rootRunId);
    const orchestration = this.options.database.readRootOrchestration(rootRunId);
    const repair = this.options.database.readRootRepair(rootRunId);
    return {
      ...publicRootSummary(root),
      current: currentPosition(root, graphNodeInvocations, tasks, repair),
      executionSnapshot: root.executionSnapshot,
      graphNodeInvocations,
      tasks,
      state,
      orchestration,
      repair,
      controlFlowEvents: this.options.database.listControlFlowEvents(rootRunId)
    };
  }

  state(rootRunId: string): RootRunStateProjection | undefined {
    return this.options.roots.get(rootRunId) ? this.options.database.readRootState(rootRunId) : undefined;
  }

  async cancel(rootRunId: string): Promise<RootRunDetail> {
    const root = this.options.roots.require(rootRunId);
    if (!isActiveRootStatus(root.status) || root.status === "finalizing") return this.detailRequired(rootRunId);
    const taskIds = this.options.executions.cancelActiveByRoot(rootRunId, new Date().toISOString());
    await Promise.all(taskIds.map((taskId) => this.options.queue.cancel(taskId).catch(() => undefined)));
    this.options.database.cancelRoot(rootRunId);
    await this.advance(rootRunId);
    this.changed(rootRunId);
    return this.detailRequired(rootRunId);
  }

  async respond(rootRunId: string, nodeRunId: string, request: RespondToNodeRunRequest): Promise<RootRunDetail> {
    const node = this.options.database.getNodeRun(nodeRunId);
    if (!node || node.rootRunId !== rootRunId) {
      throw new GraphRunNotFoundError(`Node Run ${nodeRunId} was not found in Root Run ${rootRunId}.`);
    }
    if (request.kind === "resume") this.options.database.resumeNode(rootRunId, nodeRunId, request.response);
    else {
      if (node.role !== request.kind || !isHumanNode(this.options.roots.require(rootRunId).executionSnapshot, node)) {
        throw new GraphRunConflictError(`Node Run ${nodeRunId} is not a Human ${request.kind} Node.`);
      }
      this.options.database.applyNodeOutcome(rootRunId, nodeRunId, request.outcome);
    }
    await this.advance(rootRunId);
    this.changed(rootRunId);
    return this.detailRequired(rootRunId);
  }

  async handleTerminal(task: ExecutionTask): Promise<void> {
    const root = this.options.roots.get(task.rootRunId);
    if (!root || !isActiveRootStatus(root.status)) return;
    if (task.status === "succeeded" && task.outcome) {
      this.options.database.applyNodeOutcome(task.rootRunId, task.spec.nodeRunId, task.outcome);
    } else {
      this.options.database.failExecutionNode(
        task.rootRunId, task.spec.nodeRunId,
        task.status === "cancelled" ? "cancelled" : "failed",
        task.errorMessage ?? `Execution task ${task.id} ${task.status}.`
      );
    }
    await this.advance(task.rootRunId);
    this.changed(task.rootRunId);
  }

  handleStarted(task: ExecutionTask): boolean {
    if (!this.options.database.isExecutionNodeRunnable(task.rootRunId, task.spec.nodeRunId, task.id)) return false;
    this.options.database.markNodeRunRunning(task.spec.nodeRunId);
    this.changed(task.rootRunId);
    return true;
  }

  async reconcile(): Promise<void> {
    for (const root of this.options.roots.list().filter((candidate) =>
      isActiveRootStatus(candidate.status) || !candidate.finalization && isTerminal(candidate.status))) {
      await this.advance(root.rootRunId);
    }
    await this.workspaces.cleanupOrphans(new Set(this.options.roots.list().map(({ rootRunId }) => rootRunId)));
  }

  private async enqueuePending(rootRunId: string): Promise<void> {
    const root = this.options.roots.require(rootRunId);
    for (const node of this.options.database.pendingNodeRuns(rootRunId)) {
      if (node.executionTaskId) continue;
      const taskId = randomUUID();
      const evidence = composeExecutionPrompt(root.executionSnapshot, this.options.database.buildTaskEnvelope(node.nodeRunId));
      const spec = {
        version: 9 as const,
        taskId,
        kind: "node_execution" as const,
        rootRunId,
        graphNodeInvocationId: node.graphNodeInvocationId,
        jobNodeInvocationId: node.jobNodeInvocationId,
        nodeRunId: node.nodeRunId,
        evidence,
        runtime: runtimeForNode(root.executionSnapshot, evidence.executionProfile.id),
        project: root.executionSnapshot.project,
        createdAt: new Date().toISOString()
      };
      this.options.executions.create(spec);
      this.options.queue.wake(spec.runtime.provider);
    }
  }

  private async advance(rootRunId: string): Promise<void> {
    let root = this.options.roots.require(rootRunId);
    if (root.status === "finalizing") {
      await this.finalizeRoot(rootRunId);
      return;
    }
    if (!await this.options.trackerOutbox.reconcileOrPause(root)) {
      this.changed(rootRunId);
      return;
    }
    root = this.options.roots.require(rootRunId);
    if (isTerminal(root.status)) {
      await this.finalizeRoot(rootRunId);
      return;
    }
    if (isActiveRootStatus(root.status)) await this.enqueuePending(rootRunId);
  }

  private async finalizeRoot(rootRunId: string): Promise<void> {
    let root = this.options.roots.require(rootRunId);
    const terminalStatus = root.status === "finalizing" ? root.finalizationTerminalStatus : root.status;
    if (!terminalStatus || !isTerminal(terminalStatus)) {
      throw new GraphRunStateError(`Root Run ${rootRunId} has no terminal status to finalize.`);
    }
    const success = terminalStatus === "completed";
    try {
      if (root.status !== "finalizing") root = this.options.roots.startFinalization(rootRunId, success, terminalStatus);
      const report = await this.workspaces.finalize(root, success);
      if (success) await this.workspaces.cleanupSuccessful(root);
      this.options.roots.finishFinalization(rootRunId, report);
    } catch (error) {
      this.options.roots.failFinalization(rootRunId, message(error));
    }
    this.changed(rootRunId);
  }

  private summary(root: ReturnType<RootRunStore["require"]>) {
    const invocations = this.options.database.listRootGraphNodeInvocations(root.rootRunId);
    const tasks = this.options.executions.listByRoot(root.rootRunId);
    const repair = this.options.database.readRootRepair(root.rootRunId);
    return { ...publicRootSummary(root), current: currentPosition(root, invocations, tasks, repair) };
  }

  private detailRequired(rootRunId: string): RootRunDetail {
    const detail = this.detail(rootRunId);
    if (!detail) throw new GraphRunNotFoundError(`Root Run ${rootRunId} was not found.`);
    return detail;
  }
  private changed(rootRunId: string): void { this.options.onChanged?.(rootRunId); }
}

const isHumanNode = (snapshot: ReturnType<RootRunStore["require"]>["executionSnapshot"], node: NodeRun): boolean => {
  const graphNode = snapshot.graph.graphNodes.find(({ id }) => id === node.graphNodeId);
  const job = graphNode?.jobNodes.find(({ id }) => id === node.jobNodeId);
  return node.role === "work" ? job?.workNode.type === "human"
    : node.role === "validation" ? job?.validationNode.type === "human" : false;
};
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
const isTerminal = (status: string): status is "completed"|"blocked"|"failed"|"cancelled" =>
  ["completed", "blocked", "failed", "cancelled"].includes(status);
