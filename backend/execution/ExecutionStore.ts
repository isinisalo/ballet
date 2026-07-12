import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  AgentOutcome,
  ExecutionEvent,
  ExecutionEventPage,
  ExecutionSpec,
  ExecutionTask,
  ExecutionTaskStatus
} from "../../shared/domain/runtime.js";
import { ExecutionTaskNotFoundError } from "./ExecutionErrors.js";

const MAX_RETAINED_BYTES = 1024 * 1024;

interface TaskRow {
  task_id: string; kind: ExecutionTask["kind"]; root_run_id: string; status: ExecutionTaskStatus;
  spec_json: string; started_at: string | null; completed_at: string | null;
  cancel_requested_at: string | null; error_code: string | null; error_message: string | null;
  outcome_json: string | null; events_truncated: 0 | 1; created_at: string; updated_at: string;
}

interface EventRow {
  id: number; task_id: string; sequence: number; source: ExecutionEvent["source"];
  kind: ExecutionEvent["kind"]; level: ExecutionEvent["level"]; phase: ExecutionEvent["phase"];
  item_id: string | null; message: string; data_json: string | null; content_bytes: number;
  terminal: 0 | 1; created_at: string;
}

export type ExecutionEventInput = Omit<ExecutionEvent, "id" | "taskId" | "contentBytes">;

export class ExecutionStore {
  constructor(private readonly connection: () => Database.Database) {}

  create(spec: ExecutionSpec): ExecutionTask {
    const specJson = JSON.stringify(spec);
    this.connection().prepare(`
      INSERT INTO execution_tasks (
        task_id, provider, kind, root_run_id, status, spec_json, spec_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)
    `).run(spec.taskId, spec.runtime.provider, spec.kind, spec.rootRunId, specJson,
      createHash("sha256").update(specJson).digest("hex"), spec.createdAt, spec.createdAt);
    return this.require(spec.taskId);
  }

  get(taskId: string): ExecutionTask | undefined {
    const row = this.connection().prepare("SELECT * FROM execution_tasks WHERE task_id = ?")
      .get(taskId) as TaskRow | undefined;
    return row ? toTask(row) : undefined;
  }

  require(taskId: string): ExecutionTask {
    const task = this.get(taskId);
    if (!task) throw new ExecutionTaskNotFoundError(`Execution task ${taskId} was not found.`);
    return task;
  }

  listByRoot(rootRunId: string): ExecutionTask[] {
    const rows = this.connection().prepare(`
      SELECT * FROM execution_tasks WHERE root_run_id = ? ORDER BY created_at, rowid
    `).all(rootRunId) as TaskRow[];
    return rows.map(toTask);
  }

  queued(provider: "codex" | "copilot"): ExecutionTask | undefined {
    const row = this.connection().prepare(`
      SELECT * FROM execution_tasks WHERE provider = ? AND status = 'queued'
      ORDER BY created_at, rowid LIMIT 1
    `).get(provider) as TaskRow | undefined;
    return row ? toTask(row) : undefined;
  }

  activeCount(provider?: "codex" | "copilot"): number {
    const row = provider
      ? this.connection().prepare("SELECT COUNT(*) count FROM execution_tasks WHERE provider = ? AND status IN ('queued','running')").get(provider)
      : this.connection().prepare("SELECT COUNT(*) count FROM execution_tasks WHERE status IN ('queued','running')").get();
    return (row as { count: number }).count;
  }

  runningCount(provider: "codex" | "copilot"): number {
    return (this.connection().prepare(`
      SELECT COUNT(*) count FROM execution_tasks WHERE provider = ? AND status = 'running'
    `).get(provider) as { count: number }).count;
  }

  activeTasks(): ExecutionTask[] {
    const rows = this.connection().prepare(`
      SELECT * FROM execution_tasks WHERE status IN ('queued','running') ORDER BY created_at, rowid
    `).all() as TaskRow[];
    return rows.map(toTask);
  }

  start(taskId: string): ExecutionTask {
    const timestamp = new Date().toISOString();
    this.connection().prepare(`
      UPDATE execution_tasks SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ?
      WHERE task_id = ? AND status = 'queued'
    `).run(timestamp, timestamp, taskId);
    return this.require(taskId);
  }

  finish(taskId: string, status: "succeeded" | "failed" | "cancelled", detail: {
    outcome?: AgentOutcome; errorCode?: string; errorMessage?: string;
  } = {}): ExecutionTask {
    const existing = this.require(taskId);
    if (["succeeded", "failed", "cancelled"].includes(existing.status)) return existing;
    const effectiveStatus = existing.cancelRequestedAt ? "cancelled" : status;
    const timestamp = new Date().toISOString();
    this.connection().prepare(`
      UPDATE execution_tasks SET status = ?, outcome_json = ?, error_code = ?, error_message = ?,
        completed_at = ?, updated_at = ? WHERE task_id = ? AND status IN ('queued','running')
    `).run(effectiveStatus, effectiveStatus === "cancelled" ? null : detail.outcome ? JSON.stringify(detail.outcome) : null,
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
    const rows = this.connection().prepare("SELECT task_id FROM execution_tasks WHERE status = 'running'")
      .all() as Array<{ task_id: string }>;
    return rows.map((row) => this.finish(row.task_id, "failed", {
      errorCode: "interrupted", errorMessage: "Ballet stopped while this task was running; it was not replayed."
    }));
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
      } satisfies EventRow;
    });
    return toEvent(transaction() as EventRow);
  }

  events(taskId: string, after = 0, limit = 500): ExecutionEventPage {
    this.require(taskId);
    const rows = this.connection().prepare(`
      SELECT * FROM execution_events WHERE task_id = ? AND id > ? ORDER BY id LIMIT ?
    `).all(taskId, after, limit + 1) as EventRow[];
    const selected = rows.slice(0, limit);
    const state = this.connection().prepare("SELECT events_truncated FROM execution_tasks WHERE task_id = ?")
      .get(taskId) as { events_truncated: 0 | 1 };
    return {
      entries: selected.map(toEvent),
      lastId: selected.at(-1)?.id ?? after,
      hasMore: rows.length > limit,
      truncated: Boolean(state.events_truncated)
    };
  }

  private lastSequence(taskId: string): number {
    const row = this.connection().prepare("SELECT last_sequence FROM execution_tasks WHERE task_id = ?")
      .get(taskId) as { last_sequence: number };
    return row.last_sequence;
  }

  private trim(taskId: string): void {
    const state = this.connection().prepare("SELECT retained_content_bytes FROM execution_tasks WHERE task_id = ?")
      .get(taskId) as { retained_content_bytes: number };
    let retained = state.retained_content_bytes;
    while (retained > MAX_RETAINED_BYTES) {
      const oldest = this.connection().prepare(`
        SELECT id, content_bytes FROM execution_events WHERE task_id = ? AND terminal = 0 ORDER BY id LIMIT 1
      `).get(taskId) as { id: number; content_bytes: number } | undefined;
      if (!oldest) break;
      this.connection().prepare("DELETE FROM execution_events WHERE id = ?").run(oldest.id);
      retained -= oldest.content_bytes;
    }
    if (retained !== state.retained_content_bytes) this.connection().prepare(`
      UPDATE execution_tasks SET retained_content_bytes = ?, events_truncated = 1 WHERE task_id = ?
    `).run(retained, taskId);
  }
}

const toTask = (row: TaskRow): ExecutionTask => ({
  id: row.task_id, kind: row.kind, rootRunId: row.root_run_id, status: row.status,
  spec: JSON.parse(row.spec_json) as ExecutionSpec,
  startedAt: row.started_at ?? undefined, completedAt: row.completed_at ?? undefined,
  cancelRequestedAt: row.cancel_requested_at ?? undefined, errorCode: row.error_code ?? undefined,
  errorMessage: row.error_message ?? undefined,
  outcome: row.outcome_json ? JSON.parse(row.outcome_json) as AgentOutcome : undefined,
  createdAt: row.created_at, updatedAt: row.updated_at
});

const toEvent = (row: EventRow): ExecutionEvent => ({
  id: row.id, taskId: row.task_id, sequence: row.sequence, source: row.source, kind: row.kind,
  level: row.level, phase: row.phase, itemId: row.item_id ?? undefined, message: row.message,
  data: row.data_json ? JSON.parse(row.data_json) as Record<string, unknown> : undefined,
  contentBytes: row.content_bytes, terminal: Boolean(row.terminal), createdAt: row.created_at
});

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
