import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";
import type { StoredRootRun } from "../runs/RootRunStore.js";
import { TkTracker, type TkStoreKind, type TkTicketType } from "./TkTracker.js";

const outboxRowSchema = z.object({
  operation_id: z.string(), root_run_id: z.string(), loop_run_id: z.string().nullable(),
  store_kind: z.enum(["orchestration", "work"]),
  action: z.enum(["upsert", "start", "note", "close", "reopen"]),
  external_ref: z.string(), payload_json: z.string(), status: z.enum(["pending", "applied"]),
  ticket_id: z.string().nullable(), error_message: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(), applied_at: z.string().nullable()
}).strict();
type OutboxRow = z.infer<typeof outboxRowSchema>;

const upsertPayloadSchema = z.object({
  title: z.string().min(1), type: z.enum(["bug", "feature", "task", "epic", "chore"]),
  priority: z.number().int().min(0).max(4), parentExternalRef: z.string().optional()
}).strict();

export class TrackerOutbox {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly tracker: TkTracker
  ) {}

  async reconcileOrPause(root: StoredRootRun): Promise<boolean> {
    try {
      this.materialize(root);
      for (const operation of this.pending(root.rootRunId)) await this.apply(root, operation);
      this.clearRootOnlyWait(root.rootRunId);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.pause(root.rootRunId, message);
      return false;
    }
  }

  private materialize(root: StoredRootRun): void {
    const timestamp = new Date().toISOString();
    const graphName = root.executionSnapshot.graph.name;
    const rootRef = `ballet-root:${root.rootRunId}`;
    const loops = this.connection().prepare(`
      SELECT loop_run_id, loop_id, status FROM loop_invocations
      WHERE root_run_id = ? ORDER BY created_at, rowid
    `).all(root.rootRunId) as Array<{ loop_run_id: string; loop_id: string; status: string }>;
    this.connection().transaction(() => {
      this.enqueue(root.rootRunId, undefined, "orchestration", "upsert", rootRef, {
        title: `${graphName} Root Run`, type: "epic", priority: 2
      }, timestamp);
      this.enqueue(root.rootRunId, undefined, "orchestration", "start", rootRef, {}, timestamp);
      for (const loop of loops) {
        const externalRef = `ballet-loop-run:${loop.loop_run_id}`;
        this.enqueue(root.rootRunId, loop.loop_run_id, "orchestration", "upsert", externalRef, {
          title: `${loop.loop_id.toUpperCase()} Loop invocation`, type: "chore", priority: 2,
          parentExternalRef: rootRef
        }, timestamp);
        this.enqueue(root.rootRunId, loop.loop_run_id, "orchestration", "start", externalRef, {}, timestamp);
        if (["completed", "blocked", "failed", "cancelled"].includes(loop.status)) {
          this.enqueue(root.rootRunId, loop.loop_run_id, "orchestration", "close", externalRef, {}, timestamp);
        }
      }
      if (["completed", "blocked", "failed", "cancelled"].includes(root.status)
        || (loops.length > 0 && loops.every((loop) =>
          ["completed", "blocked", "failed", "cancelled"].includes(loop.status)))) {
        this.enqueue(root.rootRunId, undefined, "orchestration", "close", rootRef, {}, timestamp);
      }
    })();
  }

  private enqueue(
    rootRunId: string,
    loopRunId: string | undefined,
    storeKind: TkStoreKind,
    action: OutboxRow["action"],
    externalRef: string,
    payload: Record<string, unknown>,
    timestamp: string
  ): void {
    this.connection().prepare(`
      INSERT OR IGNORE INTO tracker_outbox (
        operation_id, root_run_id, loop_run_id, store_kind, action, external_ref,
        payload_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      randomUUID(), rootRunId, loopRunId ?? null, storeKind, action, externalRef,
      JSON.stringify(payload), timestamp, timestamp
    );
  }

  private pending(rootRunId: string): OutboxRow[] {
    return this.connection().prepare(`
      SELECT * FROM tracker_outbox WHERE root_run_id = ? AND status = 'pending'
      ORDER BY CASE action WHEN 'upsert' THEN 0 WHEN 'start' THEN 1 WHEN 'note' THEN 2
        WHEN 'reopen' THEN 3 ELSE 4 END, created_at, rowid
    `).all(rootRunId).map((row) => outboxRowSchema.parse(row));
  }

  private async apply(root: StoredRootRun, operation: OutboxRow): Promise<void> {
    let ticketId = this.linkedTicket(root.rootRunId, operation.store_kind, operation.external_ref);
    try {
      if (operation.action === "upsert") {
        const payload = upsertPayloadSchema.parse(JSON.parse(operation.payload_json));
        const parentId = payload.parentExternalRef
          ? this.linkedTicket(root.rootRunId, operation.store_kind, payload.parentExternalRef)
          : undefined;
        if (payload.parentExternalRef && !parentId) {
          throw new Error(`Tracker parent ${payload.parentExternalRef} has not been reconciled.`);
        }
        const ticket = await this.tracker.upsert(
          root.worktreePath, root.executionSnapshot.issueTracker, operation.store_kind,
          {
            externalRef: operation.external_ref,
            title: payload.title,
            type: payload.type as TkTicketType,
            priority: payload.priority,
            ...(parentId ? { parentId } : {})
          }
        );
        ticketId = ticket.id;
      } else {
        if (!ticketId) throw new Error(`Tracker link ${operation.external_ref} has not been reconciled.`);
        if (operation.action === "start") {
          await this.tracker.start(root.worktreePath, root.executionSnapshot.issueTracker, operation.store_kind, ticketId);
        } else if (operation.action === "close") {
          await this.tracker.close(root.worktreePath, root.executionSnapshot.issueTracker, operation.store_kind, ticketId);
        } else if (operation.action === "reopen") {
          await this.tracker.reopen(root.worktreePath, root.executionSnapshot.issueTracker, operation.store_kind, ticketId);
        } else {
          const payload = z.object({ note: z.string().min(1) }).strict().parse(JSON.parse(operation.payload_json));
          await this.tracker.note(
            root.worktreePath, root.executionSnapshot.issueTracker, operation.store_kind, ticketId, payload.note
          );
        }
      }
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
      this.connection().prepare(`
        UPDATE tracker_outbox SET error_message = ?, updated_at = ?
        WHERE operation_id = ? AND status = 'pending'
      `).run(message, new Date().toISOString(), operation.operation_id);
      throw error;
    }
    this.connection().transaction(() => {
      const timestamp = new Date().toISOString();
      if (ticketId) this.saveLink(root, operation, ticketId, timestamp);
      const result = this.connection().prepare(`
        UPDATE tracker_outbox SET status = 'applied', ticket_id = ?, error_message = NULL,
          applied_at = ?, updated_at = ? WHERE operation_id = ? AND status = 'pending'
      `).run(ticketId ?? null, timestamp, timestamp, operation.operation_id);
      if (result.changes !== 1) throw new Error(`Tracker operation ${operation.operation_id} was concurrently reconciled.`);
    })();
  }

  private saveLink(root: StoredRootRun, operation: OutboxRow, ticketId: string, timestamp: string): void {
    this.connection().prepare(`
      INSERT INTO tracker_links (
        link_id, root_run_id, loop_run_id, store_kind, external_ref, ticket_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(root_run_id, store_kind, external_ref) DO UPDATE SET
        ticket_id = excluded.ticket_id, loop_run_id = excluded.loop_run_id, updated_at = excluded.updated_at
    `).run(
      randomUUID(), root.rootRunId, operation.loop_run_id, operation.store_kind,
      operation.external_ref, ticketId, timestamp, timestamp
    );
    if (operation.store_kind !== "orchestration") return;
    if (operation.external_ref === `ballet-root:${root.rootRunId}`) this.connection().prepare(`
      UPDATE graph_run_states SET root_ticket_id = ?, updated_at = ? WHERE root_run_id = ?
    `).run(ticketId, timestamp, root.rootRunId);
    if (operation.loop_run_id) this.connection().prepare(`
      UPDATE graph_run_states SET active_loop_ticket_id = ?, updated_at = ?
      WHERE root_run_id = ? AND current_loop_run_id = ?
    `).run(ticketId, timestamp, root.rootRunId, operation.loop_run_id);
  }

  private linkedTicket(rootRunId: string, storeKind: TkStoreKind, externalRef: string): string | undefined {
    const value = this.connection().prepare(`
      SELECT ticket_id FROM tracker_links WHERE root_run_id = ? AND store_kind = ? AND external_ref = ?
    `).get(rootRunId, storeKind, externalRef);
    return typeof value === "object" && value !== null && "ticket_id" in value
      && typeof value.ticket_id === "string" ? value.ticket_id : undefined;
  }

  private pause(rootRunId: string, error: string): void {
    const timestamp = new Date().toISOString();
    const root = this.connection().prepare(`
      SELECT active_node_run_id FROM root_runs WHERE root_run_id = ?
    `).get(rootRunId) as { active_node_run_id?: string | null } | undefined;
    const node = root?.active_node_run_id ? this.connection().prepare(`
      SELECT node_run_id, loop_run_id, job_run_id, role, status, execution_task_id
      FROM node_runs WHERE node_run_id = ?
    `).get(root.active_node_run_id) as {
      node_run_id: string; loop_run_id: string; job_run_id: string | null;
      role: "job" | "validation" | "orchestrator"; status: string; execution_task_id: string | null;
    } | undefined : undefined;
    if (!node || node.status !== "queued" || node.execution_task_id) {
      this.connection().prepare(`
        UPDATE root_runs SET status = 'waiting_for_input', error_code = 'tracker_unavailable',
          error_message = ?, updated_at = ? WHERE root_run_id = ?
      `).run(error.slice(0, 2_000), timestamp, rootRunId);
      return;
    }
    const common = {
      role: node.role,
      state: "needs_input",
      summary: "Issue tracker reconciliation did not complete.",
      question: "Restore the configured tk command or ticket store, then Resume this Node.",
      context: error.slice(0, 2_000)
    };
    const outcome = node.role === "orchestrator" ? common : {
      ...common,
      checks: [{ name: "tk reconciliation", status: "failed", details: error.slice(0, 2_000) }]
    };
    this.connection().transaction(() => {
      this.connection().prepare(`
        UPDATE node_runs SET status = 'waiting_for_input', outcome_json = ?, updated_at = ?
        WHERE node_run_id = ? AND status = 'queued' AND execution_task_id IS NULL
      `).run(JSON.stringify(outcome), timestamp, node.node_run_id);
      if (node.job_run_id) this.connection().prepare(`
        UPDATE job_runs SET status = 'waiting_for_input', updated_at = ? WHERE job_run_id = ?
      `).run(timestamp, node.job_run_id);
      this.connection().prepare(`
        UPDATE loop_invocations SET status = 'waiting_for_input', updated_at = ?
        WHERE loop_run_id = ? AND status = 'running'
      `).run(timestamp, node.loop_run_id);
      this.connection().prepare(`
        UPDATE root_runs SET status = 'waiting_for_input', updated_at = ? WHERE root_run_id = ?
      `).run(timestamp, rootRunId);
    })();
  }

  private clearRootOnlyWait(rootRunId: string): void {
    this.connection().prepare(`
      UPDATE root_runs SET status = 'running', error_code = NULL, error_message = NULL, updated_at = ?
      WHERE root_run_id = ? AND status = 'waiting_for_input' AND error_code = 'tracker_unavailable'
    `).run(new Date().toISOString(), rootRunId);
  }
}
