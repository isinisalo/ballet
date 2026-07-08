import type Database from "better-sqlite3";
import type { AgentRun, AgentRunLog } from "../../shared/domain/runtime.js";
import { stringifyJson } from "./RuntimeJson.js";
import { toAgentRun, toAgentRunLog } from "./RuntimeRowMappers.js";
import type { AgentRunLogRow, AgentRunRow, LeaseOptions, RunLogLevel } from "./RuntimeDbTypes.js";
import { now } from "./RuntimeDbTypes.js";

export class AgentRunStore {
  constructor(private readonly connection: () => Database.Database) {}

  listRuns(limit = 500): AgentRun[] {
    const rows = this.connection().prepare("SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT ?").all(limit) as AgentRunRow[];
    return rows.map(toAgentRun);
  }

  getRun(runId: string): AgentRun | undefined {
    const row = this.connection().prepare("SELECT * FROM agent_runs WHERE run_id = ?").get(runId) as AgentRunRow | undefined;
    return row ? toAgentRun(row) : undefined;
  }

  leaseNextRun(options: LeaseOptions): AgentRun | undefined {
    const db = this.connection();
    const leaseUntil = new Date(Date.now() + options.leaseSeconds * 1000).toISOString();
    const transaction = db.transaction(() => {
      const row = db.prepare(`
        SELECT *
        FROM agent_runs
        WHERE status = 'queued' OR (status = 'running' AND lease_until IS NOT NULL AND lease_until < @now)
        ORDER BY created_at ASC
        LIMIT 1
      `).get({ now: now() }) as AgentRunRow | undefined;
      if (!row) return undefined;
      db.prepare(`
        UPDATE agent_runs
        SET status = 'running',
            attempt = attempt + 1,
            lease_owner = @leaseOwner,
            lease_until = @leaseUntil,
            updated_at = @updatedAt
        WHERE run_id = @runId
      `).run({
        leaseOwner: options.owner,
        leaseUntil,
        updatedAt: now(),
        runId: row.run_id
      });
      return this.getRun(row.run_id);
    });
    return transaction() as AgentRun | undefined;
  }

  retryRun(runId: string): AgentRun {
    const db = this.connection();
    const transaction = db.transaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error("Agent run not found.");
      if (!["failed", "blocked", "needs_input", "cancelled"].includes(run.status)) {
        throw new Error(`Agent run with status ${run.status} cannot be retried.`);
      }
      db.prepare(`
        UPDATE agent_runs
        SET status = 'queued',
            lease_owner = NULL,
            lease_until = NULL,
            turn_id = NULL,
            outcome_json = NULL,
            error = NULL,
            completed_at = NULL,
            updated_at = @updatedAt
        WHERE run_id = @runId
      `).run({ runId, updatedAt: now() });
      this.appendRunLog(runId, "info", "Run queued for retry.", {});
      const updated = this.getRun(runId);
      if (!updated) throw new Error("Agent run disappeared during retry.");
      return updated;
    });
    return transaction() as AgentRun;
  }

  saveRunThread(runId: string, threadId: string, turnId?: string): void {
    this.connection().prepare(`
      UPDATE agent_runs
      SET thread_id = @threadId,
          turn_id = COALESCE(@turnId, turn_id),
          updated_at = @updatedAt
      WHERE run_id = @runId
    `).run({ runId, threadId, turnId: turnId ?? null, updatedAt: now() });
  }

  getThreadBinding(workItemId: string, agentRole: string): string | undefined {
    const row = this.connection().prepare(`
      SELECT thread_id AS threadId
      FROM thread_bindings
      WHERE work_item_id = ? AND agent_role = ?
    `).get(workItemId, agentRole) as { threadId: string } | undefined;
    return row?.threadId;
  }

  upsertThreadBinding(workItemId: string, agentRole: string, threadId: string): void {
    this.connection().prepare(`
      INSERT INTO thread_bindings (work_item_id, agent_role, thread_id, updated_at)
      VALUES (@workItemId, @agentRole, @threadId, @updatedAt)
      ON CONFLICT(work_item_id, agent_role) DO UPDATE SET
        thread_id = excluded.thread_id,
        updated_at = excluded.updated_at
    `).run({ workItemId, agentRole, threadId, updatedAt: now() });
  }

  appendRunLog(runId: string, level: RunLogLevel, message: string, data?: Record<string, unknown>): void {
    this.connection().prepare(`
      INSERT INTO agent_run_logs (run_id, level, message, data_json, created_at)
      VALUES (@runId, @level, @message, @dataJson, @createdAt)
    `).run({
      runId,
      level,
      message,
      dataJson: data ? stringifyJson(data) : null,
      createdAt: now()
    });
  }

  listRunLogs(runId?: string, limit = 500): AgentRunLog[] {
    const db = this.connection();
    const rows = runId
      ? db.prepare("SELECT * FROM agent_run_logs WHERE run_id = ? ORDER BY id DESC LIMIT ?").all(runId, limit) as AgentRunLogRow[]
      : db.prepare("SELECT * FROM agent_run_logs ORDER BY id DESC LIMIT ?").all(limit) as AgentRunLogRow[];
    return rows.map(toAgentRunLog);
  }

  getRunsForInputEvent(inputEventId: string): AgentRun[] {
    const rows = this.connection().prepare(`
      SELECT *
      FROM agent_runs
      WHERE input_event_id = ?
      ORDER BY created_at ASC, run_id ASC
    `).all(inputEventId) as AgentRunRow[];
    return rows.map(toAgentRun);
  }

  getRunsForPolicyInputEvent(inputEventId: string, policyId: string): AgentRun[] {
    const rows = this.connection().prepare(`
      SELECT *
      FROM agent_runs
      WHERE input_event_id = ? AND policy_id = ?
      ORDER BY created_at ASC, run_id ASC
    `).all(inputEventId, policyId) as AgentRunRow[];
    return rows.map(toAgentRun);
  }

  getRunByDedupe(inputEventId: string, policyId: string, policyVersion: number, agentRole: string): AgentRun | undefined {
    const row = this.connection().prepare(`
      SELECT *
      FROM agent_runs
      WHERE input_event_id = ? AND policy_id = ? AND policy_version = ? AND agent_role = ?
    `).get(inputEventId, policyId, policyVersion, agentRole) as AgentRunRow | undefined;
    return row ? toAgentRun(row) : undefined;
  }
}
