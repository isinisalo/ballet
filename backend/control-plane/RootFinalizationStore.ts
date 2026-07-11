import type Database from "better-sqlite3";
import type { ExecutionTask, RootFinalizationReport, RootRunDisposition } from "../../shared/domain/runtime.js";
import { secureEqual, tokenHash } from "./crypto.js";
import { ControlPlaneConflictError, ControlPlaneFencingError, ControlPlaneNotFoundError } from "./errors.js";
import { toExecutionTask, type ExecutionTaskRow } from "./ExecutionMappers.js";

interface FinalizationRow {
  root_run_id: string;
  project_id: string;
  device_id: string;
  task_id: string | null;
  fencing: number | null;
  task_token_hash: string | null;
  expected_success: 0 | 1;
  snapshot_hash: string;
  status: "pending" | "reported";
  report_json: string | null;
}

export interface RootFinalizationCredential {
  deviceId: string;
  taskToken: string;
  fencing: number;
}

export interface PendingRootFinalization {
  projectId: string;
  rootRunId: string;
  success: boolean;
}

export class RootFinalizationStore {
  constructor(private readonly connection: () => Database.Database, private readonly now: () => Date) {}

  authorize(task: ExecutionTask, credential: RootFinalizationCredential, disposition: RootRunDisposition): void {
    if (!disposition.terminal || !["succeeded", "failed", "cancelled"].includes(task.status)) {
      throw new ControlPlaneConflictError("Only a terminal execution task can authorize root finalization.");
    }
    const taskRow = this.connection().prepare("SELECT task_token_hash FROM execution_tasks WHERE task_id = ?")
      .get(task.id) as { task_token_hash: string | null } | undefined;
    if (!taskRow?.task_token_hash || credential.deviceId !== task.deviceId || credential.fencing !== task.fencing
      || !secureEqual(tokenHash(credential.taskToken), taskRow.task_token_hash)) throw new ControlPlaneFencingError();

    const existing = this.get(task.rootRunId);
    if (existing) {
      const same = existing.task_id === task.id && existing.fencing === task.fencing
        && existing.expected_success === (disposition.success ? 1 : 0)
        && Boolean(existing.task_token_hash) && secureEqual(existing.task_token_hash!, taskRow.task_token_hash);
      if (!same) throw new ControlPlaneConflictError(`Root run ${task.rootRunId} has a different finalization authorization.`);
      return;
    }
    this.connection().prepare(`
      INSERT INTO root_run_finalizations (
        root_run_id, project_id, device_id, task_id, fencing, task_token_hash,
        expected_success, snapshot_hash, status, authorized_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(task.rootRunId, task.projectId, task.deviceId, task.id, task.fencing,
      taskRow.task_token_hash, disposition.success ? 1 : 0, task.spec.project.snapshotHash, this.now().toISOString());
  }

  authorizeRequested(projectId: string, deviceId: string, rootRunId: string, success: boolean, snapshotHash: string): void {
    const existing = this.get(rootRunId);
    if (existing) {
      if (existing.project_id !== projectId || existing.device_id !== deviceId
        || existing.expected_success !== (success ? 1 : 0) || existing.snapshot_hash !== snapshotHash) {
        throw new ControlPlaneConflictError(`Root run ${rootRunId} has a different finalization authorization.`);
      }
      return;
    }
    this.connection().prepare(`
      INSERT INTO root_run_finalizations (
        root_run_id, project_id, device_id, expected_success, snapshot_hash, status, authorized_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).run(rootRunId, projectId, deviceId, success ? 1 : 0, snapshotHash, this.now().toISOString());
  }

  pendingForDevice(deviceId: string): PendingRootFinalization[] {
    const rows = this.connection().prepare(`
      SELECT project_id, root_run_id, expected_success FROM root_run_finalizations
      WHERE device_id = ? AND status = 'pending' ORDER BY authorized_at
    `).all(deviceId) as Array<{ project_id: string; root_run_id: string; expected_success: 0 | 1 }>;
    return rows.map((row) => ({
      projectId: row.project_id,
      rootRunId: row.root_run_id,
      success: Boolean(row.expected_success)
    }));
  }

  report(rootRunId: string, credential: RootFinalizationCredential, report: RootFinalizationReport): {
    task: ExecutionTask;
    report: RootFinalizationReport;
  } {
    const row = this.get(rootRunId);
    if (!row) throw new ControlPlaneNotFoundError(`Root run ${rootRunId} has no pending finalization authorization.`);
    this.assertCredential(row, credential);
    const taskRow = this.connection().prepare("SELECT * FROM execution_tasks WHERE task_id = ?").get(row.task_id) as ExecutionTaskRow | undefined;
    if (!taskRow) throw new ControlPlaneNotFoundError(`Finalizing task ${row.task_id} was not found.`);
    const task = toExecutionTask(taskRow);
    if (report.success !== Boolean(row.expected_success)) {
      throw new ControlPlaneConflictError("Root finalization result does not match the server-authorized disposition.");
    }
    if (report.snapshotHash !== task.spec.project.snapshotHash) {
      throw new ControlPlaneConflictError("Root finalization snapshot does not match the immutable execution specification.");
    }
    const serialized = JSON.stringify(report);
    if (row.status === "reported") {
      if (row.report_json !== serialized) throw new ControlPlaneConflictError("Root finalization was already reported with different content.");
      return { task, report };
    }
    this.connection().prepare(`
      UPDATE root_run_finalizations SET status = 'reported', report_json = ?, finalized_at = ?
      WHERE root_run_id = ? AND status = 'pending'
    `).run(serialized, this.now().toISOString(), rootRunId);
    return { task, report };
  }

  reportRequested(
    projectId: string,
    deviceId: string,
    rootRunId: string,
    report: RootFinalizationReport
  ): { task?: ExecutionTask; report: RootFinalizationReport } {
    const row = this.get(rootRunId);
    if (!row) throw new ControlPlaneNotFoundError(`Root run ${rootRunId} has no pending device finalization request.`);
    if (row.project_id !== projectId || row.device_id !== deviceId) throw new ControlPlaneFencingError();
    this.assertReport(row, report);
    const serialized = JSON.stringify(report);
    const taskRow = row.task_id
      ? this.connection().prepare("SELECT * FROM execution_tasks WHERE task_id = ?").get(row.task_id) as ExecutionTaskRow | undefined
      : undefined;
    const task = taskRow ? toExecutionTask(taskRow) : undefined;
    if (row.status === "reported") {
      if (row.report_json !== serialized) throw new ControlPlaneConflictError("Root finalization was already reported with different content.");
      return { task, report };
    }
    this.connection().prepare(`
      UPDATE root_run_finalizations SET status = 'reported', report_json = ?, finalized_at = ?
      WHERE root_run_id = ? AND status = 'pending'
    `).run(serialized, this.now().toISOString(), rootRunId);
    return { task, report };
  }

  private get(rootRunId: string): FinalizationRow | undefined {
    return this.connection().prepare("SELECT * FROM root_run_finalizations WHERE root_run_id = ?")
      .get(rootRunId) as FinalizationRow | undefined;
  }

  private assertCredential(row: FinalizationRow, credential: RootFinalizationCredential): void {
    if (credential.deviceId !== row.device_id || credential.fencing !== row.fencing || !row.task_token_hash
      || !secureEqual(tokenHash(credential.taskToken), row.task_token_hash)) throw new ControlPlaneFencingError();
  }

  private assertReport(row: FinalizationRow, report: RootFinalizationReport): void {
    if (report.success !== Boolean(row.expected_success)) {
      throw new ControlPlaneConflictError("Root finalization result does not match the server-authorized disposition.");
    }
    if (report.snapshotHash !== row.snapshot_hash) {
      throw new ControlPlaneConflictError("Root finalization snapshot does not match the immutable execution plan.");
    }
  }
}
