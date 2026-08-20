import type Database from "better-sqlite3";
import type { CanonicalNodeOutcome, LoopRunStatus, NodeRun } from "../../shared/domain/runtime.js";
import { assertJsonValue, canonicalJson } from "./state/CanonicalJson.js";

export class WorkflowProgressStore {
  constructor(private readonly connection: () => Database.Database) {}

  resumeWaitingNode(node: NodeRun, timestamp = new Date().toISOString()): void {
    const completed = this.connection().prepare(`
      UPDATE node_runs SET status = 'completed', completed_at = ?, updated_at = ?
      WHERE node_run_id = ? AND status = 'waiting_for_input'
    `).run(timestamp, timestamp, node.nodeRunId);
    if (completed.changes !== 1) throw new Error(`Node Run ${node.nodeRunId} is not waiting for input.`);
    if (node.jobRunId) this.connection().prepare(`
      UPDATE job_runs SET status = 'running', active_node_run_id = NULL, updated_at = ?
      WHERE job_run_id = ? AND status = 'waiting_for_input'
    `).run(timestamp, node.jobRunId);
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
    jobRunId: string,
    maximum: number,
    timestamp = new Date().toISOString()
  ): number {
    const result = this.connection().prepare(`
      UPDATE job_runs SET job_attempt = job_attempt + 1, updated_at = ?
      WHERE job_run_id = ? AND status = 'running' AND job_attempt < ?
      RETURNING job_attempt
    `).get(timestamp, jobRunId, maximum);
    return readInteger(result, "job_attempt", `Job Run ${jobRunId} cannot retry.`);
  }

  suspendLoop(loopRunId: string, timestamp = new Date().toISOString()): void {
    this.connection().prepare(`
      UPDATE loop_invocations SET status = 'waiting_for_input', updated_at = ?
      WHERE loop_run_id = ? AND status = 'running'
    `).run(timestamp, loopRunId);
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
    terminal: Extract<LoopRunStatus, "completed" | "blocked" | "failed" | "cancelled">,
    stateRevision: number,
    timestamp = new Date().toISOString()
  ): void {
    const result = this.connection().prepare(`
      UPDATE loop_invocations SET status = ?, completion_state_revision = ?, completed_at = ?, updated_at = ?
      WHERE loop_run_id = ? AND status IN ('running','waiting_for_input')
    `).run(terminal, stateRevision, timestamp, timestamp, node.loopRunId);
    if (result.changes !== 1) throw new Error(`Loop Run ${node.loopRunId} cannot finish as ${terminal}.`);
    this.connection().prepare(`
      UPDATE root_runs SET active_loop_run_id = NULL, active_node_run_id = NULL, updated_at = ?
      WHERE root_run_id = ? AND active_loop_run_id = ?
    `).run(timestamp, node.rootRunId, node.loopRunId);
  }

  activateCaller(loopRunId: string, jobRunId: string, rootRunId: string, timestamp = new Date().toISOString()): void {
    const loop = this.connection().prepare(`
      UPDATE loop_invocations SET status = 'running', updated_at = ?
      WHERE loop_run_id = ? AND status IN ('running','waiting_for_input')
    `).run(timestamp, loopRunId);
    const composite = this.connection().prepare(`
      UPDATE job_runs SET status = 'running', updated_at = ?
      WHERE job_run_id = ? AND status = 'waiting_for_input'
    `).run(timestamp, jobRunId);
    if (loop.changes !== 1 || composite.changes !== 1) {
      throw new Error(`Repair continuation ${loopRunId}:${jobRunId} is not suspended.`);
    }
    this.connection().prepare(`
      UPDATE root_runs SET status = 'running', active_loop_run_id = ?, active_node_run_id = NULL,
        updated_at = ? WHERE root_run_id = ?
    `).run(loopRunId, timestamp, rootRunId);
  }

  terminalizeCaller(
    loopRunId: string,
    jobRunId: string,
    rootRunId: string,
    status: "blocked" | "failed" | "cancelled",
    revision: number,
    errorCode: string,
    errorMessage: string,
    timestamp = new Date().toISOString()
  ): void {
    this.connection().prepare(`
      UPDATE job_runs SET status = ?, terminal = ?, state_revision_after = ?,
        active_node_run_id = NULL, error_code = ?, error_message = ?, completed_at = ?, updated_at = ?
      WHERE job_run_id = ? AND status = 'waiting_for_input'
    `).run(status, status, revision, errorCode, errorMessage, timestamp, timestamp, jobRunId);
    this.connection().prepare(`
      UPDATE loop_invocations SET status = ?, completion_state_revision = ?, completed_at = ?, updated_at = ?
      WHERE loop_run_id = ? AND status IN ('running','waiting_for_input')
    `).run(status, revision, timestamp, timestamp, loopRunId);
    this.connection().prepare(`
      UPDATE root_runs SET active_loop_run_id = NULL, active_node_run_id = NULL,
        error_code = ?, error_message = ?, updated_at = ? WHERE root_run_id = ?
    `).run(errorCode, errorMessage, timestamp, rootRunId);
  }

  finishRoot(
    rootRunId: string,
    outcome: CanonicalNodeOutcome | undefined,
    error?: { code: string; message: string },
    timestamp = new Date().toISOString()
  ): void {
    const outcomeValue: unknown = outcome;
    if (outcomeValue !== undefined) assertJsonValue(outcomeValue, { label: `Root Run ${rootRunId} outcome` });
    this.connection().prepare(`
      UPDATE root_runs SET active_loop_run_id = NULL, active_node_run_id = NULL,
        outcome_json = ?, error_code = ?, error_message = ?, updated_at = ? WHERE root_run_id = ?
    `).run(outcomeValue === undefined ? null : canonicalJson(outcomeValue),
      error?.code ?? null, error?.message ?? null, timestamp, rootRunId);
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
    if (node.jobRunId) this.connection().prepare(`
      UPDATE job_runs SET status = 'blocked', terminal = 'blocked', active_node_run_id = NULL,
        state_revision_after = ?, error_code = 'transition_limit', error_message = ?,
        completed_at = ?, updated_at = ? WHERE job_run_id = ?
    `).run(stateRevision, message, timestamp, timestamp, node.jobRunId);
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
