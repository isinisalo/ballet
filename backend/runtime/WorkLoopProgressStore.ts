import type Database from "better-sqlite3";
import type { LoopTerminal } from "../../shared/domain/automation.js";
import type { CanonicalNodeOutcome, NodeRun } from "../../shared/domain/runtime.js";
import { assertJsonValue, canonicalJson } from "./state/CanonicalJson.js";

export class WorkLoopProgressStore {
  constructor(private readonly connection: () => Database.Database) {}

  resumeWaitingNode(node: NodeRun, timestamp = new Date().toISOString()): void {
    const completed = this.connection().prepare(`
      UPDATE node_runs SET status = 'completed', completed_at = ?, updated_at = ?
      WHERE node_run_id = ? AND status = 'waiting_for_input'
    `).run(timestamp, timestamp, node.nodeRunId);
    if (completed.changes !== 1) throw new Error(`Node Run ${node.nodeRunId} is not waiting for input.`);
    if (node.workLoopNodeRunId) this.connection().prepare(`
      UPDATE work_loop_node_runs SET status = 'running', active_node_run_id = NULL, updated_at = ?
      WHERE work_loop_node_run_id = ? AND status = 'waiting_for_input'
    `).run(timestamp, node.workLoopNodeRunId);
    this.connection().prepare(`
      UPDATE loop_invocations SET status = 'running', updated_at = ?
      WHERE loop_run_id = ? AND status = 'waiting_for_input'
    `).run(timestamp, node.loopRunId);
    this.connection().prepare(`
      UPDATE root_runs SET status = 'running', active_node_run_id = NULL, updated_at = ?
      WHERE root_run_id = ? AND status = 'waiting_for_input'
    `).run(timestamp, node.rootRunId);
  }

  incrementLocalAttempt(
    workLoopNodeRunId: string,
    maximum: number,
    timestamp = new Date().toISOString()
  ): number {
    const result = this.connection().prepare(`
      UPDATE work_loop_node_runs SET attempt = attempt + 1, updated_at = ?
      WHERE work_loop_node_run_id = ? AND status = 'running' AND attempt < ?
      RETURNING attempt
    `).get(timestamp, workLoopNodeRunId, maximum);
    return readInteger(result, "attempt", `Work Loop Node Run ${workLoopNodeRunId} cannot retry.`);
  }

  waitForRepair(node: NodeRun, timestamp = new Date().toISOString()): void {
    this.connection().prepare(`
      UPDATE loop_invocations SET status = 'waiting_for_input', updated_at = ?
      WHERE loop_run_id = ? AND status = 'running'
    `).run(timestamp, node.loopRunId);
    this.connection().prepare(`
      UPDATE root_runs SET status = 'waiting_for_input', active_node_run_id = NULL, updated_at = ?
      WHERE root_run_id = ?
    `).run(timestamp, node.rootRunId);
  }

  waitForHuman(node: NodeRun, timestamp = new Date().toISOString()): void {
    this.connection().prepare(`
      UPDATE loop_invocations SET status = 'waiting_for_input', updated_at = ?
      WHERE loop_run_id = ? AND status = 'running'
    `).run(timestamp, node.loopRunId);
    this.connection().prepare(`
      UPDATE root_runs SET status = 'waiting_for_input', updated_at = ? WHERE root_run_id = ?
    `).run(timestamp, node.rootRunId);
  }

  finishLoop(
    node: NodeRun,
    terminal: LoopTerminal,
    stateRevision: number,
    outcome: CanonicalNodeOutcome,
    timestamp = new Date().toISOString()
  ): void {
    const outcomeValue: unknown = outcome;
    assertJsonValue(outcomeValue, { label: `Node Run ${node.nodeRunId} outcome` });
    const result = this.connection().prepare(`
      UPDATE loop_invocations SET status = ?, completion_state_revision = ?, completed_at = ?, updated_at = ?
      WHERE loop_run_id = ? AND status IN ('running','waiting_for_input')
    `).run(terminal, stateRevision, timestamp, timestamp, node.loopRunId);
    if (result.changes !== 1) throw new Error(`Loop Run ${node.loopRunId} cannot finish as ${terminal}.`);
    this.connection().prepare(`
      UPDATE root_runs SET active_loop_run_id = NULL, active_node_run_id = NULL,
        outcome_json = ?, updated_at = ? WHERE root_run_id = ?
    `).run(canonicalJson(outcomeValue), timestamp, node.rootRunId);
  }

  blockAtTransitionLimit(
    node: NodeRun,
    stateRevision: number,
    limit: number,
    timestamp = new Date().toISOString()
  ): void {
    const message = `Root Run exceeded the control-flow transition limit ${limit}.`;
    this.connection().prepare(`
      UPDATE node_runs SET status = 'blocked', state_revision_after = ?, error_code = 'transition_limit',
        error_message = ?, completed_at = ?, updated_at = ?
      WHERE node_run_id = ? AND status IN ('queued','running','waiting_for_input')
    `).run(stateRevision, message, timestamp, timestamp, node.nodeRunId);
    if (node.workLoopNodeRunId) this.connection().prepare(`
      UPDATE work_loop_node_runs SET status = 'blocked', terminal = 'blocked', active_node_run_id = NULL,
        state_revision_after = ?, error_code = 'transition_limit', error_message = ?,
        completed_at = ?, updated_at = ? WHERE work_loop_node_run_id = ?
    `).run(stateRevision, message, timestamp, timestamp, node.workLoopNodeRunId);
    this.connection().prepare(`
      UPDATE loop_invocations SET status = 'blocked', completion_state_revision = ?,
        completed_at = ?, updated_at = ? WHERE loop_run_id = ?
    `).run(stateRevision, timestamp, timestamp, node.loopRunId);
    this.connection().prepare(`
      UPDATE root_runs SET active_loop_run_id = NULL, active_node_run_id = NULL,
        error_code = 'transition_limit', error_message = ?, updated_at = ? WHERE root_run_id = ?
    `).run(message, timestamp, node.rootRunId);
  }
}

const readInteger = (value: unknown, key: string, error: string): number => {
  if (typeof value === "object" && value !== null && key in value) {
    const field = Reflect.get(value, key);
    if (typeof field === "number" && Number.isSafeInteger(field)) return field;
  }
  throw new Error(error);
};
