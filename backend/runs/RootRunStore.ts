import type Database from "better-sqlite3";
import { z } from "zod";
import { canonicalNodeOutcomeSchema } from "../../shared/api/runtime-schemas.js";
import type { CanonicalNodeOutcome, RootExecutionSnapshot, RootFinalizationReport, RootRun } from "../../shared/domain/runtime.js";
import type { DashboardRunStatus, RootRunFinalization, RootRunKind, RootRunSummary } from "../../shared/domain/runs.js";
import { GraphRunNotFoundError } from "../runtime/GraphRunErrors.js";
import { canonicalJson, jsonSha256, parseJsonValue } from "../runtime/state/CanonicalJson.js";
import { validateState } from "../runtime/state/StatePatch.js";

const rowSchema = z.object({
  root_run_id: z.string(), kind: z.enum(["graph", "graph_node"]), target_id: z.string(), source: z.literal("manual"),
  status: z.enum(["queued","running","waiting_for_input","finalizing","completed","blocked","failed","cancelled"]),
  input: z.string().nullable(), outcome_json: z.string().nullable(), error_code: z.string().nullable(),
  error_message: z.string().nullable(), worktree_path: z.string(), branch: z.string(), head_sha: z.string(),
  config_hash: z.string(), snapshot_hash: z.string(), execution_snapshot_json: z.string(),
  current_state_revision: z.number().int(), transition_count: z.number().int(),
  active_graph_node_invocation_id: z.string().nullable(), active_node_run_id: z.string().nullable(),
  finalization_status: z.enum(["finalizing","completed","failed"]).nullable(),
  finalization_terminal_status: z.enum(["completed","blocked","failed","cancelled"]).nullable(),
  finalization_success: z.union([z.literal(0),z.literal(1)]).nullable(), finalization_report_json: z.string().nullable(),
  finalization_started_at: z.string().nullable(), finalization_completed_at: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(), completed_at: z.string().nullable()
}).strict();
type Row = z.infer<typeof rowSchema>;

export interface StoredRootRun extends RootRunSummary, RootRun {
  finalizationTerminalStatus?: "completed" | "blocked" | "failed" | "cancelled";
}
export interface CreateRootRunInput {
  rootRunId: string; kind: RootRunKind; targetId: string; input?: string;
  worktreePath: string; branch: string; headSha: string; configHash: string; snapshotHash: string;
  executionSnapshot: RootExecutionSnapshot; createdAt: string;
}

export class RootRunStore {
  constructor(private readonly connection: () => Database.Database) {}

  create(input: CreateRootRunInput): StoredRootRun {
    const snapshot = assertSnapshot(input.executionSnapshot);
    if (snapshot.rootKind !== input.kind) throw new Error("Root Run kind differs from its immutable snapshot.");
    if (input.kind === "graph" && snapshot.graph.id !== input.targetId) {
      throw new Error(`Graph Run target ${input.targetId} differs from snapshot Graph ${snapshot.graph.id}.`);
    }
    if (input.kind === "graph_node" && snapshot.rootGraphNodeId !== input.targetId) {
      throw new Error(`GraphNode Run target ${input.targetId} differs from its immutable snapshot.`);
    }
    const state = validateState(snapshot.graph.state.initial);
    this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO root_runs (
          root_run_id, kind, target_id, source, status, input, worktree_path, branch, head_sha,
          config_hash, snapshot_hash, execution_snapshot_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'manual', 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(input.rootRunId, input.kind, input.targetId, input.input ?? null, input.worktreePath,
        input.branch, input.headSha, input.configHash, input.snapshotHash, JSON.stringify(snapshot),
        input.createdAt, input.createdAt);
      this.connection().prepare(`
        INSERT INTO graph_state_revisions (root_run_id, revision, state_json, state_hash, created_at)
        VALUES (?, 0, ?, ?, ?)
      `).run(input.rootRunId, canonicalJson(state), jsonSha256(state), input.createdAt);
    })();
    return this.require(input.rootRunId);
  }

  get(id: string): StoredRootRun | undefined {
    const row = this.connection().prepare("SELECT * FROM root_runs WHERE root_run_id = ?").get(id);
    return row ? mapRow(rowSchema.parse(row)) : undefined;
  }
  require(id: string): StoredRootRun {
    const run = this.get(id);
    if (!run) throw new GraphRunNotFoundError(`Root Run ${id} was not found.`);
    return run;
  }
  list(limit = 2_000): StoredRootRun[] {
    return this.connection().prepare("SELECT * FROM root_runs ORDER BY updated_at DESC, rowid DESC LIMIT ?")
      .all(limit).map((row) => mapRow(rowSchema.parse(row)));
  }
  latest(kind: RootRunKind, targetId: string): StoredRootRun | undefined {
    const row = this.connection().prepare(
      "SELECT * FROM root_runs WHERE kind = ? AND target_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1"
    ).get(kind, targetId);
    return row ? mapRow(rowSchema.parse(row)) : undefined;
  }
  active(kind: RootRunKind, targetId: string): StoredRootRun | undefined {
    const row = this.connection().prepare(`
      SELECT * FROM root_runs WHERE kind = ? AND target_id = ?
        AND status IN ('queued','running','waiting_for_input','finalizing')
      ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(kind, targetId);
    return row ? mapRow(rowSchema.parse(row)) : undefined;
  }
  setStatus(id: string, status: DashboardRunStatus, detail: {
    outcome?: CanonicalNodeOutcome; errorCode?: string; errorMessage?: string; timestamp?: string;
  } = {}): StoredRootRun {
    const at = detail.timestamp ?? new Date().toISOString();
    const terminal = ["completed","blocked","failed","cancelled"].includes(status);
    this.connection().prepare(`
      UPDATE root_runs SET status = ?, outcome_json = COALESCE(?, outcome_json),
        error_code = ?, error_message = ?, updated_at = ?,
        completed_at = CASE WHEN ? THEN COALESCE(completed_at, ?) ELSE NULL END
      WHERE root_run_id = ?
    `).run(status, detail.outcome ? JSON.stringify(detail.outcome) : null,
      detail.errorCode ?? null, detail.errorMessage ?? null, at, terminal ? 1 : 0, at, id);
    return this.require(id);
  }
  startFinalization(id: string, success: boolean, terminalStatus: "completed"|"blocked"|"failed"|"cancelled"): StoredRootRun {
    const at = new Date().toISOString();
    this.connection().prepare(`
      UPDATE root_runs SET status = 'finalizing', finalization_status = 'finalizing',
        finalization_terminal_status = ?, finalization_success = ?, finalization_started_at = ?,
        updated_at = ? WHERE root_run_id = ?
    `).run(terminalStatus, success ? 1 : 0, at, at, id);
    return this.require(id);
  }
  finishFinalization(id: string, report: RootFinalizationReport): StoredRootRun {
    const at = new Date().toISOString();
    this.connection().prepare(`
      UPDATE root_runs SET status = finalization_terminal_status, finalization_status = 'completed',
        finalization_report_json = ?, finalization_completed_at = ?, completed_at = ?, updated_at = ?
      WHERE root_run_id = ? AND status = 'finalizing'
    `).run(JSON.stringify(report), at, at, at, id);
    return this.require(id);
  }
  failFinalization(id: string, message: string): StoredRootRun {
    const at = new Date().toISOString();
    this.connection().prepare(`
      UPDATE root_runs SET status = 'failed', finalization_status = 'failed', error_code = 'finalization_failed',
        error_message = ?, finalization_completed_at = ?, completed_at = ?, updated_at = ?
      WHERE root_run_id = ?
    `).run(message, at, at, at, id);
    return this.require(id);
  }
}

const assertSnapshot = (value: RootExecutionSnapshot): RootExecutionSnapshot => {
  if (value.version !== 7 || !["graph","graph_node"].includes(value.rootKind)
    || !value.graph || !Array.isArray(value.graph.graphNodes)) {
    throw new Error("Root execution snapshot v7 is invalid.");
  }
  return structuredClone(value);
};
const mapRow = (row: Row): StoredRootRun => ({
  rootRunId: row.root_run_id, kind: row.kind, targetId: row.target_id, source: "manual",
  status: row.status, stateRevision: row.current_state_revision, input: row.input ?? undefined,
  outcome: row.outcome_json ? parseOutcome(row.outcome_json, row.root_run_id) : undefined,
  errorCode: row.error_code ?? undefined, errorMessage: row.error_message ?? undefined,
  worktreePath: row.worktree_path, branch: row.branch, headSha: row.head_sha,
  configHash: row.config_hash, snapshotHash: row.snapshot_hash, transitionCount: row.transition_count,
  activeGraphNodeInvocationId: row.active_graph_node_invocation_id ?? undefined,
  activeNodeRunId: row.active_node_run_id ?? undefined,
  executionSnapshot: assertSnapshot(JSON.parse(row.execution_snapshot_json) as RootExecutionSnapshot),
  finalizationTerminalStatus: row.finalization_terminal_status ?? undefined,
  finalization: parseFinalization(row), createdAt: row.created_at, updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});
const parseOutcome = (source: string, id: string): CanonicalNodeOutcome => {
  const parsed = canonicalNodeOutcomeSchema.safeParse(parseJsonValue(source, `Root Run ${id} outcome`));
  if (!parsed.success) throw new Error(`Root Run ${id} has an invalid persisted outcome.`);
  return parsed.data;
};
const parseFinalization = (row: Row): RootRunFinalization | undefined => {
  if (!row.finalization_status || !row.finalization_started_at) return undefined;
  return {
    status: row.finalization_status, success: Boolean(row.finalization_success),
    report: row.finalization_report_json ? JSON.parse(row.finalization_report_json) as RootFinalizationReport : undefined,
    startedAt: row.finalization_started_at, completedAt: row.finalization_completed_at ?? undefined
  };
};
