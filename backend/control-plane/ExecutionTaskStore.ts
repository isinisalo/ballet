import type Database from "better-sqlite3";
import type { AgentOutcome, ExecutionSpec, ExecutionTask, ExecutionTaskStatus } from "../../shared/domain/runtime.js";
import { opaqueToken, secureEqual, tokenHash, valueHash } from "./crypto.js";
import { ControlPlaneConflictError, ControlPlaneFencingError, ControlPlaneNotFoundError } from "./errors.js";
import { toExecutionTask, type ExecutionTaskRow } from "./ExecutionMappers.js";

interface FencedTaskRow extends ExecutionTaskRow {
  task_token_hash: string | null;
}

export interface FencedTaskInput {
  deviceId: string;
  taskId: string;
  taskToken: string;
  fencing: number;
}

export interface TaskClaim {
  task: ExecutionTask;
  taskToken: string;
}

const activeStatuses: ExecutionTaskStatus[] = ["claimed", "preparing", "running"];
const terminalStatuses: ExecutionTaskStatus[] = ["succeeded", "failed", "cancelled"];

export class ExecutionTaskStore {
  constructor(private readonly connection: () => Database.Database, private readonly now: () => Date) {}

  create(spec: ExecutionSpec): ExecutionTask {
    const timestamp = spec.createdAt;
    this.connection().prepare(`
      INSERT INTO execution_tasks (
        task_id, project_id, runtime_backend_id, device_id, kind, root_run_id,
        status, spec_json, spec_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)
    `).run(spec.taskId, spec.projectId, spec.runtime.runtimeBackendId, spec.runtime.deviceId,
      spec.kind, spec.rootRunId, JSON.stringify(spec), valueHash(spec), timestamp, timestamp);
    return this.require(spec.taskId);
  }

  get(taskId: string): ExecutionTask | undefined {
    const row = this.connection().prepare("SELECT * FROM execution_tasks WHERE task_id = ?").get(taskId) as ExecutionTaskRow | undefined;
    return row ? toExecutionTask(row) : undefined;
  }

  require(taskId: string): ExecutionTask {
    const task = this.get(taskId);
    if (!task) throw new ControlPlaneNotFoundError(`Execution task ${taskId} was not found.`);
    return task;
  }

  claim(deviceId: string, runtimeBackendId: string, leaseSeconds = 60): TaskClaim | undefined {
    const transaction = this.connection().transaction(() => {
      const now = this.now();
      const row = this.connection().prepare(`
        SELECT task_id FROM execution_tasks
        WHERE runtime_backend_id = ? AND device_id = ? AND status = 'queued'
          AND NOT EXISTS (
            SELECT 1 FROM execution_tasks active
            WHERE active.runtime_backend_id = ? AND active.status IN ('claimed','preparing','running')
          )
        ORDER BY created_at ASC, rowid ASC LIMIT 1
      `).get(runtimeBackendId, deviceId, runtimeBackendId) as { task_id: string } | undefined;
      if (!row) return undefined;
      const taskToken = opaqueToken();
      const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
      const claimed = this.connection().prepare(`
        UPDATE execution_tasks SET status = 'claimed', task_token_hash = ?, fencing = fencing + 1,
          lease_until = ?, claimed_at = COALESCE(claimed_at, ?), updated_at = ?
        WHERE task_id = ? AND status = 'queued'
      `).run(tokenHash(taskToken), leaseUntil, now.toISOString(), now.toISOString(), row.task_id);
      if (claimed.changes !== 1) return undefined;
      return { task: this.require(row.task_id), taskToken };
    });
    try {
      return transaction() as TaskClaim | undefined;
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String((error as Error & { code?: unknown }).code) : "";
      if (code.startsWith("SQLITE_CONSTRAINT") && error instanceof Error && error.message.includes("runtime_backend_id")) return undefined;
      throw error;
    }
  }

  renew(input: FencedTaskInput, leaseSeconds = 60): ExecutionTask {
    const transaction = this.connection().transaction(() => {
      this.requireFenced(input);
      const now = this.now();
      this.connection().prepare("UPDATE execution_tasks SET lease_until = ?, updated_at = ? WHERE task_id = ?")
        .run(new Date(now.getTime() + leaseSeconds * 1000).toISOString(), now.toISOString(), input.taskId);
      return this.require(input.taskId);
    });
    return transaction() as ExecutionTask;
  }

  assertFenced(input: FencedTaskInput): ExecutionTask {
    return toExecutionTask(this.requireFenced(input));
  }

  setState(input: FencedTaskInput & { status: "preparing" | "running" }): ExecutionTask {
    const transaction = this.connection().transaction(() => {
      this.requireFenced(input);
      const timestamp = this.now().toISOString();
      this.connection().prepare(`
        UPDATE execution_tasks SET status = ?, started_at = CASE WHEN ? = 'running' THEN COALESCE(started_at, ?) ELSE started_at END,
          updated_at = ? WHERE task_id = ?
      `).run(input.status, input.status, timestamp, timestamp, input.taskId);
      return this.require(input.taskId);
    });
    return transaction() as ExecutionTask;
  }

  complete(input: FencedTaskInput & { outcome: AgentOutcome }): ExecutionTask {
    return this.finish(input, "succeeded", { outcome: input.outcome });
  }

  fail(input: FencedTaskInput & { errorCode: string; errorMessage: string }): ExecutionTask {
    return this.finish(input, "failed", { errorCode: input.errorCode, errorMessage: input.errorMessage });
  }

  cancelFenced(input: FencedTaskInput): ExecutionTask {
    return this.finish(input, "cancelled", {});
  }

  cancel(taskId: string): ExecutionTask {
    const transaction = this.connection().transaction(() => {
      const task = this.require(taskId);
      if (terminalStatuses.includes(task.status)) return task;
      const timestamp = this.now().toISOString();
      if (task.status === "queued") {
        this.connection().prepare(`
          UPDATE execution_tasks SET status = 'cancelled', fencing = fencing + 1, task_token_hash = NULL,
            lease_until = NULL, cancel_requested_at = ?, completed_at = ?, updated_at = ? WHERE task_id = ?
        `).run(timestamp, timestamp, timestamp, taskId);
      } else {
        this.connection().prepare(`
          UPDATE execution_tasks SET cancel_requested_at = COALESCE(cancel_requested_at, ?), updated_at = ?
          WHERE task_id = ? AND status IN ('claimed','preparing','running')
        `).run(timestamp, timestamp, taskId);
      }
      return this.require(taskId);
    });
    return transaction() as ExecutionTask;
  }

  markRuntimeLost(deviceId: string, reason: string): ExecutionTask[] {
    const rows = this.connection().prepare(`
      SELECT task_id FROM execution_tasks WHERE device_id = ? AND status IN ('claimed','preparing','running')
    `).all(deviceId) as Array<{ task_id: string }>;
    if (rows.length === 0) return [];
    const timestamp = this.now().toISOString();
    const transaction = this.connection().transaction(() => {
      for (const row of rows) {
        this.connection().prepare(`
          UPDATE execution_tasks SET status = 'failed', error_code = 'runtime_lost', error_message = ?,
            fencing = fencing + 1, task_token_hash = NULL, lease_until = NULL,
            completed_at = ?, updated_at = ? WHERE task_id = ?
        `).run(reason, timestamp, timestamp, row.task_id);
      }
      return rows.map((row) => this.require(row.task_id));
    });
    return transaction() as ExecutionTask[];
  }

  sweepExpiredLeases(expiredBefore: string): ExecutionTask[] {
    const rows = this.connection().prepare(`
      SELECT task_id FROM execution_tasks
      WHERE status IN ('claimed','preparing','running') AND lease_until IS NOT NULL AND lease_until < ?
    `).all(expiredBefore) as Array<{ task_id: string }>;
    if (rows.length === 0) return [];
    const timestamp = this.now().toISOString();
    const transaction = this.connection().transaction(() => {
      for (const row of rows) {
        this.connection().prepare(`
          UPDATE execution_tasks SET status = 'failed', error_code = 'runtime_lost',
            error_message = 'Execution task lease expired.', fencing = fencing + 1,
            task_token_hash = NULL, lease_until = NULL, completed_at = ?, updated_at = ?
          WHERE task_id = ? AND status IN ('claimed','preparing','running')
        `).run(timestamp, timestamp, row.task_id);
      }
      return rows.map((row) => this.require(row.task_id));
    });
    return transaction() as ExecutionTask[];
  }

  private finish(input: FencedTaskInput, status: "succeeded" | "failed" | "cancelled", detail: {
    outcome?: AgentOutcome;
    errorCode?: string;
    errorMessage?: string;
  }): ExecutionTask {
    const transaction = this.connection().transaction(() => {
      const existing = this.connection().prepare("SELECT * FROM execution_tasks WHERE task_id = ?").get(input.taskId) as FencedTaskRow | undefined;
      if (existing && terminalStatuses.includes(existing.status)) {
        this.assertCredentials(existing, input);
        const sameOutcome = detail.outcome ? existing.outcome_json === JSON.stringify(detail.outcome) : existing.outcome_json === null;
        const sameError = (detail.errorCode ?? null) === existing.error_code && (detail.errorMessage ?? null) === existing.error_message;
        if (existing.status !== status || !sameOutcome || !sameError) {
          throw new ControlPlaneConflictError(`Execution task is already ${existing.status} with a different result.`);
        }
        return toExecutionTask(existing);
      }
      if (existing?.cancel_requested_at && status !== "cancelled") {
        throw new ControlPlaneConflictError("Execution task cancellation has already been requested.");
      }
      this.requireFenced(input);
      const timestamp = this.now().toISOString();
      this.connection().prepare(`
        UPDATE execution_tasks SET status = ?, outcome_json = ?, error_code = ?, error_message = ?,
          lease_until = NULL, completed_at = ?, updated_at = ? WHERE task_id = ?
      `).run(status, detail.outcome ? JSON.stringify(detail.outcome) : null,
        detail.errorCode ?? null, detail.errorMessage ?? null, timestamp, timestamp, input.taskId);
      return this.require(input.taskId);
    });
    return transaction() as ExecutionTask;
  }

  private requireFenced(input: FencedTaskInput): FencedTaskRow {
    const row = this.connection().prepare("SELECT * FROM execution_tasks WHERE task_id = ?").get(input.taskId) as FencedTaskRow | undefined;
    if (!row) throw new ControlPlaneNotFoundError(`Execution task ${input.taskId} was not found.`);
    this.assertCredentials(row, input);
    if (!activeStatuses.includes(row.status)) throw new ControlPlaneConflictError(`Execution task is already ${row.status}.`);
    if (!row.lease_until || row.lease_until <= this.now().toISOString()) throw new ControlPlaneFencingError("The task lease has expired.");
    return row;
  }

  private assertCredentials(row: FencedTaskRow, input: FencedTaskInput): void {
    if (row.device_id !== input.deviceId || row.fencing !== input.fencing || !row.task_token_hash
      || !secureEqual(tokenHash(input.taskToken), row.task_token_hash)) throw new ControlPlaneFencingError();
  }
}
