import type {
  CriticProposalSeed, HumanDecision, RefinementApplySeed, RefinementDecision, RefinementProposalSeed, RefinementRunSeed,
  TrustedHumanActor
} from "../../../shared/orchestration/index.js";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import { isAllowedRefinementPath } from "../../../shared/orchestration/refinement.js";
import { ConflictError, NotFoundError } from "./PersistenceErrors.js";
import {
  assertReviewHash as assertHash, canonicalReviewValue as canonical, impactActionIds,
  readReviewString as readString, refinementChangeListHash
} from "./ReviewIntegrity.js";
import { CriticScheduleStore } from "./CriticScheduleStore.js";

export { refinementChangeListHash } from "./ReviewIntegrity.js";

export class ReviewStore extends CriticScheduleStore {

  createCriticProposal(input: CriticProposalSeed): void {
    assertHash(input.content, input.contentHash, "Critic proposal");
    this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO critic_proposals (
          critic_proposal_id, critic_run_id, content_json, content_hash,
          target_type, target_id, category, status, created_at, updated_at
          ,version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_human_review', ?, ?, 1)
      `).run(input.criticProposalId, input.criticRunId, canonical(input.content), input.contentHash,
        input.targetType, input.targetId, input.category, input.createdAt, input.createdAt);
      this.connection().prepare(`
        UPDATE critic_runs SET status = 'completed', completed_at = ?, updated_at = ?
        WHERE critic_run_id = ? AND status IN ('queued','running')
      `).run(input.createdAt, input.createdAt, input.criticRunId);
    })();
  }

  decideCritic(criticProposalId: string, input: HumanDecision, actor: TrustedHumanActor): void {
    const proposal = this.requireCriticProposal(criticProposalId);
    if (proposal.status !== "pending_human_review") throw new ConflictError(`Critic Proposal ${criticProposalId} was already decided.`);
    if (proposal.content_hash !== input.expectedContentHash || proposal.version !== input.expectedVersion) {
      throw new ConflictError("Critic Proposal content hash or version is stale.");
    }
    this.connection().prepare(`
      INSERT INTO critic_proposal_decisions (
        critic_proposal_id, decision, expected_content_hash, expected_version, decided_by, decided_at, rationale
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(criticProposalId, input.decision, input.expectedContentHash, input.expectedVersion,
      actor.id, input.decidedAt, input.rationale ?? null);
    this.connection().prepare(`
      UPDATE critic_proposals SET status = ?, updated_at = ?
      WHERE critic_proposal_id = ? AND status = 'pending_human_review'
    `).run(input.decision, input.decidedAt, criticProposalId);
  }

  createRefinementRun(input: RefinementRunSeed): void {
    if (input.feedbackEntryIds.length === 0) throw new ConflictError("Refinement Run requires selected Feedback.");
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
          throw new ConflictError(`Refinement requires open Feedback ${feedbackEntryId}.`);
        }
        this.connection().prepare(`
          INSERT INTO refinement_run_feedback (refinement_run_id, feedback_entry_id) VALUES (?, ?)
        `).run(input.refinementRunId, feedbackEntryId);
        this.connection().prepare(`
          UPDATE feedback_entries SET status = 'in_refinement', updated_at = ?
          WHERE feedback_entry_id = ? AND status = 'open'
        `).run(input.createdAt, feedbackEntryId);
        this.connection().prepare(`
          INSERT INTO feedback_status_events (
            feedback_entry_id, from_status, to_status, actor_type, actor_id, created_at
          ) VALUES (?, 'open', 'in_refinement', 'refinement', ?, ?)
        `).run(feedbackEntryId, input.refinementRunId, input.createdAt);
      }
    })();
  }

  createRefinementProposal(input: RefinementProposalSeed): void {
    if (input.files.length === 0) throw new ConflictError("Refinement Proposal requires a file change.");
    if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(input.expectedBaseCommit)) {
      throw new ConflictError("Refinement Proposal expected base commit is invalid.");
    }
    const allowedValidations = new Set(["instruction_contract", "resource_contract", "relevant_tests"]);
    if (input.validationPlan.length === 0 || input.validationPlan.some((id) => !allowedValidations.has(id))) {
      throw new ConflictError("Refinement validation plan contains a non-allowlisted command.");
    }
    const expectedHash = refinementChangeListHash(input);
    if (expectedHash !== input.changeListHash) throw new ConflictError("Refinement change-list hash does not match.");
    this.connection().transaction(() => {
      this.connection().prepare(`
        INSERT INTO refinement_proposals (
          refinement_proposal_id, refinement_run_id, target_action_id, expected_base_commit,
          impact_scope_json, change_list_hash, expected_behavioral_improvement, risks_json,
          validation_plan_json, rollback, version, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending_human_review', ?, ?)
      `).run(input.refinementProposalId, input.refinementRunId, input.targetActionId,
        input.expectedBaseCommit, canonical(input.impactScope), input.changeListHash,
        input.expectedBehavioralImprovement, canonical(input.risks), canonical(input.validationPlan),
        input.rollback, input.createdAt, input.createdAt);
      for (const file of input.files) {
        const validContent = file.operation === "delete"
          ? file.proposedContent === undefined && file.proposedContentHash === "absent"
          : file.proposedContent !== undefined && sha256(file.proposedContent) === file.proposedContentHash;
        if (!isAllowedRefinementPath(file.relativePath) || !validContent
          || (file.operation === "create") !== (file.expectedPreimageHash === "absent")) {
          throw new ConflictError(`Refinement file ${file.relativePath} is unsafe or has a mismatched hash.`);
        }
        this.connection().prepare(`
          INSERT INTO refinement_proposal_files (
            refinement_proposal_id, relative_path, operation, expected_preimage_hash,
            proposed_content_hash, proposed_content, rationale, resource_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(input.refinementProposalId, file.relativePath, file.operation, file.expectedPreimageHash,
          file.proposedContentHash, file.proposedContent ?? null, file.rationale, file.resourceId ?? null);
      }
      this.connection().prepare(`
        UPDATE refinement_runs SET status = 'completed', completed_at = ?, updated_at = ?
        WHERE refinement_run_id = ? AND status IN ('queued','running')
      `).run(input.createdAt, input.createdAt, input.refinementRunId);
    })();
  }

  decideRefinement(refinementProposalId: string, input: RefinementDecision, actor: TrustedHumanActor): void {
    const proposal = this.requireRefinementProposal(refinementProposalId);
    if (proposal.status !== "pending_human_review") throw new ConflictError(`Refinement Proposal ${refinementProposalId} was already decided.`);
    if (proposal.change_list_hash !== input.expectedContentHash || proposal.version !== input.expectedVersion) {
      throw new ConflictError("Refinement Proposal hash or version is stale.");
    }
    const files = this.refinementFiles(refinementProposalId);
    const hashes = files.map((file) => String(file.proposed_content_hash)).sort();
    const impacts = impactActionIds(proposal.impact_scope_json);
    if (canonical(hashes) !== canonical([...input.expectedChangeHashes].sort())
      || canonical(impacts) !== canonical([...input.expectedImpactActionIds].sort())
      || (input.decision === "approved" && !input.acknowledgeLocalCommitAndContinuation)) {
      throw new ConflictError("Refinement approval does not match exact changes, impact, or acknowledgement.");
    }
    this.connection().prepare(`
      INSERT INTO refinement_proposal_decisions (
        refinement_proposal_id, decision, expected_change_list_hash, expected_version,
        expected_change_hashes_json, expected_impact_action_ids_json,
        acknowledged_local_commit_and_continuation, decided_by, decided_at, rationale
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(refinementProposalId, input.decision, input.expectedContentHash, input.expectedVersion,
      canonical([...input.expectedChangeHashes].sort()), canonical([...input.expectedImpactActionIds].sort()),
      input.acknowledgeLocalCommitAndContinuation ? 1 : 0, actor.id, input.decidedAt, input.rationale ?? null);
    this.connection().prepare(`
      UPDATE refinement_proposals SET status = ?, updated_at = ?
      WHERE refinement_proposal_id = ? AND status = 'pending_human_review'
    `).run(input.decision === "approved" ? "applying" : "rejected", input.decidedAt, refinementProposalId);
    if (input.decision === "rejected") {
      this.connection().prepare(`
        INSERT INTO feedback_status_events (
          feedback_entry_id, from_status, to_status, actor_type, actor_id, refinement_proposal_id, created_at
        ) SELECT fe.feedback_entry_id, 'in_refinement', 'open', 'refinement', ?, ?, ?
          FROM feedback_entries fe JOIN refinement_run_feedback rrf ON rrf.feedback_entry_id = fe.feedback_entry_id
          WHERE rrf.refinement_run_id = ? AND fe.status = 'in_refinement'
      `).run(refinementProposalId, refinementProposalId, input.decidedAt, String(proposal.refinement_run_id));
      this.connection().prepare(`
        UPDATE feedback_entries SET status = 'open', updated_at = ? WHERE feedback_entry_id IN (
          SELECT feedback_entry_id FROM refinement_run_feedback WHERE refinement_run_id = ?
        ) AND status = 'in_refinement'
      `).run(input.decidedAt, String(proposal.refinement_run_id));
    }
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
      WHERE refinement_proposal_id = ? AND status = 'applying'
    `).run(input.status, input.completedAt, input.refinementProposalId);
  }

  recordContinuation(input: {
    continuationLinkId: string; sourceRunId: string; continuationRunId: string;
    refinementApplyId: string; sourceSnapshotHash: string; continuationSnapshotHash: string; createdAt: string;
  }): void {
    if (this.wouldCreateContinuationCycle(input.sourceRunId, input.continuationRunId)) {
      throw new ConflictError("Continuation link would create a cycle.");
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

  assertRefinementApplyAuthorized(id: string): void {
    const proposal = this.requireRefinementProposal(id);
    const decision = this.connection().prepare(`
      SELECT * FROM refinement_proposal_decisions WHERE refinement_proposal_id = ?
    `).get(id) as Record<string, unknown> | undefined;
    if (!decision || decision.decision !== "approved" || decision.expected_change_list_hash !== proposal.change_list_hash
      || decision.expected_version !== proposal.version || decision.acknowledged_local_commit_and_continuation !== 1) {
      throw new ConflictError("Refinement apply has no exact operation-specific human authorization.");
    }
    const expectedHashes = JSON.parse(String(decision.expected_change_hashes_json)) as string[];
    const currentHashes = this.refinementFiles(id).map((file) => String(file.proposed_content_hash)).sort();
    const expectedImpacts = JSON.parse(String(decision.expected_impact_action_ids_json)) as string[];
    if (canonical(expectedHashes) !== canonical(currentHashes)
      || canonical(expectedImpacts) !== canonical(impactActionIds(proposal.impact_scope_json))) {
      throw new ConflictError("Approved Refinement changes or impact no longer match.");
    }
  }

  private requireRow(table: string, key: string, id: string): Record<string, unknown> {
    const allowed = new Set(["critic_proposals:critic_proposal_id", "refinement_proposals:refinement_proposal_id"]);
    if (!allowed.has(`${table}:${key}`)) throw new Error("Invalid review row selector.");
    const row = this.connection().prepare(`SELECT * FROM ${table} WHERE ${key} = ?`).get(id);
    if (!row) throw new NotFoundError(`${id} was not found.`);
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
