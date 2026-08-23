import type Database from "better-sqlite3";
import type { CanonicalNodeOutcome, NodeRun } from "../shared/domain/runtime.js";
import type { RootRunOrchestrationProjection, RootRunStateProjection } from "../shared/domain/runs.js";
import type { TaskEnvelopeV9 } from "../shared/domain/taskEnvelope.js";
import { RuntimeDbConnection, isPatchedSqliteVersion } from "./runtime/RuntimeDbConnection.js";
import { RuntimeEventStore } from "./runtime/RuntimeEventStore.js";
import { RuntimeFlowCoordinator } from "./runtime/RuntimeFlowCoordinator.js";
import { RuntimeInvocationStore } from "./runtime/RuntimeInvocationStore.js";
import { RuntimePolicyStore } from "./runtime/RuntimePolicyStore.js";
import { RuntimeStateStore } from "./runtime/RuntimeStateStore.js";

export { isPatchedSqliteVersion };

export class RuntimeDatabase {
  private readonly manager: RuntimeDbConnection;
  private readonly invocations: RuntimeInvocationStore;
  private readonly policies: RuntimePolicyStore;
  private readonly states: RuntimeStateStore;
  private readonly events: RuntimeEventStore;
  private readonly flow: RuntimeFlowCoordinator;

  constructor(dbPath: string) {
    this.manager = new RuntimeDbConnection(dbPath);
    const connection = () => this.connection();
    this.invocations = new RuntimeInvocationStore(connection);
    this.policies = new RuntimePolicyStore(connection);
    this.states = new RuntimeStateStore(connection);
    this.events = new RuntimeEventStore(connection);
    this.flow = new RuntimeFlowCoordinator(connection, this.invocations, this.policies, this.states, this.events);
  }

  close(): void { this.manager.close(); }
  connection(): Database.Database { return this.manager.connection(); }
  initializeRoot(rootRunId: string): void { this.connection().transaction(() => this.flow.initialize(rootRunId))(); }
  activeGraphNodeIds(): Set<string> { return this.invocations.activeGraphNodeIds(); }
  listGraphNodeInvocations(limit = 2_000) { return this.invocations.listAll(limit); }
  listRootGraphNodeInvocations(rootRunId: string) { return this.invocations.listRoot(rootRunId); }
  pendingNodeRuns(rootRunId: string): NodeRun[] { return this.invocations.pending(rootRunId); }
  getNodeRun(nodeRunId: string): NodeRun | undefined { return this.invocations.getNode(nodeRunId); }
  markNodeRunRunning(nodeRunId: string): NodeRun { return this.invocations.markRunning(nodeRunId); }
  isExecutionNodeRunnable(rootRunId: string, nodeRunId: string, taskId: string): boolean {
    const node = this.invocations.getNode(nodeRunId);
    if (!node || node.rootRunId !== rootRunId || node.status !== "queued") return false;
    if (node.executionTaskId && node.executionTaskId !== taskId) return false;
    if (!node.executionTaskId) this.invocations.attachTask(nodeRunId, taskId);
    return true;
  }
  applyNodeOutcome(rootRunId: string, nodeRunId: string, outcome: CanonicalNodeOutcome): void {
    this.connection().transaction(() => this.flow.applyOutcome(rootRunId, nodeRunId, outcome))();
  }
  resumeNode(rootRunId: string, nodeRunId: string, response: string): void {
    const node = this.invocations.requireNode(nodeRunId);
    if (node.rootRunId !== rootRunId) throw new Error(`Node Run ${nodeRunId} is outside Root Run ${rootRunId}.`);
    this.invocations.resume(nodeRunId, response);
    this.flow.setRootStatus(rootRunId, "running");
  }
  cancelRoot(rootRunId: string): void { this.connection().transaction(() => this.flow.cancel(rootRunId))(); }
  failExecutionNode(rootRunId: string, nodeRunId: string, status: "failed" | "cancelled", message: string): void {
    this.connection().transaction(() => this.flow.failNode(rootRunId, nodeRunId, status, message))();
  }
  buildTaskEnvelope(nodeRunId: string): TaskEnvelopeV9 { return this.flow.buildTaskEnvelope(nodeRunId); }
  readRootState(rootRunId: string): RootRunStateProjection { return this.states.read(rootRunId); }
  readRootOrchestration(rootRunId: string): RootRunOrchestrationProjection {
    return this.policies.read(rootRunId, this.flow.snapshot(rootRunId));
  }
  listControlFlowEvents(rootRunId: string) { return this.events.list(rootRunId); }
}
