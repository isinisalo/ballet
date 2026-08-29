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
        corrective_actions_json, environment_run_id, state_execution_id, action_execution_id,
        agent_run_id, critic_proposal_id, approval_json, provenance_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.feedbackEntryId, input.source, input.category, input.targetType, input.targetId,
      input.title, input.description, JSON.stringify(input.correctiveActions), input.environmentRunId,
      input.stateExecutionId ?? null, input.actionExecutionId ?? null, input.agentRunId ?? null,
      input.criticProposalId ?? null, input.approval === undefined ? null : JSON.stringify(input.approval),
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
}
