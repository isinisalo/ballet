import type Database from "better-sqlite3";
import type { ProjectGraphTransition } from "../../shared/domain/automation.js";
import type { GraphOrchestrationStateV1 } from "../../shared/domain/runs.js";

interface GraphRunStateRow {
  graph_id: string;
  start_loop_id: string;
  current_loop_id: string | null;
  current_loop_run_id: string | null;
  last_transition_id: string | null;
  last_source_loop_id: string | null;
  last_decision: "PASS" | "FAIL" | null;
  last_outcome: string | null;
  last_target_loop_id: string | null;
  terminal_result: "DONE" | null;
  root_external_ref: string;
  root_ticket_id: string | null;
  active_loop_external_ref: string | null;
  active_loop_ticket_id: string | null;
}

export class GraphRunStateStore {
  constructor(private readonly connection: () => Database.Database) {}

  bindInvocation(rootRunId: string, loopId: string, loopRunId: string, timestamp = new Date().toISOString()): void {
    this.connection().prepare(`
      UPDATE graph_run_states SET current_loop_id = ?, current_loop_run_id = ?,
        active_loop_external_ref = ?, active_loop_ticket_id = NULL, updated_at = ?
      WHERE root_run_id = ? AND terminal_result IS NULL
    `).run(loopId, loopRunId, `ballet-loop-run:${loopRunId}`, timestamp, rootRunId);
  }

  recordTransition(
    rootRunId: string,
    transition: ProjectGraphTransition,
    targetLoopRunId?: string,
    timestamp = new Date().toISOString()
  ): void {
    const targetLoopId = "loopId" in transition.target ? transition.target.loopId : null;
    const terminal = "runResult" in transition.target ? transition.target.runResult : null;
    const result = this.connection().prepare(`
      UPDATE graph_run_states SET
        current_loop_id = ?, current_loop_run_id = ?, last_transition_id = ?,
        last_source_loop_id = ?, last_decision = ?, last_outcome = ?,
        last_target_loop_id = ?, terminal_result = ?, active_loop_external_ref = ?,
        active_loop_ticket_id = NULL, updated_at = ?
      WHERE root_run_id = ? AND terminal_result IS NULL
    `).run(
      targetLoopId, targetLoopRunId ?? null, transition.id, transition.source,
      transition.decision, transition.outcome, targetLoopId, terminal,
      targetLoopRunId ? `ballet-loop-run:${targetLoopRunId}` : null,
      timestamp, rootRunId
    );
    if (result.changes !== 1) throw new Error(`Graph Run ${rootRunId} cannot record transition ${transition.id}.`);
  }

  countTransitions(rootRunId: string): number {
    const row = this.connection().prepare(`
      SELECT COUNT(*) AS count FROM control_flow_events
      WHERE root_run_id = ? AND kind = 'graph_transition'
    `).get(rootRunId);
    if (typeof row === "object" && row !== null && "count" in row
      && typeof row.count === "number" && Number.isSafeInteger(row.count)) return row.count;
    throw new Error(`Graph Run ${rootRunId} has invalid transition storage.`);
  }

  read(rootRunId: string): GraphOrchestrationStateV1 | undefined {
    const value = this.connection().prepare(`SELECT * FROM graph_run_states WHERE root_run_id = ?`).get(rootRunId);
    if (!value) return undefined;
    const row = value as GraphRunStateRow;
    const lastTransition = row.last_transition_id && row.last_source_loop_id && row.last_decision && row.last_outcome
      ? {
          id: row.last_transition_id,
          sourceLoopId: row.last_source_loop_id,
          decision: row.last_decision,
          outcome: row.last_outcome,
          ...(row.last_target_loop_id ? { targetLoopId: row.last_target_loop_id } : { runResult: "DONE" as const })
        }
      : undefined;
    return {
      version: 1,
      graphId: row.graph_id,
      startLoopId: row.start_loop_id,
      currentLoopId: row.current_loop_id ?? undefined,
      currentLoopRunId: row.current_loop_run_id ?? undefined,
      lastTransition,
      transitionCount: this.countTransitions(rootRunId),
      terminalResult: row.terminal_result ?? undefined,
      tracking: {
        rootExternalRef: row.root_external_ref,
        rootTicketId: row.root_ticket_id ?? undefined,
        activeLoopExternalRef: row.active_loop_external_ref ?? undefined,
        activeLoopTicketId: row.active_loop_ticket_id ?? undefined
      }
    };
  }
}
