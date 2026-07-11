import type Database from "better-sqlite3";
import type { z } from "zod";
import type { ExecutionEventPage } from "../../shared/domain/runtime.js";
import type { executionEventUploadSchema } from "../../shared/api/runtime-schemas.js";
import { valueHash } from "./crypto.js";
import { ControlPlaneConflictError, ControlPlaneNotFoundError } from "./errors.js";
import { toExecutionEvent, type ExecutionEventRow } from "./ExecutionMappers.js";

export type ExecutionEventUpload = z.infer<typeof executionEventUploadSchema>;
export const MAX_PERSISTED_CONSOLE_BYTES = 1024 * 1024;

interface EventStateRow {
  retained_content_bytes: number;
  truncated: 0 | 1;
}

interface ReceiptRow {
  event_hash: string;
}

export class ExecutionEventStore {
  constructor(private readonly connection: () => Database.Database) {}

  appendBatch(taskId: string, events: ExecutionEventUpload[]): { accepted: number; lastSequence: number } {
    const db = this.connection();
    const task = db.prepare("SELECT project_id FROM execution_tasks WHERE task_id = ?")
      .get(taskId) as { project_id: string } | undefined;
    if (!task) throw new ControlPlaneNotFoundError(`Execution task ${taskId} was not found.`);
    const sorted = [...events].sort((left, right) => left.sequence - right.sequence);
    return db.transaction(() => this.appendTransaction(db, task.project_id, taskId, sorted))();
  }

  page(taskId: string, after = 0, limit = 500): ExecutionEventPage {
    const db = this.connection();
    if (!db.prepare("SELECT 1 FROM execution_tasks WHERE task_id = ?").get(taskId)) {
      throw new ControlPlaneNotFoundError(`Execution task ${taskId} was not found.`);
    }
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    const rows = db.prepare(`
      SELECT * FROM execution_events WHERE task_id = ? AND id > ? ORDER BY id ASC LIMIT ?
    `).all(taskId, after, safeLimit + 1) as ExecutionEventRow[];
    const entries = rows.slice(0, safeLimit).map(toExecutionEvent);
    const state = db.prepare("SELECT truncated FROM execution_event_state WHERE task_id = ?")
      .get(taskId) as Pick<EventStateRow, "truncated"> | undefined;
    return {
      entries,
      lastId: entries.at(-1)?.id ?? after,
      hasMore: rows.length > safeLimit,
      truncated: Boolean(state?.truncated)
    };
  }

  private appendTransaction(
    db: Database.Database,
    projectId: string,
    taskId: string,
    events: ExecutionEventUpload[]
  ): { accepted: number; lastSequence: number } {
    const state = this.eventState(db, taskId);
    let retainedBytes = state.retained_content_bytes;
    let truncated = Boolean(state.truncated);
    let maxSequence = (db.prepare("SELECT COALESCE(MAX(sequence), -1) AS value FROM execution_event_receipts WHERE task_id = ?")
      .get(taskId) as { value: number }).value;
    let accepted = 0;
    const findReceipt = db.prepare("SELECT event_hash FROM execution_event_receipts WHERE task_id = ? AND sequence = ?");
    const insertReceipt = db.prepare(`
      INSERT INTO execution_event_receipts (task_id, sequence, event_hash, persisted, terminal, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertEvent = db.prepare(`
      INSERT INTO execution_events (
        project_id, task_id, sequence, source, kind, level, phase, item_id,
        message, data_json, content_bytes, terminal, event_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const event of events) {
      const hash = valueHash(event);
      const existing = findReceipt.get(taskId, event.sequence) as ReceiptRow | undefined;
      if (existing) {
        if (existing.event_hash !== hash) throw new ControlPlaneConflictError(`Execution event sequence ${event.sequence} was reused with different content.`);
        continue;
      }
      if (event.sequence <= maxSequence) throw new ControlPlaneConflictError(`Execution event sequence ${event.sequence} is not monotonic.`);

      const dataJson = event.data === undefined ? null : JSON.stringify(event.data);
      const contentBytes = Buffer.byteLength(event.message, "utf8")
        + (dataJson ? Buffer.byteLength(dataJson, "utf8") : 0);
      // Keep a rolling one-megabyte console window. Receipts preserve sequence
      // idempotency even when older visible rows are evicted.
      const persisted = event.terminal || contentBytes <= MAX_PERSISTED_CONSOLE_BYTES;
      if (!event.terminal && persisted) retainedBytes += contentBytes;
      else if (!event.terminal) truncated = true;

      insertReceipt.run(taskId, event.sequence, hash, persisted ? 1 : 0, event.terminal ? 1 : 0, event.createdAt);
      if (persisted) {
        insertEvent.run(projectId, taskId, event.sequence, event.source, event.kind, event.level, event.phase,
          event.itemId ?? null, event.message, dataJson, contentBytes, event.terminal ? 1 : 0, hash, event.createdAt);
      }
      while (retainedBytes > MAX_PERSISTED_CONSOLE_BYTES) {
        const oldest = db.prepare(`
          SELECT id, sequence, content_bytes FROM execution_events
          WHERE task_id = ? AND terminal = 0 ORDER BY id ASC LIMIT 1
        `).get(taskId) as { id: number; sequence: number; content_bytes: number } | undefined;
        if (!oldest) break;
        db.prepare("DELETE FROM execution_events WHERE id = ?").run(oldest.id);
        db.prepare("UPDATE execution_event_receipts SET persisted = 0 WHERE task_id = ? AND sequence = ?")
          .run(taskId, oldest.sequence);
        retainedBytes -= oldest.content_bytes;
        truncated = true;
      }
      maxSequence = event.sequence;
      accepted += 1;
    }

    db.prepare(`
      UPDATE execution_event_state SET retained_content_bytes = ?, truncated = ? WHERE task_id = ?
    `).run(retainedBytes, truncated ? 1 : 0, taskId);
    return { accepted, lastSequence: maxSequence };
  }

  private eventState(db: Database.Database, taskId: string): EventStateRow {
    const existing = db.prepare(`
      SELECT retained_content_bytes, truncated FROM execution_event_state WHERE task_id = ?
    `).get(taskId) as EventStateRow | undefined;
    if (existing) return existing;
    const retained = (db.prepare(`
      SELECT COALESCE(SUM(content_bytes), 0) AS value FROM execution_events WHERE task_id = ? AND terminal = 0
    `).get(taskId) as { value: number }).value;
    const suppressed = Boolean(db.prepare(`
      SELECT 1 FROM execution_event_receipts WHERE task_id = ? AND persisted = 0 LIMIT 1
    `).get(taskId));
    db.prepare(`
      INSERT INTO execution_event_state (task_id, retained_content_bytes, truncated) VALUES (?, ?, ?)
    `).run(taskId, retained, suppressed ? 1 : 0);
    return { retained_content_bytes: retained, truncated: suppressed ? 1 : 0 };
  }
}
