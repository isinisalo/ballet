import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { JsonValue, ProjectLoop } from "../../shared/domain/automation.js";
import type {
  LoopRun, LoopRunDetails, LoopRunSource, NodeRun, NodeRunRole, NodeRunStatus,
  WorkLoopNodeRun
} from "../../shared/domain/runtime.js";
import { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import {
  loopRunRowSchema, nodeRunRowSchema, now, workLoopNodeRunRowSchema
} from "./RuntimeDbTypes.js";
import { toLoopRun, toNodeRun, toWorkLoopNodeRun } from "./RuntimeRowMappers.js";
import { canonicalJson } from "./state/CanonicalJson.js";
import { validateState } from "./state/StatePatch.js";
export interface CreateLoopRunInput {
  loopRunId?: string;
  loop: ProjectLoop;
  rootRunId: string;
  parentLoopRunId?: string;
  source: LoopRunSource;
  input?: JsonValue;
  schedule?: { workLoopNodeId: string; scheduledFor: string };
  orchestrationRequestId?: string;
  repairRequestId?: string;
  entryStateRevision?: number;
  nestingDepth?: number;
}

export interface CreateWorkLoopNodeRunInput {
  workLoopNodeRunId?: string;
  rootRunId: string;
  loopRunId: string;
  loopId: string;
  workLoopNodeId: string;
  attempt: number;
  stateRevisionBefore?: number;
}

export interface CreateNodeRunInput {
  nodeRunId?: string;
  rootRunId: string;
  loopRunId: string;
  workLoopNodeRunId?: string;
  role: NodeRunRole;
  loopId: string;
  workLoopNodeId?: string;
  nodeDefinitionId: string;
  input?: JsonValue;
  context?: JsonValue;
  attempt: number;
  stateRevisionBefore?: number;
  status?: Extract<NodeRunStatus, "queued" | "waiting_for_input">;
}

export class LoopRunStore {
  private readonly snapshots: RootExecutionSnapshotStore;

  constructor(private readonly connection: () => Database.Database) {
    this.snapshots = new RootExecutionSnapshotStore(connection);
  }

  getLoopRun(loopRunId: string): LoopRun | undefined {
    const value = this.connection().prepare("SELECT * FROM loop_invocations WHERE loop_run_id = ?").get(loopRunId);
    if (!value) return undefined;
    const row = loopRunRowSchema.parse(value);
    const snapshot = this.snapshots.require(row.root_run_id);
    return toLoopRun(row, this.snapshots.loop(snapshot, row.loop_id), snapshot.theme);
  }

  getWorkLoopNodeRun(workLoopNodeRunId: string): WorkLoopNodeRun | undefined {
    const value = this.connection().prepare(
      "SELECT * FROM work_loop_node_runs WHERE work_loop_node_run_id = ?"
    ).get(workLoopNodeRunId);
    return value ? toWorkLoopNodeRun(workLoopNodeRunRowSchema.parse(value)) : undefined;
  }

  getNodeRun(nodeRunId: string): NodeRun | undefined {
    const value = this.connection().prepare("SELECT * FROM node_runs WHERE node_run_id = ?").get(nodeRunId);
    return value ? toNodeRun(nodeRunRowSchema.parse(value)) : undefined;
  }

  details(loopRunId: string): LoopRunDetails | undefined {
    const run = this.getLoopRun(loopRunId);
    if (!run) return undefined;
    return {
      ...run,
      workLoopNodeRuns: this.connection().prepare(`
        SELECT * FROM work_loop_node_runs WHERE loop_run_id = ? ORDER BY created_at, rowid
      `).all(loopRunId).map((row) => toWorkLoopNodeRun(workLoopNodeRunRowSchema.parse(row))),
      nodeRuns: this.connection().prepare(`
        SELECT * FROM node_runs WHERE loop_run_id = ? ORDER BY created_at, rowid
      `).all(loopRunId).map((row) => toNodeRun(nodeRunRowSchema.parse(row)))
    };
  }

  list(limit = 500): LoopRunDetails[] {
    return this.ids("SELECT loop_run_id FROM loop_invocations ORDER BY created_at DESC, rowid DESC LIMIT ?", limit)
      .flatMap((id) => this.details(id) ?? []);
  }

  listByRoot(rootRunId: string): LoopRunDetails[] {
    return this.ids(
      "SELECT loop_run_id FROM loop_invocations WHERE root_run_id = ? ORDER BY created_at, rowid",
      rootRunId
    ).flatMap((id) => this.details(id) ?? []);
  }

  activeLoopIds(): string[] {
    return this.connection().prepare(`
      SELECT DISTINCT loop_id FROM loop_invocations WHERE status IN ('queued','running','waiting_for_input')
    `).all().map((value) => idRow(value, "loop_id"));
  }

  createLoopRun(input: CreateLoopRunInput): LoopRun {
    const loopRunId = input.loopRunId ?? randomUUID();
    const timestamp = now();
    const snapshot = this.snapshots.require(input.rootRunId);
    this.snapshots.loop(snapshot, input.loop.id);
    const nestingDepth = input.nestingDepth ?? 0;
    if (nestingDepth > snapshot.orchestrator.maxRepairDepth) {
      throw new Error(`Loop Run nesting depth ${nestingDepth} exceeds limit ${snapshot.orchestrator.maxRepairDepth}.`);
    }
    const revision = input.entryStateRevision ?? this.currentRevision(input.rootRunId);
    const inputJson = input.input === undefined ? null : canonicalJson(validateState(input.input));
    if (["flow", "repair"].includes(input.source) !== Boolean(input.orchestrationRequestId)) {
      throw new Error("A flow or repair Loop Run requires exactly one Orchestration Request identity.");
    }
    if ((input.source === "repair") !== Boolean(input.repairRequestId)) {
      throw new Error("A repair Loop Run requires exactly one Repair Request identity.");
    }
    this.connection().prepare(`
      INSERT INTO loop_invocations (
        loop_run_id, root_run_id, loop_id, parent_loop_run_id, source, status, input_json,
        orchestration_request_id, repair_request_id, schedule_work_loop_node_id, scheduled_for,
        entry_state_revision, nesting_depth, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(loopRunId, input.rootRunId, input.loop.id, input.parentLoopRunId ?? null, input.source, inputJson,
      input.orchestrationRequestId ?? null, input.repairRequestId ?? null,
      input.schedule?.workLoopNodeId ?? null, input.schedule?.scheduledFor ?? null,
      revision, nestingDepth, timestamp, timestamp);
    this.connection().prepare(`
      UPDATE root_runs SET active_loop_run_id = ?, status = 'running', updated_at = ? WHERE root_run_id = ?
    `).run(loopRunId, timestamp, input.rootRunId);
    return this.requireLoopRun(loopRunId);
  }

  bindOrchestrationFrame(loopRunId: string, frameId: string): LoopRun {
    const result = this.connection().prepare(`
      UPDATE loop_invocations SET orchestration_frame_id = ?, updated_at = ?
      WHERE loop_run_id = ? AND source = 'repair' AND orchestration_frame_id IS NULL
    `).run(frameId, now(), loopRunId);
    if (result.changes !== 1) throw new Error(`Repair Loop Run ${loopRunId} cannot accept frame ${frameId}.`);
    return this.requireLoopRun(loopRunId);
  }

  createWorkLoopNodeRun(input: CreateWorkLoopNodeRunInput): WorkLoopNodeRun {
    const id = input.workLoopNodeRunId ?? randomUUID();
    const timestamp = now();
    const snapshot = this.snapshots.require(input.rootRunId);
    const loop = this.snapshots.loop(snapshot, input.loopId);
    const node = loop.nodes.find((candidate) => candidate.id === input.workLoopNodeId);
    if (!node) throw new Error(`Work Loop Node ${input.loopId}:${input.workLoopNodeId} is missing from the Root snapshot.`);
    if (input.attempt > node.maxLocalAttempts) {
      throw new Error(`Work Loop Node attempt ${input.attempt} exceeds limit ${node.maxLocalAttempts}.`);
    }
    const revision = input.stateRevisionBefore ?? this.currentRevision(input.rootRunId);
    this.connection().prepare(`
      INSERT INTO work_loop_node_runs (
        work_loop_node_run_id, root_run_id, loop_run_id, loop_id, work_loop_node_id, attempt,
        status, state_revision_before, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)
    `).run(id, input.rootRunId, input.loopRunId, input.loopId, input.workLoopNodeId,
      input.attempt, revision, timestamp, timestamp);
    return this.requireWorkLoopNodeRun(id);
  }

  createNodeRun(input: CreateNodeRunInput): NodeRun {
    const id = input.nodeRunId ?? randomUUID();
    const timestamp = now();
    const snapshot = this.snapshots.require(input.rootRunId);
    if (input.role === "orchestrator") {
      if (input.workLoopNodeRunId || input.workLoopNodeId) {
        throw new Error("An orchestrator Node Run cannot belong to a Work Loop Node Run.");
      }
    } else {
      if (!input.workLoopNodeRunId || !input.workLoopNodeId) {
        throw new Error(`A ${input.role} Node Run must belong to a Work Loop Node Run.`);
      }
      const loop = this.snapshots.loop(snapshot, input.loopId);
      if (!loop.nodes.some((candidate) => candidate.id === input.workLoopNodeId)) {
        throw new Error(`Work Loop Node ${input.loopId}:${input.workLoopNodeId} is missing from the Root snapshot.`);
      }
    }
    const revision = input.stateRevisionBefore ?? this.currentRevision(input.rootRunId);
    const status = input.status ?? "queued";
    const transaction = this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO node_runs (
          node_run_id, root_run_id, loop_run_id, work_loop_node_run_id, role, loop_id,
          work_loop_node_id, node_definition_id, input_json, context_json, status, attempt,
          state_revision_before, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.rootRunId, input.loopRunId, input.workLoopNodeRunId ?? null, input.role,
        input.loopId, input.workLoopNodeId ?? null, input.nodeDefinitionId,
        jsonOrNull(input.input, "Node Run input"), jsonOrNull(input.context, "Node Run context"),
        status, input.attempt, revision, timestamp, timestamp);
      if (input.workLoopNodeRunId) this.connection().prepare(`
        UPDATE work_loop_node_runs SET active_node_run_id = ?, status = ?, updated_at = ?
        WHERE work_loop_node_run_id = ?
      `).run(id, status === "waiting_for_input" ? "waiting_for_input" : "running", timestamp, input.workLoopNodeRunId);
      this.connection().prepare(`
        UPDATE root_runs SET active_loop_run_id = ?, active_node_run_id = ?, updated_at = ?
        WHERE root_run_id = ?
      `).run(input.loopRunId, id, timestamp, input.rootRunId);
    });
    transaction();
    return this.requireNodeRun(id);
  }

  resumeOrchestratorNode(
    nodeRunId: string,
    attempt: number,
    revision: number,
    context: JsonValue
  ): NodeRun {
    const timestamp = now();
    const contextJson = jsonOrNull(context, `Orchestrator Node Run ${nodeRunId} resume context`);
    const transaction = this.connection().transaction(() => {
      const resumed = this.connection().prepare(`
        UPDATE node_runs SET status = 'queued', attempt = ?, state_revision_before = ?,
          state_revision_after = NULL, context_json = ?, outcome_json = NULL,
          execution_task_id = NULL, patch_json = NULL, patch_hash = NULL,
          error_code = NULL, error_message = NULL, completed_at = NULL, updated_at = ?
        WHERE node_run_id = ? AND role = 'orchestrator' AND status = 'waiting_for_input'
          AND attempt < ?
      `).run(attempt, revision, contextJson, timestamp, nodeRunId, attempt);
      if (resumed.changes !== 1) {
        throw new Error(`Orchestrator Node Run ${nodeRunId} cannot resume at attempt ${attempt}.`);
      }
      const node = this.requireNodeRun(nodeRunId);
      this.connection().prepare(`
        UPDATE loop_invocations SET status = 'running', updated_at = ?
        WHERE loop_run_id = ? AND status = 'waiting_for_input'
      `).run(timestamp, node.loopRunId);
      this.connection().prepare(`
        UPDATE root_runs SET status = 'running', active_loop_run_id = ?, active_node_run_id = ?, updated_at = ?
        WHERE root_run_id = ? AND status = 'waiting_for_input'
      `).run(node.loopRunId, nodeRunId, timestamp, node.rootRunId);
    });
    transaction();
    return this.requireNodeRun(nodeRunId);
  }

  markNodeRunning(nodeRunId: string): NodeRun {
    const timestamp = now();
    this.connection().prepare(`
      UPDATE node_runs SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ?
      WHERE node_run_id = ? AND status = 'queued'
    `).run(timestamp, timestamp, nodeRunId);
    return this.requireNodeRun(nodeRunId);
  }

  private requireLoopRun(id: string): LoopRun {
    const run = this.getLoopRun(id);
    if (!run) throw new Error(`Loop Run ${id} was not found.`);
    return run;
  }

  private requireWorkLoopNodeRun(id: string): WorkLoopNodeRun {
    const run = this.getWorkLoopNodeRun(id);
    if (!run) throw new Error(`Work Loop Node Run ${id} was not found.`);
    return run;
  }

  private requireNodeRun(id: string): NodeRun {
    const run = this.getNodeRun(id);
    if (!run) throw new Error(`Node Run ${id} was not found.`);
    return run;
  }

  private currentRevision(rootRunId: string): number {
    const value = this.connection().prepare("SELECT current_state_revision FROM root_runs WHERE root_run_id = ?").get(rootRunId);
    if (typeof value !== "object" || value === null || !("current_state_revision" in value)
      || typeof value.current_state_revision !== "number") throw new Error(`Root Run ${rootRunId} was not found.`);
    return value.current_state_revision;
  }

  private ids(sql: string, parameter: string | number): string[] {
    return this.connection().prepare(sql).all(parameter).map((value) => idRow(value, "loop_run_id"));
  }
}

const idRow = (value: unknown, key: string): string => {
  if (typeof value === "object" && value !== null && key in value) {
    const field = Reflect.get(value, key);
    if (typeof field === "string") return field;
  }
  throw new Error(`Runtime database returned an invalid ${key} row.`);
};
const jsonOrNull = (value: JsonValue | undefined, label: string): string | null =>
  value === undefined ? null : canonicalJson(validateInput(value, label));
const validateInput = (value: JsonValue, label: string): JsonValue => {
  try { return validateState(value); } catch (error) {
    throw new Error(`${label} is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
};
