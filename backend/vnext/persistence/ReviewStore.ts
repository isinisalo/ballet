import type Database from "better-sqlite3";
import type {
  CriticDueSeed, CriticProposalSeed, CriticScheduleSeed, HumanDecision,
  JsonValue, RefinementApplySeed, RefinementProposalSeed, RefinementRunSeed
} from "../../../shared/vnext/index.js";
import { canonicalJson, sha256 } from "../../../shared/vnext/primitives.js";
import { isAllowedRefinementPath } from "../../../shared/vnext/refinement.js";
import { VNextConflictError, VNextNotFoundError } from "./VNextErrors.js";

export class ReviewStore {
  constructor(private readonly connection: () => Database.Database) {}

  createSchedule(input: CriticScheduleSeed): void {
    this.connection().prepare(`
      INSERT INTO critic_schedules (
        critic_schedule_id, config_hash, next_due_at, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(input.criticScheduleId, input.configHash, input.nextDueAt, input.enabled ? 1 : 0,
      input.createdAt, input.createdAt);
  }

  createCriticDue(input: CriticDueSeed): string {
    return this.connection().transaction(() => {
      const existing = this.connection().prepare(`
        SELECT critic_run_id FROM critic_runs
        WHERE critic_schedule_id = ? AND (due_at = ? OR due_key = ?)
      `).get(input.criticScheduleId, input.dueAt, input.dueKey);
      if (existing) return readString(existing, "critic_run_id");
      const schedule = this.connection().prepare(`
        SELECT enabled FROM critic_schedules WHERE critic_schedule_id = ?
      `).get(input.criticScheduleId);
      if (!schedule) throw new VNextNotFoundError(`Critic Schedule ${input.criticScheduleId} was not found.`);
      if (readInteger(schedule, "enabled") !== 1) throw new VNextConflictError("Disabled Critic Schedule cannot create a due run.");
      this.connection().prepare(`
        INSERT INTO critic_runs (
          critic_run_id, critic_schedule_id, due_at, due_key, product_snapshot_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)
      `).run(input.criticRunId, input.criticScheduleId, input.dueAt, input.dueKey,
        input.productSnapshotId, input.createdAt, input.createdAt);
      this.connection().prepare(`
        UPDATE critic_schedules SET last_due_at = ?, last_run_id = ?, revision = revision + 1, updated_at = ?
        WHERE critic_schedule_id = ?
      `).run(input.dueAt, input.criticRunId, input.createdAt, input.criticScheduleId);
      return input.criticRunId;
    })();
  }

  createCriticProposal(input: CriticProposalSeed): void {
    assertHash(input.content, input.contentHash, "Critic proposal");
    this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO critic_proposals (
          critic_proposal_id, critic_run_id, content_json, content_hash,
          target_type, target_id, category, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?)
      `).run(input.criticProposalId, input.criticRunId, canonical(input.content), input.contentHash,
        input.targetType, input.targetId, input.category, input.createdAt, input.createdAt);
      this.connection().prepare(`
        UPDATE critic_runs SET status = 'completed', completed_at = ?, updated_at = ?
        WHERE critic_run_id = ? AND status IN ('queued','running')
      `).run(input.createdAt, input.createdAt, input.criticRunId);
    })();
  }

  decideCritic(criticProposalId: string, input: HumanDecision): void {
    const proposal = this.requireCriticProposal(criticProposalId);
    if (proposal.status !== "pending_approval") throw new VNextConflictError(`Critic Proposal ${criticProposalId} was already decided.`);
    if (proposal.content_hash !== input.expectedContentHash) throw new VNextConflictError("Critic Proposal content hash is stale.");
    this.connection().prepare(`
      INSERT INTO critic_proposal_decisions (
        critic_proposal_id, decision, expected_content_hash, decided_by, decided_at, rationale
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(criticProposalId, input.decision, input.expectedContentHash,
      input.decidedBy, input.decidedAt, input.rationale ?? null);
    this.connection().prepare(`
      UPDATE critic_proposals SET status = ?, updated_at = ?
      WHERE critic_proposal_id = ? AND status = 'pending_approval'
    `).run(input.decision, input.decidedAt, criticProposalId);
  }

  createRefinementRun(input: RefinementRunSeed): void {
    if (input.feedbackEntryIds.length === 0) throw new VNextConflictError("Refinement Run requires selected Feedback.");
    this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO refinement_runs (
          refinement_run_id, source_environment_run_id, status, created_at, updated_at
        ) VALUES (?, ?, 'queued', ?, ?)
      `).run(input.refinementRunId, input.sourceEnvironmentRunId, input.createdAt, input.createdAt);
      for (const feedbackEntryId of new Set(input.feedbackEntryIds)) {
        const feedback = this.connection().prepare("SELECT status FROM feedback_entries WHERE feedback_entry_id = ?")
          .get(feedbackEntryId);
        if (!feedback || readString(feedback, "status") !== "open") {
          throw new VNextConflictError(`Refinement requires open Feedback ${feedbackEntryId}.`);
        }
        this.connection().prepare(`
          INSERT INTO refinement_run_feedback (refinement_run_id, feedback_entry_id) VALUES (?, ?)
        `).run(input.refinementRunId, feedbackEntryId);
      }
    })();
  }

  createRefinementProposal(input: RefinementProposalSeed): void {
    if (input.files.length === 0) throw new VNextConflictError("Refinement Proposal requires a file change.");
    const expectedHash = refinementChangeListHash(input);
    if (expectedHash !== input.changeListHash) throw new VNextConflictError("Refinement change-list hash does not match.");
    this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO refinement_proposals (
          refinement_proposal_id, refinement_run_id, target_action_id, impact_scope_json,
          change_list_hash, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending_approval', ?, ?)
      `).run(input.refinementProposalId, input.refinementRunId, input.targetActionId,
        canonical(input.impactScope), input.changeListHash, input.createdAt, input.createdAt);
      for (const file of input.files) {
        if (!isAllowedRefinementPath(file.relativePath) || sha256(file.proposedContent) !== file.proposedContentHash) {
          throw new VNextConflictError(`Refinement file ${file.relativePath} is unsafe or has a mismatched hash.`);
        }
        this.connection().prepare(`
          INSERT INTO refinement_proposal_files (
            refinement_proposal_id, relative_path, expected_preimage_hash,
            proposed_content_hash, proposed_content, resource_id
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(input.refinementProposalId, file.relativePath, file.expectedPreimageHash,
          file.proposedContentHash, file.proposedContent, file.resourceId ?? null);
      }
      this.connection().prepare(`
        UPDATE refinement_runs SET status = 'completed', completed_at = ?, updated_at = ?
        WHERE refinement_run_id = ? AND status IN ('queued','running')
      `).run(input.createdAt, input.createdAt, input.refinementRunId);
    })();
  }

  decideRefinement(refinementProposalId: string, input: HumanDecision): void {
    const proposal = this.requireRefinementProposal(refinementProposalId);
    if (proposal.status !== "pending_approval") throw new VNextConflictError(`Refinement Proposal ${refinementProposalId} was already decided.`);
    if (proposal.change_list_hash !== input.expectedContentHash) throw new VNextConflictError("Refinement Proposal hash is stale.");
    this.connection().prepare(`
      INSERT INTO refinement_proposal_decisions (
        refinement_proposal_id, decision, expected_change_list_hash, decided_by, decided_at, rationale
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(refinementProposalId, input.decision, input.expectedContentHash,
      input.decidedBy, input.decidedAt, input.rationale ?? null);
    this.connection().prepare(`
      UPDATE refinement_proposals SET status = ?, updated_at = ?
      WHERE refinement_proposal_id = ? AND status = 'pending_approval'
    `).run(input.decision, input.decidedAt, refinementProposalId);
  }

  recordApply(input: RefinementApplySeed): void {
    this.connection().prepare(`
      INSERT INTO refinement_applies (
        refinement_apply_id, refinement_proposal_id, status, worktree_path, branch,
        commit_sha, error_message, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.refinementApplyId, input.refinementProposalId, input.status, input.worktreePath,
      input.branch, input.commitSha ?? null, input.errorMessage ?? null, input.completedAt, input.completedAt);
    this.connection().prepare(`
      UPDATE refinement_proposals SET status = ?, updated_at = ?
      WHERE refinement_proposal_id = ? AND status = 'approved'
    `).run(input.status, input.completedAt, input.refinementProposalId);
  }

  recordContinuation(input: {
    continuationLinkId: string; sourceRunId: string; continuationRunId: string;
    refinementApplyId: string; sourceSnapshotHash: string; continuationSnapshotHash: string; createdAt: string;
  }): void {
    if (this.wouldCreateContinuationCycle(input.sourceRunId, input.continuationRunId)) {
      throw new VNextConflictError("Continuation link would create a cycle.");
    }
    this.connection().prepare(`
      INSERT INTO continuation_links (
        continuation_link_id, source_run_id, continuation_run_id, refinement_apply_id,
        source_snapshot_hash, continuation_snapshot_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(input.continuationLinkId, input.sourceRunId, input.continuationRunId, input.refinementApplyId,
      input.sourceSnapshotHash, input.continuationSnapshotHash, input.createdAt);
  }

  requireCriticProposal(id: string): Record<string, unknown> {
    return this.requireRow("critic_proposals", "critic_proposal_id", id);
  }

  requireRefinementProposal(id: string): Record<string, unknown> {
    return this.requireRow("refinement_proposals", "refinement_proposal_id", id);
  }

  refinementFiles(id: string): Array<Record<string, unknown>> {
    return this.connection().prepare(`
      SELECT * FROM refinement_proposal_files WHERE refinement_proposal_id = ? ORDER BY relative_path
    `).all(id) as Array<Record<string, unknown>>;
  }

  private requireRow(table: string, key: string, id: string): Record<string, unknown> {
    const allowed = new Set(["critic_proposals:critic_proposal_id", "refinement_proposals:refinement_proposal_id"]);
    if (!allowed.has(`${table}:${key}`)) throw new Error("Invalid review row selector.");
    const row = this.connection().prepare(`SELECT * FROM ${table} WHERE ${key} = ?`).get(id);
    if (!row) throw new VNextNotFoundError(`${id} was not found.`);
    return row as Record<string, unknown>;
  }

  private wouldCreateContinuationCycle(sourceRunId: string, continuationRunId: string): boolean {
    if (sourceRunId === continuationRunId) return true;
    const row = this.connection().prepare(`
      WITH RECURSIVE descendants(run_id) AS (
        SELECT continuation_run_id FROM continuation_links WHERE source_run_id = ?
        UNION SELECT continuation_links.continuation_run_id FROM continuation_links
          JOIN descendants ON continuation_links.source_run_id = descendants.run_id
      ) SELECT 1 AS found FROM descendants WHERE run_id = ? LIMIT 1
    `).get(continuationRunId, sourceRunId);
    return Boolean(row);
  }
}

export const refinementChangeListHash = (input: RefinementProposalSeed): string => sha256(canonical({
  targetActionId: input.targetActionId,
  impactScope: input.impactScope,
  files: [...input.files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}));

const canonical = (value: unknown): string => canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue);
const assertHash = (value: JsonValue, expected: string, label: string): void => {
  if (sha256(canonical(value)) !== expected) throw new VNextConflictError(`${label} hash does not match.`);
};
const readString = (row: unknown, key: string): string => {
  const value = typeof row === "object" && row !== null ? Reflect.get(row, key) : undefined;
  if (typeof value !== "string") throw new Error(`SQLite returned invalid ${key}.`);
  return value;
};
const readInteger = (row: unknown, key: string): number => {
  const value = typeof row === "object" && row !== null ? Reflect.get(row, key) : undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`SQLite returned invalid ${key}.`);
  return value;
};
