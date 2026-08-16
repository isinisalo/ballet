import type Database from "better-sqlite3";
import type {
  CanonicalNodeOutcome, ControlFlowEvent, LoopRunDetails, LoopRunSource, LoopScheduleState, NodeRun,
  OrchestrationFrame, OrchestratorRoute, RepairRequest, WorkLoopNodeRun
} from "../shared/domain/runtime.js";
import { maxControlFlowTransitions } from "../shared/domain/runtime.js";
import { ControlFlowStore } from "./runtime/ControlFlowStore.js";
import { LoopRunStore } from "./runtime/LoopRunStore.js";
import { LoopStateStore } from "./runtime/LoopStateStore.js";
import {
  LoopScheduleStateStore, type CompleteScheduleOccurrenceInput, type ScheduleDefinitionState
} from "./runtime/LoopScheduleStateStore.js";
import { RepairStore } from "./runtime/RepairStore.js";
import { WorkLoopEngine } from "./runtime/WorkLoopEngine.js";
import { RuntimeDbConnection, isPatchedSqliteVersion } from "./runtime/RuntimeDbConnection.js";

export { isPatchedSqliteVersion };

export type DispatchLoopScheduleResult =
  | { status: "started"; run: LoopRunDetails }
  | { status: "skipped"; error: string }
  | { status: "missed"; error: string }
  | { status: "stale" };

export class RuntimeDatabase {
  private readonly connectionManager: RuntimeDbConnection;
  private readonly loopRunStore: LoopRunStore;
  private readonly workLoopEngine: WorkLoopEngine;
  readonly state: LoopStateStore;
  readonly repair: RepairStore;
  readonly control: ControlFlowStore;
  private readonly loopScheduleStateStore: LoopScheduleStateStore;

  constructor(dbPath: string) {
    this.connectionManager = new RuntimeDbConnection(dbPath);
    const connection = () => this.connection();
    this.loopRunStore = new LoopRunStore(connection);
    this.state = new LoopStateStore(connection);
    this.repair = new RepairStore(connection);
    this.workLoopEngine = new WorkLoopEngine(connection, this.loopRunStore, this.state, this.repair);
    this.control = new ControlFlowStore(connection);
    this.loopScheduleStateStore = new LoopScheduleStateStore(connection);
  }

  close(): void { this.connectionManager.close(); }
  connection(): Database.Database { return this.connectionManager.connection(); }

  startLoopRun(
    rootRunId: string,
    input?: string,
    source: LoopRunSource = "manual",
    schedule?: { workLoopNodeId: string; scheduledFor: string }
  ): LoopRunDetails {
    return this.workLoopEngine.start(rootRunId, input, source, schedule);
  }

  applyNodeOutcome(rootRunId: string, nodeRunId: string, outcome: CanonicalNodeOutcome): LoopRunDetails {
    return this.workLoopEngine.applyNodeOutcome(rootRunId, nodeRunId, outcome);
  }

  resumeNode(rootRunId: string, nodeRunId: string, response: string): LoopRunDetails {
    return this.workLoopEngine.resumeNode(rootRunId, nodeRunId, response);
  }

  markNodeRunRunning(nodeRunId: string): NodeRun { return this.workLoopEngine.markNodeRunning(nodeRunId); }

  listLoopRuns(limit = 500): LoopRunDetails[] { return this.loopRunStore.list(limit); }
  listRootLoopRuns(rootRunId: string): LoopRunDetails[] { return this.loopRunStore.listByRoot(rootRunId); }
  activeLoopIds(): string[] { return this.loopRunStore.activeLoopIds(); }
  getNodeRun(nodeRunId: string): NodeRun | undefined { return this.loopRunStore.getNodeRun(nodeRunId); }
  getWorkLoopNodeRun(workLoopNodeRunId: string): WorkLoopNodeRun | undefined {
    return this.loopRunStore.getWorkLoopNodeRun(workLoopNodeRunId);
  }
  getRepairRequest(repairRequestId: string): RepairRequest | undefined {
    return this.repair.getRequest(repairRequestId);
  }
  getOrchestrationFrame(frameId: string): OrchestrationFrame | undefined {
    return this.repair.getFrame(frameId);
  }
  getOrchestratorRoute(routeId: string): OrchestratorRoute | undefined {
    return this.repair.getRoute(routeId);
  }
  listControlFlowEvents(rootRunId: string): ControlFlowEvent[] {
    return this.control.listByRoot(rootRunId);
  }

  listLoopScheduleStates(): LoopScheduleState[] { return this.loopScheduleStateStore.list(); }

  syncLoopScheduleDefinitions(definitions: ScheduleDefinitionState[], updatedAt: string): boolean {
    const validKeys = new Set(definitions.map((definition) =>
      `${definition.loopId}\0${definition.workLoopNodeId}`));
    return this.connection().transaction(() => {
      let changed = false;
      definitions.forEach((definition) => {
        changed = this.loopScheduleStateStore.replaceDefinition(definition, updatedAt) || changed;
      });
      return this.loopScheduleStateStore.prune(validKeys) || changed;
    })();
  }

  completeLoopScheduleOccurrence(input: CompleteScheduleOccurrenceInput): boolean {
    return this.loopScheduleStateStore.completeOccurrence(input);
  }

  finishReservedScheduleOccurrence(input: {
    loopId: string;
    workLoopNodeId: string;
    scheduledFor: string;
    status: "started" | "skipped";
    loopRunId?: string;
    error?: string;
    updatedAt: string;
  }): boolean {
    const result = this.connection().prepare(`
      UPDATE loop_schedule_state SET last_status = ?, last_loop_run_id = ?, last_error = ?, updated_at = ?
      WHERE loop_id = ? AND work_loop_node_id = ? AND last_scheduled_at = ?
    `).run(input.status, input.loopRunId ?? null, input.error ?? null, input.updatedAt,
      input.loopId, input.workLoopNodeId, input.scheduledFor);
    return result.changes === 1;
  }

  recoverReservedScheduleOccurrences(updatedAt = new Date().toISOString()): void {
    const rows = this.connection().prepare(`
      SELECT loop_id, work_loop_node_id, last_scheduled_at FROM loop_schedule_state
      WHERE last_status = 'started' AND last_loop_run_id IS NULL AND last_scheduled_at IS NOT NULL
    `).all().map(readReservedScheduleRow);
    this.connection().transaction(() => {
      for (const row of rows) {
        const value = this.connection().prepare(`
          SELECT loop_run_id FROM loop_invocations
          WHERE loop_id = ? AND schedule_work_loop_node_id = ? AND scheduled_for = ? LIMIT 1
        `).get(row.loopId, row.workLoopNodeId, row.scheduledFor);
        const loopRunId = value ? readStringField(value, "loop_run_id") : undefined;
        this.connection().prepare(`
          UPDATE loop_schedule_state SET last_status = ?, last_loop_run_id = ?, last_error = ?, updated_at = ?
          WHERE loop_id = ? AND work_loop_node_id = ? AND last_scheduled_at = ?
        `).run(loopRunId ? "started" : "missed", loopRunId ?? null,
          loopRunId ? null : "Scheduled occurrence was interrupted before its Loop Run was stored.", updatedAt,
          row.loopId, row.workLoopNodeId, row.scheduledFor);
      }
    })();
  }

  terminalizeActiveRootRuns(
    rootRunId: string,
    status: "failed" | "cancelled",
    error: string | undefined,
    completedAt = new Date().toISOString(),
    errorCode = "orchestration_failed"
  ): void {
    this.connection().transaction(() => {
      const root = this.connection().prepare(`
        SELECT current_state_revision, transition_count, active_loop_run_id, active_node_run_id
        FROM root_runs WHERE root_run_id = ?
      `).get(rootRunId);
      const stateRevision = readNumberField(root, "current_state_revision");
      const transitionCount = readNumberField(root, "transition_count");
      const sequence = transitionCount + 1;
      const recordTransition = sequence <= maxControlFlowTransitions;
      const activeLoopRunId = readOptionalStringField(root, "active_loop_run_id");
      const activeNodeRunId = readOptionalStringField(root, "active_node_run_id");
      const activeNode = activeNodeRunId ? this.getNodeRun(activeNodeRunId) : undefined;
      const nodeStatus = status === "failed" ? "failed" : "cancelled";
      this.connection().prepare(`
        UPDATE node_runs SET status = ?, state_revision_after = ?, error_code = ?, error_message = ?,
          completed_at = ?, updated_at = ?
        WHERE root_run_id = ? AND status IN ('queued','running','waiting_for_input')
      `).run(nodeStatus, stateRevision, status === "failed" ? errorCode : null,
        error ?? null, completedAt, completedAt, rootRunId);
      this.connection().prepare(`
        UPDATE work_loop_node_runs SET status = ?, state_revision_after = ?, terminal = ?,
          active_node_run_id = NULL, completed_at = ?, updated_at = ?
        WHERE root_run_id = ? AND status IN ('queued','running','waiting_for_input')
      `).run(status, stateRevision, status, completedAt, completedAt, rootRunId);
      this.connection().prepare(`
        UPDATE loop_invocations SET status = ?, completion_state_revision = ?, completed_at = ?, updated_at = ?
        WHERE root_run_id = ? AND status IN ('queued','running','waiting_for_input')
      `).run(status, stateRevision, completedAt, completedAt, rootRunId);
      this.connection().prepare(`
        UPDATE repair_requests SET status = 'cancelled', completed_at = ?, updated_at = ?
        WHERE root_run_id = ? AND status IN ('pending','routed')
      `).run(completedAt, completedAt, rootRunId);
      this.connection().prepare(`
        UPDATE orchestration_frames SET status = 'cancelled', completed_at = ?, updated_at = ?
        WHERE root_run_id = ? AND status = 'open'
      `).run(completedAt, completedAt, rootRunId);
      this.connection().prepare(`
        UPDATE root_runs SET transition_count = ?, active_loop_run_id = NULL,
          active_node_run_id = NULL, updated_at = ? WHERE root_run_id = ?
      `).run(recordTransition ? sequence : transitionCount, completedAt, rootRunId);
      if (recordTransition) this.connection().prepare(`
          INSERT INTO control_flow_events (
            root_run_id, sequence, kind, state_revision, source_loop_run_id,
            source_work_loop_node_run_id, source_node_run_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(rootRunId, sequence, status === "cancelled" ? "root_cancelled" : "root_terminal",
          stateRevision, activeLoopRunId ?? activeNode?.loopRunId ?? null,
          activeNode?.workLoopNodeRunId ?? null, activeNodeRunId ?? null, completedAt);
    })();
  }

  isExecutionNodeRunnable(rootRunId: string, nodeRunId: string, taskId: string): boolean {
    return Boolean(this.connection().prepare(`
      SELECT 1 FROM root_runs root
      JOIN node_runs node ON node.root_run_id = root.root_run_id
      JOIN loop_invocations loop ON loop.loop_run_id = node.loop_run_id
      WHERE root.root_run_id = ? AND root.status IN ('queued','running','waiting_for_input')
        AND loop.status = 'running' AND node.node_run_id = ? AND node.status = 'queued'
        AND node.execution_task_id = ? AND root.active_loop_run_id = loop.loop_run_id
        AND root.active_node_run_id = node.node_run_id LIMIT 1
    `).get(rootRunId, nodeRunId, taskId));
  }
}

const readStringField = (value: unknown, key: string): string => {
  if (typeof value === "object" && value !== null && key in value) {
    const field = Reflect.get(value, key);
    if (typeof field === "string") return field;
  }
  throw new Error(`Runtime database returned an invalid ${key} value.`);
};
const readReservedScheduleRow = (value: unknown) => ({
  loopId: readStringField(value, "loop_id"),
  workLoopNodeId: readStringField(value, "work_loop_node_id"),
  scheduledFor: readStringField(value, "last_scheduled_at")
});
const readNumberField = (value: unknown, key: string): number => {
  if (typeof value === "object" && value !== null && key in value) {
    const field = Reflect.get(value, key);
    if (typeof field === "number" && Number.isSafeInteger(field)) return field;
  }
  throw new Error(`Runtime database returned an invalid ${key} value.`);
};
const readOptionalStringField = (value: unknown, key: string): string | undefined => {
  if (typeof value === "object" && value !== null && key in value) {
    const field = Reflect.get(value, key);
    if (field === null) return undefined;
    if (typeof field === "string") return field;
  }
  throw new Error(`Runtime database returned an invalid ${key} value.`);
};
