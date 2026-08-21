import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { JsonValue, ProjectLoop } from "../../shared/domain/automation.js";
import type {
  LoopRun, LoopRunDetails, LoopRunSource, NodeRun, NodeRunRole, NodeRunStatus,
  JobRun
} from "../../shared/domain/runtime.js";
import { RootExecutionSnapshotStore } from "./RootExecutionSnapshotStore.js";
import {
  jobRunRowSchema, loopRunRowSchema, nodeRunRowSchema, now
} from "./RuntimeDbTypes.js";
import { toLoopRun, toNodeRun, toJobRun } from "./RuntimeRowMappers.js";
import { canonicalJson } from "./state/CanonicalJson.js";
import { validateState } from "./state/StatePatch.js";
export interface CreateLoopRunInput {
  loopRunId?: string;
  loop: ProjectLoop;
  rootRunId: string;
  parentLoopRunId?: string;
  source: LoopRunSource;
  input?: JsonValue;
  schedule?: { jobNodeId: string; scheduledFor: string };
  orchestrationRequestId?: string;
  repairRequestId?: string;
  entryStateRevision?: number;
  nestingDepth?: number;
}

export interface CreateJobRunInput {
  jobRunId?: string;
  rootRunId: string;
  loopRunId: string;
  loopId: string;
  jobNodeId: string;
  jobAttempt: number;
  stateRevisionBefore?: number;
}

export interface CreateNodeRunInput {
  nodeRunId?: string;
  rootRunId: string;
  loopRunId: string;
  jobRunId?: string;
  role: NodeRunRole;
  loopId: string;
  jobNodeId?: string;
  workflowNodeId?: string;
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

  getJobRun(jobRunId: string): JobRun | undefined {
    const value = this.connection().prepare(
      "SELECT * FROM job_runs WHERE job_run_id = ?"
    ).get(jobRunId);
    return value ? toJobRun(jobRunRowSchema.parse(value)) : undefined;
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
      jobRuns: this.connection().prepare(`
        SELECT * FROM job_runs WHERE loop_run_id = ? ORDER BY created_at, rowid
      `).all(loopRunId).map((row) => toJobRun(jobRunRowSchema.parse(row))),
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
    const maxRepairDepth = snapshot.orchestrator.repairRouter?.maxRepairDepth ?? 0;
    if (nestingDepth > maxRepairDepth) {
      throw new Error(`Loop Run nesting depth ${nestingDepth} exceeds limit ${maxRepairDepth}.`);
    }
    const revision = input.entryStateRevision ?? this.currentRevision(input.rootRunId);
    const inputJson = input.input === undefined ? null : canonicalJson(validateState(input.input));
    if ((input.source === "repair") !== Boolean(input.orchestrationRequestId)) {
      throw new Error("A repair Loop Run requires exactly one Orchestration Request identity.");
    }
    if ((input.source === "repair") !== Boolean(input.repairRequestId)) {
      throw new Error("A repair Loop Run requires exactly one Repair Request identity.");
    }
    this.connection().prepare(`
      INSERT INTO loop_invocations (
        loop_run_id, root_run_id, loop_id, parent_loop_run_id, source, status, input_json,
        orchestration_request_id, repair_request_id, schedule_job_node_id, scheduled_for,
        entry_state_revision, nesting_depth, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(loopRunId, input.rootRunId, input.loop.id, input.parentLoopRunId ?? null, input.source, inputJson,
      input.orchestrationRequestId ?? null, input.repairRequestId ?? null,
      input.schedule?.jobNodeId ?? null, input.schedule?.scheduledFor ?? null,
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

  createJobRun(input: CreateJobRunInput): JobRun {
    const id = input.jobRunId ?? randomUUID();
    const timestamp = now();
    const snapshot = this.snapshots.require(input.rootRunId);
    const loop = this.snapshots.loop(snapshot, input.loopId);
    const node = loop.workflow.jobNodes.find((candidate) => candidate.id === input.jobNodeId);
    if (!node) throw new Error(`Job Node ${input.loopId}:${input.jobNodeId} is missing from the Root snapshot.`);
    if (input.jobAttempt > node.maxRetries + 1) {
      throw new Error(`Job attempt ${input.jobAttempt} exceeds limit ${node.maxRetries + 1}.`);
    }
    const revision = input.stateRevisionBefore ?? this.currentRevision(input.rootRunId);
    this.connection().prepare(`
      INSERT INTO job_runs (
        job_run_id, root_run_id, loop_run_id, loop_id, job_node_id, job_attempt,
        status, state_revision_before, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)
    `).run(id, input.rootRunId, input.loopRunId, input.loopId, input.jobNodeId,
      input.jobAttempt, revision, timestamp, timestamp);
    return this.requireJobRun(id);
  }

  createNodeRun(input: CreateNodeRunInput): NodeRun {
    const id = input.nodeRunId ?? randomUUID();
    const timestamp = now();
    const snapshot = this.snapshots.require(input.rootRunId);
    if (input.role === "orchestrator") {
      if (input.jobRunId || input.jobNodeId || input.workflowNodeId) {
        throw new Error("An orchestrator Node Run cannot belong to a Job Run.");
      }
    } else {
      if (!input.jobRunId || !input.jobNodeId || !input.workflowNodeId) {
        throw new Error(`A ${input.role} Node Run must belong to a Job Run and identify its Workflow Node.`);
      }
      const loop = this.snapshots.loop(snapshot, input.loopId);
      const job = loop.workflow.jobNodes.find((candidate) => candidate.id === input.jobNodeId);
      if (!job) {
        throw new Error(`Job Node ${input.loopId}:${input.jobNodeId} is missing from the Root snapshot.`);
      }
      const expectedWorkflowNodeId = input.role === "job" ? job.id : job.validationNodeId;
      if (input.workflowNodeId !== expectedWorkflowNodeId) {
        throw new Error(
          `${input.role} Workflow Node ${input.workflowNodeId} does not match Job Node ${input.loopId}:${input.jobNodeId}.`
        );
      }
    }
    const revision = input.stateRevisionBefore ?? this.currentRevision(input.rootRunId);
    const status = input.status ?? "queued";
    const transaction = this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO node_runs (
          node_run_id, root_run_id, loop_run_id, job_run_id, role, loop_id,
          job_node_id, workflow_node_id, node_definition_id, input_json, context_json, status, attempt,
          state_revision_before, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.rootRunId, input.loopRunId, input.jobRunId ?? null, input.role,
        input.loopId, input.jobNodeId ?? null, input.workflowNodeId ?? null, input.nodeDefinitionId,
        jsonOrNull(input.input, "Node Run input"), jsonOrNull(input.context, "Node Run context"),
        status, input.attempt, revision, timestamp, timestamp);
      if (input.jobRunId) this.connection().prepare(`
        UPDATE job_runs SET active_node_run_id = ?, status = ?, updated_at = ?
        WHERE job_run_id = ?
      `).run(id, status === "waiting_for_input" ? "waiting_for_input" : "running", timestamp, input.jobRunId);
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

  private requireJobRun(id: string): JobRun {
    const run = this.getJobRun(id);
    if (!run) throw new Error(`Job Run ${id} was not found.`);
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
