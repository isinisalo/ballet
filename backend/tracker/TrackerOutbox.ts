import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";
import type { StoredRootRun } from "../runs/RootRunStore.js";
import { TkTracker, type TkStoreKind, type TkTicketType } from "./TkTracker.js";

const rowSchema = z.object({
  operation_id: z.string(), root_run_id: z.string(), graph_node_invocation_id: z.string().nullable(),
  store_kind: z.enum(["orchestration","work"]),
  action: z.enum(["upsert","start","note","close","reopen"]),
  external_ref: z.string(), payload_json: z.string(), status: z.enum(["pending","applied"]),
  ticket_id: z.string().nullable(), error_message: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(), applied_at: z.string().nullable()
}).strict();
type Row = z.infer<typeof rowSchema>;
const payloadSchema = z.object({
  title: z.string().min(1), type: z.enum(["bug","feature","task","epic","chore"]),
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
      this.connection().prepare(`
        UPDATE root_runs SET
          status = CASE
            WHEN finalization_terminal_status IS NOT NULL THEN finalization_terminal_status
            ELSE 'running'
          END,
          error_code = NULL, error_message = NULL, updated_at = ?
        WHERE root_run_id = ? AND status = 'waiting_for_input' AND error_code = 'tracker_unavailable'
      `).run(now(), root.rootRunId);
      return true;
    } catch (error) {
      this.connection().prepare(`
        UPDATE root_runs SET status = 'waiting_for_input', error_code = 'tracker_unavailable',
          error_message = ?,
          finalization_terminal_status = CASE
            WHEN status IN ('completed','blocked','failed','cancelled') THEN status
            ELSE finalization_terminal_status
          END,
          updated_at = ? WHERE root_run_id = ?
      `).run(message(error).slice(0, 2_000), now(), root.rootRunId);
      return false;
    }
  }

  private materialize(root: StoredRootRun): void {
    const invocations = this.connection().prepare(`
      SELECT graph_node_invocation_id, graph_node_id, status FROM graph_node_invocations
      WHERE root_run_id = ? ORDER BY created_at, rowid
    `).all(root.rootRunId) as Array<{
      graph_node_invocation_id: string; graph_node_id: string; status: string;
    }>;
    const rootRef = `ballet-root:${root.rootRunId}`;
    const at = now();
    this.connection().transaction(() => {
      this.enqueue(root.rootRunId, undefined, "orchestration", "upsert", rootRef, {
        title: `${root.executionSnapshot.graph.name} Root Run`, type: "epic", priority: 2
      }, at);
      this.enqueue(root.rootRunId, undefined, "orchestration", "start", rootRef, {}, at);
      for (const invocation of invocations) {
        const reference = `ballet-graph-node-invocation:${invocation.graph_node_invocation_id}`;
        this.enqueue(root.rootRunId, invocation.graph_node_invocation_id, "orchestration", "upsert", reference, {
          title: `${invocation.graph_node_id.toUpperCase()} Graph Node invocation`,
          type: "chore", priority: 2, parentExternalRef: rootRef
        }, at);
        this.enqueue(root.rootRunId, invocation.graph_node_invocation_id, "orchestration", "start", reference, {}, at);
        if (isTerminal(invocation.status)) {
          this.enqueue(root.rootRunId, invocation.graph_node_invocation_id, "orchestration", "close", reference, {}, at);
        }
      }
      if (isTerminal(root.status)) this.enqueue(root.rootRunId, undefined, "orchestration", "close", rootRef, {}, at);
    })();
  }

  private enqueue(
    rootRunId: string,
    graphNodeInvocationId: string | undefined,
    storeKind: TkStoreKind,
    action: Row["action"],
    externalRef: string,
    payload: Record<string, unknown>,
    at: string
  ): void {
    this.connection().prepare(`
      INSERT OR IGNORE INTO tracker_outbox (
        operation_id, root_run_id, graph_node_invocation_id, store_kind, action,
        external_ref, payload_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(randomUUID(), rootRunId, graphNodeInvocationId ?? null, storeKind,
      action, externalRef, JSON.stringify(payload), at, at);
  }

  private pending(rootRunId: string): Row[] {
    return this.connection().prepare(`
      SELECT * FROM tracker_outbox WHERE root_run_id = ? AND status = 'pending'
      ORDER BY CASE action WHEN 'upsert' THEN 0 WHEN 'start' THEN 1 WHEN 'note' THEN 2
        WHEN 'reopen' THEN 3 ELSE 4 END, created_at, rowid
    `).all(rootRunId).map((row) => rowSchema.parse(row));
  }

  private async apply(root: StoredRootRun, operation: Row): Promise<void> {
    let ticketId = this.linked(root.rootRunId, operation.store_kind, operation.external_ref);
    if (operation.action === "upsert") {
      const payload = payloadSchema.parse(JSON.parse(operation.payload_json));
      const parentId = payload.parentExternalRef
        ? this.linked(root.rootRunId, operation.store_kind, payload.parentExternalRef) : undefined;
      if (payload.parentExternalRef && !parentId) throw new Error(`Tracker parent ${payload.parentExternalRef} is absent.`);
      const ticket = await this.tracker.upsert(
        root.worktreePath, root.executionSnapshot.issueTracker, operation.store_kind,
        {
          externalRef: operation.external_ref, title: payload.title,
          type: payload.type as TkTicketType, priority: payload.priority,
          ...(parentId ? { parentId } : {})
        }
      );
      ticketId = ticket.id;
    } else {
      if (!ticketId) throw new Error(`Tracker link ${operation.external_ref} is absent.`);
      if (operation.action === "start") {
        await this.tracker.start(root.worktreePath, root.executionSnapshot.issueTracker, operation.store_kind, ticketId);
      } else if (operation.action === "close") {
        await this.tracker.close(root.worktreePath, root.executionSnapshot.issueTracker, operation.store_kind, ticketId);
      } else if (operation.action === "reopen") {
        await this.tracker.reopen(root.worktreePath, root.executionSnapshot.issueTracker, operation.store_kind, ticketId);
      } else {
        const note = z.object({ note: z.string().min(1) }).strict().parse(JSON.parse(operation.payload_json)).note;
        await this.tracker.note(root.worktreePath, root.executionSnapshot.issueTracker, operation.store_kind, ticketId, note);
      }
    }
    const at = now();
    this.connection().transaction(() => {
      if (ticketId) this.connection().prepare(`
        INSERT INTO tracker_links (
          link_id, root_run_id, graph_node_invocation_id, store_kind,
          external_ref, ticket_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(root_run_id, store_kind, external_ref) DO UPDATE SET
          graph_node_invocation_id = excluded.graph_node_invocation_id,
          ticket_id = excluded.ticket_id, updated_at = excluded.updated_at
      `).run(randomUUID(), root.rootRunId, operation.graph_node_invocation_id,
        operation.store_kind, operation.external_ref, ticketId, at, at);
      this.connection().prepare(`
        UPDATE tracker_outbox SET status = 'applied', ticket_id = ?, error_message = NULL,
          applied_at = ?, updated_at = ? WHERE operation_id = ? AND status = 'pending'
      `).run(ticketId ?? null, at, at, operation.operation_id);
    })();
  }

  private linked(rootRunId: string, storeKind: TkStoreKind, reference: string): string | undefined {
    const row = this.connection().prepare(`
      SELECT ticket_id FROM tracker_links WHERE root_run_id = ? AND store_kind = ? AND external_ref = ?
    `).get(rootRunId, storeKind, reference) as { ticket_id?: string } | undefined;
    return row?.ticket_id;
  }
}
const now = (): string => new Date().toISOString();
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
const isTerminal = (status: string): boolean => ["completed","blocked","failed","cancelled"].includes(status);
