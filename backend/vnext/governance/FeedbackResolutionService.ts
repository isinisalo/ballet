import type Database from "better-sqlite3";
import { FeedbackStore } from "../persistence/FeedbackStore.js";

export class FeedbackResolutionService {
  private readonly feedback: FeedbackStore;
  constructor(private readonly connection: () => Database.Database) {
    this.feedback = new FeedbackStore(connection);
  }

  reconcileContinuation(continuationRunId: string, at: string): "resolved" | "reopened" | "pending" {
    const run = this.connection().prepare("SELECT status FROM environment_runs WHERE environment_run_id = ?")
      .get(continuationRunId) as { status: string } | undefined;
    if (!run || !["completed", "blocked"].includes(run.status)) return "pending";
    const rows = this.connection().prepare(`
      SELECT rrf.feedback_entry_id, fe.status, rp.refinement_proposal_id
      FROM continuation_links cl
      JOIN refinement_applies ra ON ra.refinement_apply_id = cl.refinement_apply_id
      JOIN refinement_proposals rp ON rp.refinement_proposal_id = ra.refinement_proposal_id
      JOIN refinement_run_feedback rrf ON rrf.refinement_run_id = rp.refinement_run_id
      JOIN feedback_entries fe ON fe.feedback_entry_id = rrf.feedback_entry_id
      WHERE cl.continuation_run_id = ?
    `).all(continuationRunId) as Array<{ feedback_entry_id: string; status: string; refinement_proposal_id: string }>;
    for (const row of rows) {
      if (row.status !== "in_refinement") continue;
      this.feedback.transition({
        feedbackEntryId: row.feedback_entry_id, from: "in_refinement",
        to: run.status === "completed" ? "resolved" : "open",
        refinementProposalId: row.refinement_proposal_id, continuationRunId, at
      });
    }
    return run.status === "completed" ? "resolved" : "reopened";
  }
}
