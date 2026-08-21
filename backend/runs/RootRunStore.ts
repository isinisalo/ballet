import type Database from "better-sqlite3";
import { z } from "zod";
import { canonicalNodeOutcomeSchema } from "../../shared/api/runtime-schemas.js";
import type {
  CanonicalNodeOutcome, RootExecutionSnapshot, RootFinalizationReport, RootRun
} from "../../shared/domain/runtime.js";
import type {
  DashboardRunStatus, RootRunFinalization, RootRunKind, RootRunSource, RootRunSummary
} from "../../shared/domain/runs.js";
import { LoopRunNotFoundError } from "../runtime/LoopRunErrors.js";
import { rootExecutionSnapshotSchema } from "../runtime/RootExecutionSnapshotSchema.js";
import { canonicalJson, jsonSha256, parseJsonValue } from "../runtime/state/CanonicalJson.js";
import { validateState } from "../runtime/state/StatePatch.js";

const rootRunRowSchema = z.object({
  root_run_id: z.string(), kind: z.enum(["graph", "loop"]), target_id: z.string(), source: z.enum(["manual", "schedule"]),
  status: z.enum(["queued", "running", "waiting_for_input", "finalizing", "completed", "blocked", "failed", "cancelled"]),
  input: z.string().nullable(), outcome_json: z.string().nullable(), error_code: z.string().nullable(),
  error_message: z.string().nullable(), worktree_path: z.string(), branch: z.string(), head_sha: z.string(),
  config_hash: z.string(), snapshot_hash: z.string(), execution_snapshot_json: z.string(),
  current_state_revision: z.number().int(), transition_count: z.number().int(),
  active_loop_run_id: z.string().nullable(), active_node_run_id: z.string().nullable(),
  finalization_status: z.enum(["finalizing", "completed", "failed"]).nullable(),
  finalization_terminal_status: z.enum(["completed", "blocked", "failed", "cancelled"]).nullable(),
  finalization_success: z.union([z.literal(0), z.literal(1)]).nullable(), finalization_report_json: z.string().nullable(),
  finalization_started_at: z.string().nullable(), finalization_completed_at: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(), completed_at: z.string().nullable()
}).strict();
type RootRunRow = z.infer<typeof rootRunRowSchema>;

export interface StoredRootRun extends RootRunSummary, RootRun {
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
  executionSnapshot: RootExecutionSnapshot;
  createdAt: string;
}

export class RootRunStore {
  constructor(private readonly connection: () => Database.Database) {}

  create(input: CreateRootRunInput): StoredRootRun {
    const snapshot = rootExecutionSnapshotSchema.parse(input.executionSnapshot);
    if (snapshot.rootKind !== input.kind) {
      throw new Error(`Root Run kind ${input.kind} does not match snapshot kind ${snapshot.rootKind}.`);
    }
    if (input.kind === "loop" && snapshot.rootLoopId !== input.targetId) {
      throw new Error(`Root Run target ${input.targetId} does not match snapshot Root Loop ${snapshot.rootLoopId}.`);
    }
    if (input.kind === "graph" && (snapshot.graph.id !== input.targetId
      || snapshot.graph.startLoopId !== snapshot.rootLoopId)) {
      throw new Error(
        `Graph Run target ${input.targetId} does not match snapshot Graph ${snapshot.graph.id} and start Loop ${snapshot.rootLoopId}.`
      );
    }
    const rootLoop = snapshot.loops.find((loop) => loop.id === snapshot.rootLoopId);
    if (!rootLoop) throw new Error(`Root Loop ${snapshot.rootLoopId} is missing from its execution snapshot.`);
    const state = validateState(rootLoop.state.initial);
    const stateJson = canonicalJson(state);
    this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO root_runs (
          root_run_id, kind, target_id, source, status, input, worktree_path, branch,
          head_sha, config_hash, snapshot_hash, execution_snapshot_json,
          current_state_revision, transition_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
      `).run(input.rootRunId, input.kind, input.targetId, input.source, input.input ?? null,
        input.worktreePath, input.branch, input.headSha, input.configHash, input.snapshotHash,
        JSON.stringify(snapshot), input.createdAt, input.createdAt);
      this.connection().prepare(`
        INSERT INTO state_revisions (root_run_id, revision, state_json, state_hash, created_at)
        VALUES (?, 0, ?, ?, ?)
      `).run(input.rootRunId, stateJson, jsonSha256(state), input.createdAt);
      if (input.kind === "graph") {
        this.connection().prepare(`
          INSERT INTO graph_run_states (
            root_run_id, graph_id, start_loop_id, current_loop_id,
            root_external_ref, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          input.rootRunId, snapshot.graph.id, snapshot.graph.startLoopId, snapshot.rootLoopId,
          `ballet-root:${input.rootRunId}`, input.createdAt
        );
      }
    })();
    return this.require(input.rootRunId);
  }

  get(rootRunId: string): StoredRootRun | undefined {
    const value = this.connection().prepare("SELECT * FROM root_runs WHERE root_run_id = ?").get(rootRunId);
    return value ? toRootRun(rootRunRowSchema.parse(value)) : undefined;
  }

  require(rootRunId: string): StoredRootRun {
    const run = this.get(rootRunId);
    if (!run) throw new LoopRunNotFoundError(`Root Run ${rootRunId} was not found.`);
    return run;
  }

  list(limit = 2_000): StoredRootRun[] {
    return this.connection().prepare(`
      SELECT * FROM root_runs ORDER BY updated_at DESC, rowid DESC LIMIT ?
    `).all(limit).map((row) => toRootRun(rootRunRowSchema.parse(row)));
  }

  latest(kind: RootRunKind, targetId: string): StoredRootRun | undefined {
    const value = this.connection().prepare(`
      SELECT * FROM root_runs WHERE kind = ? AND target_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(kind, targetId);
    return value ? toRootRun(rootRunRowSchema.parse(value)) : undefined;
  }

  active(kind: RootRunKind, targetId: string): StoredRootRun | undefined {
    const value = this.connection().prepare(`
      SELECT * FROM root_runs WHERE kind = ? AND target_id = ?
        AND status IN ('queued','running','waiting_for_input','finalizing')
      ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(kind, targetId);
    return value ? toRootRun(rootRunRowSchema.parse(value)) : undefined;
  }

  setStatus(rootRunId: string, status: DashboardRunStatus, detail: {
    outcome?: CanonicalNodeOutcome;
    errorCode?: string;
    errorMessage?: string;
    timestamp?: string;
  } = {}): StoredRootRun {
    const timestamp = detail.timestamp ?? new Date().toISOString();
    const terminal = ["completed", "blocked", "failed", "cancelled"].includes(status);
    this.connection().prepare(`
      UPDATE root_runs SET status = ?, outcome_json = COALESCE(?, outcome_json),
        error_code = COALESCE(?, error_code), error_message = COALESCE(?, error_message), updated_at = ?,
        completed_at = CASE WHEN ? THEN COALESCE(completed_at, ?) ELSE completed_at END
      WHERE root_run_id = ?
    `).run(status, detail.outcome ? JSON.stringify(detail.outcome) : null,
      detail.errorCode ?? null, detail.errorMessage ?? null, timestamp,
      terminal ? 1 : 0, timestamp, rootRunId);
    return this.require(rootRunId);
  }

  startFinalization(
    rootRunId: string,
    success: boolean,
    terminalStatus: "completed" | "blocked" | "failed" | "cancelled",
    detail: { errorCode?: string; errorMessage?: string; timestamp?: string } = {}
  ): StoredRootRun {
    const timestamp = detail.timestamp ?? new Date().toISOString();
    this.connection().prepare(`
      UPDATE root_runs SET status = 'finalizing', finalization_status = 'finalizing',
        finalization_terminal_status = ?, finalization_success = ?,
        error_code = COALESCE(?, error_code), error_message = COALESCE(?, error_message),
        finalization_started_at = COALESCE(finalization_started_at, ?), completed_at = NULL, updated_at = ?
      WHERE root_run_id = ? AND finalization_status IS NULL
        AND status IN ('queued','running','waiting_for_input','finalizing')
    `).run(terminalStatus, success ? 1 : 0, detail.errorCode ?? null, detail.errorMessage ?? null,
      timestamp, timestamp, rootRunId);
    return this.require(rootRunId);
  }

  finishFinalization(rootRunId: string, report: RootFinalizationReport): StoredRootRun {
    const timestamp = new Date().toISOString();
    this.connection().prepare(`
      UPDATE root_runs SET status = COALESCE(finalization_terminal_status, ?), finalization_status = 'completed',
        finalization_report_json = ?, finalization_completed_at = ?, updated_at = ?, completed_at = ?
      WHERE root_run_id = ? AND status = 'finalizing'
    `).run(report.success ? "completed" : "failed", JSON.stringify(report), timestamp, timestamp, timestamp, rootRunId);
    return this.require(rootRunId);
  }

  failFinalization(rootRunId: string, message: string): StoredRootRun {
    const timestamp = new Date().toISOString();
    this.connection().prepare(`
      UPDATE root_runs SET status = 'failed', finalization_status = 'failed',
        error_code = 'finalization_failed', error_message = ?, finalization_completed_at = ?,
        updated_at = ?, completed_at = ? WHERE root_run_id = ? AND status = 'finalizing'
    `).run(message, timestamp, timestamp, timestamp, rootRunId);
    return this.require(rootRunId);
  }
}

const toRootRun = (row: RootRunRow): StoredRootRun => ({
  rootRunId: row.root_run_id, kind: row.kind, targetId: row.target_id, source: row.source,
  status: row.status, stateRevision: row.current_state_revision, input: row.input ?? undefined,
  outcome: row.outcome_json ? parseOutcome(row.outcome_json, row.root_run_id) : undefined,
  errorCode: row.error_code ?? undefined, errorMessage: row.error_message ?? undefined,
  worktreePath: row.worktree_path, branch: row.branch, headSha: row.head_sha,
  configHash: row.config_hash, snapshotHash: row.snapshot_hash, transitionCount: row.transition_count,
  activeLoopRunId: row.active_loop_run_id ?? undefined, activeNodeRunId: row.active_node_run_id ?? undefined,
  executionSnapshot: rootExecutionSnapshotSchema.parse(JSON.parse(row.execution_snapshot_json)),
  finalizationTerminalStatus: row.finalization_terminal_status ?? undefined,
  finalization: parseFinalization(row), createdAt: row.created_at, updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});

const parseOutcome = (source: string, rootRunId: string): CanonicalNodeOutcome => {
  const parsed = canonicalNodeOutcomeSchema.safeParse(parseJsonValue(source, `Root Run ${rootRunId} outcome`));
  if (!parsed.success) throw new Error(`Root Run ${rootRunId} has an invalid persisted outcome.`);
  return parsed.data;
};

const parseFinalization = (row: RootRunRow): RootRunFinalization | undefined => {
  if (!row.finalization_status || !row.finalization_started_at) return undefined;
  const report = row.finalization_report_json
    ? parseFinalizationReport(row.finalization_report_json, row.root_run_id) : undefined;
  return {
    status: row.finalization_status, success: Boolean(row.finalization_success), report,
    startedAt: row.finalization_started_at, completedAt: row.finalization_completed_at ?? undefined
  };
};

const parseFinalizationReport = (source: string, rootRunId: string): RootFinalizationReport => {
  const value: unknown = JSON.parse(source);
  if (typeof value !== "object" || value === null || !("success" in value) || typeof value.success !== "boolean"
    || !("retained" in value) || typeof value.retained !== "boolean" || !("branch" in value)
    || typeof value.branch !== "string" || !("worktreePath" in value) || typeof value.worktreePath !== "string"
    || !("changedFiles" in value) || !Array.isArray(value.changedFiles) || !value.changedFiles.every((item) => typeof item === "string")
    || !("snapshotHash" in value) || typeof value.snapshotHash !== "string") {
    throw new Error(`Root Run ${rootRunId} has an invalid persisted finalization report.`);
  }
  return { success: value.success, retained: value.retained, branch: value.branch,
    worktreePath: value.worktreePath, commitSha: "commitSha" in value && typeof value.commitSha === "string" ? value.commitSha : undefined,
    changedFiles: value.changedFiles, snapshotHash: value.snapshotHash };
};
