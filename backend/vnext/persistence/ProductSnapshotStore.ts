import type Database from "better-sqlite3";
import type { ProductSnapshotSeed } from "../../../shared/vnext/persistence.js";
import { VNextConflictError, VNextNotFoundError } from "./VNextErrors.js";

export class ProductSnapshotStore {
  constructor(private readonly connection: () => Database.Database) {}

  create(input: ProductSnapshotSeed): void {
    const run = this.connection().prepare("SELECT status, branch, worktree_path, base_commit FROM environment_runs WHERE environment_run_id = ?")
      .get(input.environmentRunId) as Record<string, unknown> | undefined;
    if (!run) throw new VNextNotFoundError(`Environment Run ${input.environmentRunId} was not found.`);
    if (run.status !== "completed") throw new VNextConflictError("Product Snapshot requires a completed Environment Run.");
    if (run.branch !== input.branch || run.worktree_path !== input.worktreePath || run.base_commit !== input.baseCommit) {
      throw new VNextConflictError("Product Snapshot worktree identity differs from its Environment Run.");
    }
    this.connection().prepare(`
      INSERT INTO product_snapshots (
        product_snapshot_id, environment_run_id, branch, worktree_path, base_commit, result_commit,
        changed_files_json, artifact_refs_json, resource_hashes_json, definition_hashes_json,
        validation_summary_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.productSnapshotId, input.environmentRunId, input.branch, input.worktreePath,
      input.baseCommit, input.resultCommit, JSON.stringify(input.changedFiles), JSON.stringify(input.artifactRefs),
      JSON.stringify(input.resourceHashes), JSON.stringify(input.definitionHashes),
      JSON.stringify(input.validationSummary), input.createdAt, input.createdAt);
  }

  requireByRun(environmentRunId: string): Record<string, unknown> {
    const row = this.connection().prepare("SELECT * FROM product_snapshots WHERE environment_run_id = ?")
      .get(environmentRunId);
    if (!row) throw new VNextNotFoundError(`Environment Run ${environmentRunId} has no Product Snapshot.`);
    return row as Record<string, unknown>;
  }
}
