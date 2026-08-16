import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  CanonicalNodeOutcome,
  ExecutionEvent,
  ExecutionEventPage,
  ExecutionSpec,
  ExecutionTask
} from "../../shared/domain/runtime.js";
import { maxControlFlowTransitions } from "../../shared/domain/runtime.js";
import { parseNodeOutcomeForRole } from "../../shared/api/runtime-schemas.js";
import { nodeRunRowSchema } from "../runtime/RuntimeDbTypes.js";
import {
  executionEventRowSchema, executionTaskRowSchema, readExecutionInteger,
  readExecutionString, type ExecutionEventRow
} from "./ExecutionDbTypes.js";
import { ExecutionTaskNotFoundError } from "./ExecutionErrors.js";
import { assertExecutionSpecEvidence, toExecutionEvent, toExecutionTask } from "./ExecutionStoreMappers.js";
import { ExecutionTaskStateStore } from "./ExecutionTaskStateStore.js";
import { assertJsonValue, canonicalJson } from "../runtime/state/CanonicalJson.js";

const MAX_RETAINED_BYTES = 1024 * 1024;

export type ExecutionEventInput = Omit<ExecutionEvent, "id" | "taskId" | "contentBytes">;

export class ExecutionStore {
  private readonly states: ExecutionTaskStateStore;

  constructor(private readonly connection: () => Database.Database) {
    this.states = new ExecutionTaskStateStore(connection);
  }

  create(spec: ExecutionSpec): ExecutionTask {
    assertExecutionSpecEvidence(spec);
    const specJson = JSON.stringify(spec);
    this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO execution_tasks (
          task_id, provider, kind, root_run_id, node_run_id, status, spec_json, spec_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)
      `).run(spec.taskId, spec.runtime.provider, spec.kind, spec.rootRunId, spec.nodeRunId, specJson,
        createHash("sha256").update(specJson).digest("hex"), spec.createdAt, spec.createdAt);
      const bound = this.connection().prepare(`
        UPDATE node_runs SET execution_task_id = ?, updated_at = ?
        WHERE node_run_id = ? AND root_run_id = ? AND execution_task_id IS NULL AND status = 'queued'
      `).run(spec.taskId, spec.createdAt, spec.nodeRunId, spec.rootRunId);
      if (bound.changes !== 1) throw new Error(`Node Run ${spec.nodeRunId} cannot accept execution task ${spec.taskId}.`);
    })();
    return this.require(spec.taskId);
  }

  get(taskId: string): ExecutionTask | undefined {
    const row = this.connection().prepare("SELECT * FROM execution_tasks WHERE task_id = ?")
      .get(taskId);
    return row ? toExecutionTask(executionTaskRowSchema.parse(row)) : undefined;
  }

  require(taskId: string): ExecutionTask {
    const task = this.get(taskId);
    if (!task) throw new ExecutionTaskNotFoundError(`Execution task ${taskId} was not found.`);
    return task;
  }

  listByRoot(rootRunId: string): ExecutionTask[] {
    const rows = this.connection().prepare(`
      SELECT * FROM execution_tasks WHERE root_run_id = ? ORDER BY created_at, rowid
    `).all(rootRunId);
    return rows.map((row) => toExecutionTask(executionTaskRowSchema.parse(row)));
  }

  queued(provider: "codex" | "copilot"): ExecutionTask | undefined {
    const row = this.connection().prepare(`
      SELECT * FROM execution_tasks WHERE provider = ? AND status = 'queued'
      ORDER BY created_at, rowid LIMIT 1
    `).get(provider);
    return row ? toExecutionTask(executionTaskRowSchema.parse(row)) : undefined;
  }

  activeCount(provider?: "codex" | "copilot"): number {
    const row = provider
      ? this.connection().prepare("SELECT COUNT(*) count FROM execution_tasks WHERE provider = ? AND status IN ('queued','running')").get(provider)
      : this.connection().prepare("SELECT COUNT(*) count FROM execution_tasks WHERE status IN ('queued','running')").get();
    return readExecutionInteger(row, "count");
  }

  runningCount(provider: "codex" | "copilot"): number {
    return readExecutionInteger(this.connection().prepare(`
      SELECT COUNT(*) count FROM execution_tasks WHERE provider = ? AND status = 'running'
    `).get(provider), "count");
  }

  activeTasks(): ExecutionTask[] {
    const rows = this.connection().prepare(`
      SELECT * FROM execution_tasks WHERE status IN ('queued','running') ORDER BY created_at, rowid
    `).all();
    return rows.map((row) => toExecutionTask(executionTaskRowSchema.parse(row)));
  }

  claim(taskId: string): ExecutionTask | undefined {
    return this.states.claim(taskId, new Date().toISOString())
      ? this.require(taskId)
      : undefined;
  }

  cancelActiveByRoot(rootRunId: string, timestamp: string): string[] {
    return this.states.cancelActiveByRoot(rootRunId, timestamp);
  }

  rejectUnrunnableQueued(): ExecutionTask[] {
    return this.states.rejectUnrunnableQueued(new Date().toISOString())
      .map((taskId) => this.require(taskId));
  }

  finish(taskId: string, status: "succeeded" | "failed" | "cancelled", detail: {
    outcome?: CanonicalNodeOutcome; errorCode?: string; errorMessage?: string;
  } = {}): ExecutionTask {
    const existing = this.require(taskId);
    if (["succeeded", "failed", "cancelled"].includes(existing.status)) return existing;
    const effectiveStatus = existing.cancelRequestedAt ? "cancelled" : status;
    let outcomeJson: string | null = null;
    if (effectiveStatus === "succeeded") {
      if (!detail.outcome) throw new Error(`Execution task ${taskId} cannot succeed without a structured outcome.`);
      const outcome = parseNodeOutcomeForRole(existing.spec.evidence.nodeRole, detail.outcome);
      const value: unknown = outcome;
      assertJsonValue(value, { label: `Execution task ${taskId} outcome` });
      outcomeJson = canonicalJson(value);
    }
    const timestamp = new Date().toISOString();
    this.connection().prepare(`
      UPDATE execution_tasks SET status = ?, outcome_json = ?, error_code = ?, error_message = ?,
        completed_at = ?, updated_at = ? WHERE task_id = ? AND status IN ('queued','running')
    `).run(effectiveStatus, outcomeJson,
      effectiveStatus === "cancelled" ? null : detail.errorCode ?? null,
      effectiveStatus === "cancelled" ? null : detail.errorMessage ?? null,
      timestamp, timestamp, taskId);
    return this.require(taskId);
  }

  requestCancel(taskId: string): ExecutionTask {
    const task = this.require(taskId);
    if (["succeeded", "failed", "cancelled"].includes(task.status)) return task;
    const timestamp = new Date().toISOString();
    if (task.status === "queued") {
      this.connection().prepare(`
        UPDATE execution_tasks SET cancel_requested_at = ?, updated_at = ? WHERE task_id = ? AND status = 'queued'
      `).run(timestamp, timestamp, taskId);
      return this.finish(taskId, "cancelled");
    }
    this.connection().prepare(`
      UPDATE execution_tasks SET cancel_requested_at = COALESCE(cancel_requested_at, ?), updated_at = ?
      WHERE task_id = ? AND status = 'running'
    `).run(timestamp, timestamp, taskId);
    return this.require(taskId);
  }

  recoverInterrupted(): ExecutionTask[] {
    const taskIds = this.connection().prepare("SELECT task_id FROM execution_tasks WHERE status = 'running'")
      .all().map((row) => readExecutionString(row, "task_id"));
    return taskIds.map((taskId) => this.recoverInterruptedTask(taskId));
  }

  appendEvent(taskId: string, event: ExecutionEventInput): ExecutionEvent {
    let message = event.message;
    let dataJson = event.data ? JSON.stringify(event.data) : null;
    let bytes = Buffer.byteLength(message, "utf8") + Buffer.byteLength(dataJson ?? "", "utf8");
    if (!event.terminal && bytes > MAX_RETAINED_BYTES) {
      dataJson = null;
      message = truncateUtf8(message, MAX_RETAINED_BYTES);
      bytes = Buffer.byteLength(message, "utf8");
    }
    const transaction = this.connection().transaction(() => {
      const task = this.require(taskId);
      const sequence = Math.max(event.sequence, this.lastSequence(taskId) + 1);
      const inserted = this.connection().prepare(`
        INSERT INTO execution_events (
          task_id, sequence, source, kind, level, phase, item_id, message, data_json,
          content_bytes, terminal, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, sequence, event.source, event.kind, event.level, event.phase,
        event.itemId ?? null, message, dataJson,
        bytes, event.terminal ? 1 : 0, event.createdAt);
      this.connection().prepare(`
        UPDATE execution_tasks SET retained_content_bytes = retained_content_bytes + ?, last_sequence = ?, updated_at = ?
        WHERE task_id = ?
      `).run(bytes, sequence, event.createdAt, task.id);
      this.trim(taskId);
      return {
        id: Number(inserted.lastInsertRowid), task_id: taskId, sequence, source: event.source,
        kind: event.kind, level: event.level, phase: event.phase, item_id: event.itemId ?? null,
        message, data_json: dataJson, content_bytes: bytes, terminal: event.terminal ? 1 : 0,
        created_at: event.createdAt
      } satisfies ExecutionEventRow;
    });
    return toExecutionEvent(executionEventRowSchema.parse(transaction()));
  }

  events(taskId: string, after = 0, limit = 500): ExecutionEventPage {
    this.require(taskId);
    const rows = this.connection().prepare(`
      SELECT * FROM execution_events WHERE task_id = ? AND id > ? ORDER BY id LIMIT ?
    `).all(taskId, after, limit + 1).map((row) => executionEventRowSchema.parse(row));
    const selected = rows.slice(0, limit);
    const truncated = readExecutionInteger(
      this.connection().prepare("SELECT events_truncated FROM execution_tasks WHERE task_id = ?").get(taskId),
      "events_truncated"
    );
    return {
      entries: selected.map(toExecutionEvent),
      lastId: selected.at(-1)?.id ?? after,
      hasMore: rows.length > limit,
      truncated: Boolean(truncated)
    };
  }

  hasTerminalEvent(taskId: string): boolean {
    return Boolean(this.connection().prepare(`
      SELECT 1 FROM execution_events WHERE task_id = ? AND terminal = 1 LIMIT 1
    `).get(taskId));
  }

  private lastSequence(taskId: string): number {
    return readExecutionInteger(
      this.connection().prepare("SELECT last_sequence FROM execution_tasks WHERE task_id = ?").get(taskId),
      "last_sequence"
    );
  }

  private trim(taskId: string): void {
    const retainedBefore = readExecutionInteger(
      this.connection().prepare("SELECT retained_content_bytes FROM execution_tasks WHERE task_id = ?").get(taskId),
      "retained_content_bytes"
    );
    let retained = retainedBefore;
    while (retained > MAX_RETAINED_BYTES) {
      const oldest = this.connection().prepare(`
        SELECT id, content_bytes FROM execution_events WHERE task_id = ? AND terminal = 0 ORDER BY id LIMIT 1
      `).get(taskId);
      if (!oldest) break;
      const id = readExecutionInteger(oldest, "id");
      const contentBytes = readExecutionInteger(oldest, "content_bytes");
      this.connection().prepare("DELETE FROM execution_events WHERE id = ?").run(id);
      retained -= contentBytes;
    }
    if (retained !== retainedBefore) this.connection().prepare(`
      UPDATE execution_tasks SET retained_content_bytes = ?, events_truncated = 1 WHERE task_id = ?
    `).run(retained, taskId);
  }

  private recoverInterruptedTask(taskId: string): ExecutionTask {
    const timestamp = new Date().toISOString();
    const message = "Ballet stopped while this task was running; it was not replayed.";
    this.connection().transaction(() => {
      const task = this.require(taskId);
      this.connection().prepare(`
        UPDATE execution_tasks SET status = 'failed', error_code = 'interrupted', error_message = ?,
          completed_at = ?, updated_at = ? WHERE task_id = ? AND status = 'running'
      `).run(message, timestamp, timestamp, taskId);
      const value = this.connection().prepare("SELECT * FROM node_runs WHERE node_run_id = ?")
        .get(task.spec.nodeRunId);
      if (!value) return;
      const node = nodeRunRowSchema.parse(value);
      if (node.status !== "running") return;
      this.connection().prepare(`
        UPDATE node_runs SET status = 'interrupted', error_code = 'interrupted', error_message = ?,
          state_revision_after = ?, completed_at = ?, updated_at = ? WHERE node_run_id = ?
      `).run(message, node.state_revision_before, timestamp, timestamp, node.node_run_id);
      if (node.work_loop_node_run_id) this.connection().prepare(`
        UPDATE work_loop_node_runs SET status = 'failed', terminal = 'failed', active_node_run_id = NULL,
          state_revision_after = ?, error_code = 'interrupted', error_message = ?, completed_at = ?, updated_at = ?
        WHERE work_loop_node_run_id = ? AND status IN ('queued','running','waiting_for_input')
      `).run(node.state_revision_before, message, timestamp, timestamp, node.work_loop_node_run_id);
      this.connection().prepare(`
        UPDATE loop_invocations SET status = 'failed', completion_state_revision = ?,
          completed_at = ?, updated_at = ?
        WHERE loop_run_id = ? AND status IN ('queued','running','waiting_for_input')
      `).run(node.state_revision_before, timestamp, timestamp, node.loop_run_id);
      const root = this.connection().prepare(`
        SELECT current_state_revision, transition_count FROM root_runs WHERE root_run_id = ?
      `).get(node.root_run_id);
      const stateRevision = readExecutionInteger(root, "current_state_revision");
      const transitionCount = readExecutionInteger(root, "transition_count");
      const sequence = transitionCount + 1;
      const recordTransition = sequence <= maxControlFlowTransitions;
      this.connection().prepare(`
        UPDATE root_runs SET transition_count = ?, active_node_run_id = NULL,
          active_loop_run_id = NULL, updated_at = ? WHERE root_run_id = ?
      `).run(recordTransition ? sequence : transitionCount, timestamp, node.root_run_id);
      if (recordTransition) this.connection().prepare(`
          INSERT INTO control_flow_events (
            root_run_id, sequence, kind, state_revision, source_loop_run_id,
            source_work_loop_node_run_id, source_node_run_id, created_at
          ) VALUES (?, ?, 'execution_interrupted', ?, ?, ?, ?, ?)
        `).run(node.root_run_id, sequence, stateRevision, node.loop_run_id,
          node.work_loop_node_run_id, node.node_run_id, timestamp);
    })();
    return this.require(taskId);
  }
}

const truncateUtf8 = (value: string, maxBytes: number): string => {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(value.slice(0, middle), "utf8") <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return value.slice(0, low);
};
