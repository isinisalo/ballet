import type Database from "better-sqlite3";
import type { FeedbackSeed } from "../../../shared/vnext/persistence.js";
import { VNextConflictError, VNextNotFoundError } from "./VNextErrors.js";

export class FeedbackStore {
  constructor(private readonly connection: () => Database.Database) {}

  create(input: FeedbackSeed): void {
    if (input.correctiveActions.length === 0) throw new VNextConflictError("Feedback requires corrective actions.");
    this.connection().prepare(`
      INSERT INTO feedback_entries (
        feedback_entry_id, source, category, target_type, target_id, status, title, description,
        corrective_actions_json, evidence_refs_json, created_by, environment_run_id,
        state_execution_id, action_execution_id, agent_run_id, critic_proposal_id,
        refinement_proposal_id, continuation_run_id, approval_json, provenance_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.feedbackEntryId, input.source, input.category, input.targetType, input.targetId,
      input.title, input.description, JSON.stringify(input.correctiveActions), JSON.stringify(input.evidenceRefs ?? []),
      input.createdBy ?? null, input.environmentRunId,
      input.stateExecutionId ?? null, input.actionExecutionId ?? null, input.agentRunId ?? null,
      input.criticProposalId ?? null, input.refinementProposalId ?? null, input.continuationRunId ?? null,
      input.approval === undefined ? null : JSON.stringify(input.approval),
      JSON.stringify(input.provenance), input.createdAt, input.createdAt);
  }

  require(feedbackEntryId: string): Record<string, unknown> {
    const row = this.connection().prepare("SELECT * FROM feedback_entries WHERE feedback_entry_id = ?")
      .get(feedbackEntryId);
    if (!row) throw new VNextNotFoundError(`Feedback ${feedbackEntryId} was not found.`);
    return row as Record<string, unknown>;
  }

  list(environmentRunId: string): Array<Record<string, unknown>> {
    return this.connection().prepare(`
      SELECT * FROM feedback_entries WHERE environment_run_id = ? ORDER BY created_at, rowid
    `).all(environmentRunId) as Array<Record<string, unknown>>;
  }

  transition(input: {
    feedbackEntryId: string; from: "open" | "in_refinement";
    to: "open" | "in_refinement" | "resolved" | "dismissed";
    actorId?: string; refinementProposalId?: string; continuationRunId?: string; at: string;
  }): void {
    this.connection().transaction(() => {
      const terminalColumn = input.to === "resolved" ? "resolved_at" : input.to === "dismissed" ? "dismissed_at" : undefined;
      const updated = this.connection().prepare(`
        UPDATE feedback_entries SET status = ?, refinement_proposal_id = COALESCE(?, refinement_proposal_id),
          continuation_run_id = COALESCE(?, continuation_run_id), updated_at = ?
          ${terminalColumn ? `, ${terminalColumn} = ?` : ""}
        WHERE feedback_entry_id = ? AND status = ?
      `).run(input.to, input.refinementProposalId ?? null, input.continuationRunId ?? null, input.at,
        ...(terminalColumn ? [input.at] : []), input.feedbackEntryId, input.from);
      if (updated.changes !== 1) throw new VNextConflictError(`Feedback ${input.feedbackEntryId} status changed or is terminal.`);
      const actorType = input.actorId ? "human" : input.continuationRunId ? "continuation" : "refinement";
      const actorId = input.actorId ?? input.continuationRunId ?? input.refinementProposalId;
      if (!actorId) throw new VNextConflictError("Feedback transition requires trusted provenance.");
      this.connection().prepare(`
        INSERT INTO feedback_status_events (
          feedback_entry_id, from_status, to_status, actor_type, actor_id,
          refinement_proposal_id, continuation_run_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(input.feedbackEntryId, input.from, input.to, actorType, actorId,
        input.refinementProposalId ?? null, input.continuationRunId ?? null, input.at);
    })();
  }
}
