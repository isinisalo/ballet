import type Database from "better-sqlite3";
import type {
  AgentOutcome,
  ExecutionRuntimeSnapshot,
  RootFinalizationReport
} from "../../shared/domain/runtime.js";
import type {
  DashboardRunStatus,
  RootRunFinalization,
  RootRunKind,
  RootRunSource,
  RootRunSummary
} from "../../shared/domain/runs.js";

interface RootRunRow {
  root_run_id: string;
  kind: RootRunKind;
  target_id: string;
  source: RootRunSource;
  status: DashboardRunStatus;
  input: string | null;
  outcome_json: string | null;
  error_code: string | null;
  error_message: string | null;
  worktree_path: string;
  branch: string;
  head_sha: string;
  config_hash: string;
  snapshot_hash: string;
  runtime_snapshot_json: string | null;
  finalization_status: RootRunFinalization["status"] | null;
  finalization_terminal_status: "completed" | "blocked" | "failed" | "cancelled" | null;
  finalization_success: 0 | 1 | null;
  finalization_report_json: string | null;
  finalization_started_at: string | null;
  finalization_completed_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface StoredRootRun extends RootRunSummary {
  worktreePath: string;
  branch: string;
  headSha: string;
  configHash: string;
  snapshotHash: string;
  runtimeSnapshot?: ExecutionRuntimeSnapshot;
  finalizationTerminalStatus?: "completed" | "blocked" | "failed" | "cancelled";
}

export interface CreateRootRunInput {
  rootRunId: string;
  kind: RootRunKind;
  targetId: string;
  source: RootRunSource;
  input?: string;
  worktreePath: string;
  branch: string;
  headSha: string;
  configHash: string;
  snapshotHash: string;
  createdAt: string;
}

export class RootRunStore {
  constructor(private readonly connection: () => Database.Database) {}

  create(input: CreateRootRunInput): StoredRootRun {
    this.connection().prepare(`
      INSERT INTO root_runs (
        root_run_id, kind, target_id, source, status, input, worktree_path, branch,
        head_sha, config_hash, snapshot_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.rootRunId, input.kind, input.targetId, input.source, input.input ?? null,
      input.worktreePath, input.branch, input.headSha, input.configHash, input.snapshotHash,
      input.createdAt, input.createdAt);
    return this.require(input.rootRunId);
  }

  get(rootRunId: string): StoredRootRun | undefined {
    const row = this.connection().prepare("SELECT * FROM root_runs WHERE root_run_id = ?")
      .get(rootRunId) as RootRunRow | undefined;
    return row ? toRootRun(row) : undefined;
  }

  require(rootRunId: string): StoredRootRun {
    const run = this.get(rootRunId);
    if (!run) throw new Error(`Root Run ${rootRunId} was not found.`);
    return run;
  }

  list(limit = 2_000): StoredRootRun[] {
    const rows = this.connection().prepare(`
      SELECT * FROM root_runs ORDER BY updated_at DESC, rowid DESC LIMIT ?
    `).all(limit) as RootRunRow[];
    return rows.map(toRootRun);
  }

  latest(kind: RootRunKind, targetId: string): StoredRootRun | undefined {
    const row = this.connection().prepare(`
      SELECT * FROM root_runs WHERE kind = ? AND target_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(kind, targetId) as RootRunRow | undefined;
    return row ? toRootRun(row) : undefined;
  }

  active(kind: RootRunKind, targetId: string): StoredRootRun | undefined {
    const row = this.connection().prepare(`
      SELECT * FROM root_runs WHERE kind = ? AND target_id = ?
        AND status IN ('queued','running','waiting_for_human','finalizing')
      ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(kind, targetId) as RootRunRow | undefined;
    return row ? toRootRun(row) : undefined;
  }

  setStatus(rootRunId: string, status: DashboardRunStatus, detail: {
    outcome?: AgentOutcome;
    errorCode?: string;
    errorMessage?: string;
    runtime?: ExecutionRuntimeSnapshot;
  } = {}): StoredRootRun {
    const timestamp = new Date().toISOString();
    const terminal = ["completed", "blocked", "failed", "cancelled"].includes(status);
    this.connection().prepare(`
      UPDATE root_runs SET status = ?, outcome_json = COALESCE(?, outcome_json),
        error_code = COALESCE(?, error_code), error_message = COALESCE(?, error_message),
        runtime_snapshot_json = COALESCE(?, runtime_snapshot_json), updated_at = ?,
        completed_at = CASE WHEN ? THEN COALESCE(completed_at, ?) ELSE completed_at END
      WHERE root_run_id = ?
    `).run(status, detail.outcome ? JSON.stringify(detail.outcome) : null,
      detail.errorCode ?? null, detail.errorMessage ?? null,
      detail.runtime ? JSON.stringify(detail.runtime) : null, timestamp,
      terminal ? 1 : 0, timestamp, rootRunId);
    return this.require(rootRunId);
  }

  startFinalization(
    rootRunId: string,
    success: boolean,
    terminalStatus: "completed" | "blocked" | "failed" | "cancelled"
  ): StoredRootRun {
    const timestamp = new Date().toISOString();
    this.connection().prepare(`
      UPDATE root_runs SET status = 'finalizing', finalization_status = 'finalizing',
        finalization_terminal_status = ?, finalization_success = ?,
        finalization_started_at = COALESCE(finalization_started_at, ?), completed_at = NULL, updated_at = ?
      WHERE root_run_id = ? AND finalization_status IS NULL
    `).run(terminalStatus, success ? 1 : 0, timestamp, timestamp, rootRunId);
    return this.require(rootRunId);
  }

  finishFinalization(rootRunId: string, report: RootFinalizationReport): StoredRootRun {
    const timestamp = new Date().toISOString();
    this.connection().prepare(`
      UPDATE root_runs SET status = COALESCE(finalization_terminal_status, ?), finalization_status = 'completed',
        finalization_report_json = ?, finalization_completed_at = ?, updated_at = ?, completed_at = ?
      WHERE root_run_id = ?
    `).run(report.success ? "completed" : "failed", JSON.stringify(report), timestamp, timestamp, timestamp, rootRunId);
    return this.require(rootRunId);
  }

  failFinalization(rootRunId: string, message: string): StoredRootRun {
    const timestamp = new Date().toISOString();
    this.connection().prepare(`
      UPDATE root_runs SET status = 'failed', finalization_status = 'failed',
        error_code = 'finalization_failed', error_message = ?, finalization_completed_at = ?,
        updated_at = ?, completed_at = ? WHERE root_run_id = ?
    `).run(message, timestamp, timestamp, timestamp, rootRunId);
    return this.require(rootRunId);
  }
}

const toRootRun = (row: RootRunRow): StoredRootRun => ({
  rootRunId: row.root_run_id,
  kind: row.kind,
  targetId: row.target_id,
  source: row.source,
  status: row.status,
  input: row.input ?? undefined,
  outcome: row.outcome_json ? JSON.parse(row.outcome_json) as AgentOutcome : undefined,
  errorCode: row.error_code ?? undefined,
  errorMessage: row.error_message ?? undefined,
  worktreePath: row.worktree_path,
  branch: row.branch,
  headSha: row.head_sha,
  configHash: row.config_hash,
  snapshotHash: row.snapshot_hash,
  runtimeSnapshot: row.runtime_snapshot_json ? JSON.parse(row.runtime_snapshot_json) as ExecutionRuntimeSnapshot : undefined,
  finalizationTerminalStatus: row.finalization_terminal_status ?? undefined,
  finalization: row.finalization_status && row.finalization_started_at ? {
    status: row.finalization_status,
    success: Boolean(row.finalization_success),
    report: row.finalization_report_json ? JSON.parse(row.finalization_report_json) as RootFinalizationReport : undefined,
    startedAt: row.finalization_started_at,
    completedAt: row.finalization_completed_at ?? undefined
  } : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});
