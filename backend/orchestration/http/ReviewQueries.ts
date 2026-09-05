import type Database from "better-sqlite3";
import type { CriticProposalSummary } from "../../../shared/orchestration/httpResponses.js";
import { refinementPreimages } from "./RefinementPreimages.js";
import { ReviewStore } from "../persistence/ReviewStore.js";
import { ConflictError, NotFoundError } from "../persistence/PersistenceErrors.js";

export class ReviewQueries {
  private readonly reviewStore: ReviewStore;
  constructor(private readonly connection: () => Database.Database, private readonly projectRoot: string) {
    this.reviewStore = new ReviewStore(connection);
  }
  listCritic(kind: "schedules" | "runs"): unknown[] {
    const queries = {
      schedules: "SELECT critic_schedule_id, enabled, next_due_at, updated_at FROM critic_schedules ORDER BY critic_schedule_id",
      runs: "SELECT critic_run_id, critic_schedule_id, due_at, status, skip_reason, created_at, updated_at FROM critic_runs ORDER BY created_at DESC LIMIT 200"
    };
    return this.connection().prepare(queries[kind]).all() as unknown[];
  }
  criticProposals(): CriticProposalSummary[] {
    return this.connection().prepare(`
      SELECT critic_proposal_id, critic_run_id, content_hash, target_type, target_id,
        category, status, version, created_at, updated_at,
        COALESCE(json_extract(content_json, '$.title'), 'Critic finding') AS title,
        COALESCE(json_extract(content_json, '$.finding'), '') AS finding,
        COALESCE(json_extract(content_json, '$.severity'), 'unknown') AS severity
      FROM critic_proposals ORDER BY created_at DESC LIMIT 200
    `).all() as CriticProposalSummary[];
  }
  criticProposal(id: string): unknown { return this.reviewStore.requireCriticProposal(id); }
  listRefinement(kind: "runs" | "proposals"): unknown[] {
    const query = kind === "runs"
      ? "SELECT refinement_run_id, source_environment_run_id, status, created_at, updated_at FROM refinement_runs ORDER BY created_at DESC LIMIT 200"
      : "SELECT refinement_proposal_id, refinement_run_id, target_action_id, change_list_hash, impact_scope_json, status, version, created_at, updated_at FROM refinement_proposals ORDER BY created_at DESC LIMIT 200";
    return this.connection().prepare(query).all() as unknown[];
  }
  async refinementProposal(id: string): Promise<unknown> {
    const proposal = this.reviewStore.requireRefinementProposal(id);
    const row = this.connection().prepare(`
      SELECT er.execution_snapshot_json FROM refinement_runs rr
      JOIN environment_runs er ON er.environment_run_id = rr.source_environment_run_id
      WHERE rr.refinement_run_id = ?
    `).get(proposal.refinement_run_id) as { execution_snapshot_json: string } | undefined;
    if (!row) throw new ConflictError("Refinement proposal has no immutable source snapshot.");
    const snapshot = JSON.parse(row.execution_snapshot_json) as {
      resources?: Array<{ relativePath: string; content: string }>;
    };
    const files = await refinementPreimages(this.projectRoot, String(proposal.expected_base_commit),
      snapshot.resources ?? [], this.reviewStore.refinementFiles(id));
    return { ...proposal, files };
  }
  refinementApplyStatus(id: string): unknown {
    const row = this.connection().prepare(
      "SELECT * FROM refinement_applies WHERE refinement_proposal_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(id);
    if (!row) throw new NotFoundError(`Refinement apply for ${id} was not found.`);
    return row;
  }
  continuation(id: string): unknown {
    const row = this.connection().prepare(`
      SELECT cl.* FROM continuation_links cl JOIN refinement_applies ra ON ra.refinement_apply_id = cl.refinement_apply_id
      WHERE ra.refinement_proposal_id = ? ORDER BY cl.created_at DESC LIMIT 1
    `).get(id);
    if (!row) throw new NotFoundError(`Continuation for ${id} was not found.`);
    return row;
  }
}
