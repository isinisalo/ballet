import type Database from "better-sqlite3";
import type { CanonicalNodeOutcome, GraphStateRevisionMetadata, StatePatch } from "../../shared/domain/runtime.js";
import type { RootRunStateProjection } from "../../shared/domain/runs.js";
import { applyStatePatch } from "./state/StatePatch.js";
import { canonicalJson, parseJsonValue } from "./state/CanonicalJson.js";

type Row = Record<string, unknown>;

export class RuntimeStateStore {
  constructor(private readonly connection: () => Database.Database) {}

  current(rootRunId: string) {
    const row = this.connection().prepare(`
      SELECT state_json FROM graph_state_revisions WHERE root_run_id = ? ORDER BY revision DESC LIMIT 1
    `).get(rootRunId) as Row | undefined;
    if (!row) throw new Error(`Root Run ${rootRunId} has no State revision.`);
    return parseJsonValue(String(row.state_json), `Root Run ${rootRunId} State`);
  }

  revision(rootRunId: string): number {
    const row = this.connection().prepare(
      "SELECT current_state_revision FROM root_runs WHERE root_run_id = ?"
    ).get(rootRunId) as Row | undefined;
    if (!row) throw new Error(`Root Run ${rootRunId} was not found.`);
    return Number(row.current_state_revision);
  }

  apply(rootRunId: string, sourceNodeRunId: string, patch: StatePatch, outcome: CanonicalNodeOutcome): number {
    const parent = this.revision(rootRunId);
    const applied = applyStatePatch(this.current(rootRunId), patch);
    const revision = parent + 1;
    const at = new Date().toISOString();
    this.connection().prepare(`
      INSERT INTO graph_state_revisions (
        root_run_id, revision, parent_revision, state_json, state_hash, patch_json, patch_hash,
        source_node_run_id, outcome_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(rootRunId, revision, parent, applied.stateJson, applied.stateSha256, applied.patchJson,
      applied.patchSha256, sourceNodeRunId,
      canonicalJson(outcome as unknown as import("../../shared/domain/automation.js").JsonValue), at);
    this.connection().prepare(`
      UPDATE root_runs SET current_state_revision = ?, updated_at = ? WHERE root_run_id = ?
    `).run(revision, at, rootRunId);
    return revision;
  }

  read(rootRunId: string): RootRunStateProjection {
    const rows = this.connection().prepare(`
      SELECT * FROM graph_state_revisions WHERE root_run_id = ? ORDER BY revision DESC LIMIT 64
    `).all(rootRunId) as Row[];
    if (rows.length === 0) throw new Error(`Root Run ${rootRunId} has no State revision.`);
    const total = Number((this.connection().prepare(
      "SELECT COUNT(*) AS count FROM graph_state_revisions WHERE root_run_id = ?"
    ).get(rootRunId) as Row).count);
    const current = rows[0]!;
    return {
      currentRevision: Number(current.revision),
      currentState: parseJsonValue(String(current.state_json), `Root Run ${rootRunId} State`),
      currentStateSha256: String(current.state_hash),
      revisions: rows.map(mapRevision),
      totalRevisionCount: total,
      historyTruncated: total > rows.length
    };
  }
}

function mapRevision(row: Row): GraphStateRevisionMetadata {
  const patch = row.patch_json ? parseJsonValue(String(row.patch_json), "State patch") as StatePatch : undefined;
  return {
    rootRunId: String(row.root_run_id), revision: Number(row.revision),
    parentRevision: row.parent_revision === null ? undefined : Number(row.parent_revision),
    stateSha256: String(row.state_hash), sourceNodeRunId: optional(row.source_node_run_id),
    patch: patch ? { patch, patchSha256: String(row.patch_hash) } : undefined,
    patchOmitted: false, createdAt: String(row.created_at)
  };
}

const optional = (value: unknown): string | undefined => value === null || value === undefined ? undefined : String(value);
