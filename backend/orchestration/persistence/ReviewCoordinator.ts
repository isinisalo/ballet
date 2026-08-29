import type Database from "better-sqlite3";
import type {
  CriticDueSeed, CriticProposalSeed, FeedbackSeed, HumanDecision,
  RefinementApplySeed, RefinementDecision, RefinementProposalSeed, RefinementRunSeed, TrustedHumanActor
} from "../../../shared/orchestration/index.js";
import { ControlFlowStore } from "./ControlFlowStore.js";
import { EnvironmentRunStore } from "./EnvironmentRunStore.js";
import { FeedbackStore } from "./FeedbackStore.js";
import { ReviewStore } from "./ReviewStore.js";
import { ConflictError } from "./PersistenceErrors.js";
import { validateFeedbackTarget } from "../governance/FeedbackBoxService.js";
import { assertCompleteRefinementImpact } from "../governance/RefinementImpactResolver.js";

export class ReviewCoordinator {
  constructor(
    private readonly connection: () => Database.Database,
    readonly reviews = new ReviewStore(connection),
    private readonly feedback = new FeedbackStore(connection),
    private readonly runs = new EnvironmentRunStore(connection),
    private readonly events = new ControlFlowStore(connection)
  ) {}

  createCriticDue(input: CriticDueSeed): string {
    return this.reviews.createCriticDue(input);
  }

  createCriticProposal(input: CriticProposalSeed): void {
    const owner = this.connection().prepare(`
      SELECT ps.environment_run_id FROM critic_runs cr
      JOIN run_evidences ps ON ps.run_evidence_id = cr.run_evidence_id
      WHERE cr.critic_run_id = ?
    `).get(input.criticRunId) as { environment_run_id: string } | undefined;
    if (!owner) throw new ConflictError("Critic Proposal has no immutable Run Evidence owner.");
    validateFeedbackTarget(this.connection(), owner.environment_run_id, input.targetType, input.targetId);
    this.reviews.createCriticProposal(input);
  }

  decideCritic(
    criticProposalId: string, decision: HumanDecision, actor: TrustedHumanActor, feedback?: FeedbackSeed
  ): void {
    this.connection().transaction(() => {
      const proposal = this.reviews.requireCriticProposal(criticProposalId);
      this.reviews.decideCritic(criticProposalId, decision, actor);
      if (decision.decision === "rejected") {
        if (feedback) throw new ConflictError("Rejected Critic Proposal cannot create Feedback.");
        return;
      }
      if (!feedback || feedback.source !== "approved_critic_proposal" || feedback.criticProposalId !== criticProposalId) {
        throw new ConflictError("Approved Critic Proposal requires exactly bound Feedback.");
      }
      if (feedback.targetType !== proposal.target_type || feedback.targetId !== proposal.target_id) {
        throw new ConflictError("Critic Feedback target differs from its Proposal.");
      }
      const owner = this.connection().prepare(`
        SELECT ps.environment_run_id FROM critic_proposals cp
        JOIN critic_runs cr ON cr.critic_run_id = cp.critic_run_id
        JOIN run_evidences ps ON ps.run_evidence_id = cr.run_evidence_id
        WHERE cp.critic_proposal_id = ?
      `).get(criticProposalId) as { environment_run_id: string } | undefined;
      if (!owner || owner.environment_run_id !== feedback.environmentRunId) {
        throw new ConflictError("Critic Feedback must belong to the Proposal Run Evidence Run.");
      }
      validateFeedbackTarget(this.connection(), feedback.environmentRunId, feedback.targetType, feedback.targetId);
      this.feedback.create({
        ...feedback,
        approval: { proposalId: criticProposalId, contentHash: decision.expectedContentHash, actorId: actor.id, decidedAt: decision.decidedAt },
        createdBy: actor.id,
        provenance: { criticProposalId, actor: { id: actor.id, source: actor.source }, evidence: feedback.provenance }
      });
    })();
  }

  createRefinementRun(input: RefinementRunSeed): void {
    this.reviews.createRefinementRun(input);
  }

  createRefinementProposal(input: RefinementProposalSeed): void {
    const source = this.connection().prepare(`
      SELECT er.execution_snapshot_json FROM refinement_runs rr
      JOIN environment_runs er ON er.environment_run_id = rr.source_environment_run_id
      WHERE rr.refinement_run_id = ?
    `).get(input.refinementRunId) as { execution_snapshot_json: string } | undefined;
    if (!source) throw new ConflictError("Refinement source snapshot is missing.");
    const snapshot = JSON.parse(source.execution_snapshot_json) as { environment: Parameters<typeof assertCompleteRefinementImpact>[0] };
    assertCompleteRefinementImpact(snapshot.environment, input);
    this.connection().transaction(() => {
      this.reviews.createRefinementProposal(input);
      this.connection().prepare(`
        UPDATE feedback_entries SET refinement_proposal_id = ?, updated_at = ?
        WHERE feedback_entry_id IN (
          SELECT feedback_entry_id FROM refinement_run_feedback WHERE refinement_run_id = ?
        ) AND status = 'in_refinement'
      `).run(input.refinementProposalId, input.createdAt, input.refinementRunId);
    })();
  }

  decideRefinement(refinementProposalId: string, decision: RefinementDecision, actor: TrustedHumanActor): void {
    this.connection().transaction(() => this.reviews.decideRefinement(refinementProposalId, decision, actor))();
  }

  recordApply(input: RefinementApplySeed): "stale" | "applied" | "apply_failed" {
    return this.connection().transaction(() => {
      const proposal = this.reviews.requireRefinementProposal(input.refinementProposalId);
      if (proposal.status !== "applying") throw new ConflictError("Only an approved applying Refinement Proposal can be applied.");
      const files = this.reviews.refinementFiles(input.refinementProposalId);
      const stale = input.status === "applied" && files.some((file) => (
        input.observedPreimageHashes[String(file.relative_path)] !== file.expected_preimage_hash
      ));
      if (stale) {
        this.reviews.recordStaleApply(input.refinementApplyId, input.refinementProposalId, input.completedAt);
        return "stale";
      }
      this.reviews.recordApply(input);
      if (input.status === "apply_failed") {
        if (input.continuation) throw new ConflictError("Failed Refinement apply cannot create a continuation.");
        return "apply_failed";
      }
      if (!input.continuation || !input.commitSha) {
        throw new ConflictError("Applied Refinement requires a commit and continuation Environment Run.");
      }
      const source = readSource(this.connection(), input.refinementProposalId);
      const continuation = input.continuation;
      if (continuation.source !== "continuation" || continuation.previousRunId !== source.environmentRunId
        || continuation.baseCommit !== input.commitSha
        || continuation.continuationSnapshotHash !== continuation.executionSnapshotHash) {
        throw new ConflictError("Continuation identity does not match the immutable Refinement result.");
      }
      this.runs.create(continuation);
      this.reviews.recordContinuation({
        continuationLinkId: continuation.continuationLinkId,
        sourceRunId: source.environmentRunId,
        continuationRunId: continuation.environmentRunId,
        refinementApplyId: input.refinementApplyId,
        sourceSnapshotHash: source.snapshotHash,
        continuationSnapshotHash: continuation.continuationSnapshotHash,
        createdAt: input.completedAt
      });
      this.events.append(continuation.environmentRunId, "continuation_created", {
        data: { continuationRunId: continuation.environmentRunId, refinementApplyId: input.refinementApplyId }
      }, input.completedAt);
      return "applied";
    })();
  }
}

const readSource = (connection: Database.Database, refinementProposalId: string): {
  environmentRunId: string; snapshotHash: string;
} => {
  const row = connection.prepare(`
    SELECT rr.source_environment_run_id, er.execution_snapshot_hash
    FROM refinement_proposals rp
    JOIN refinement_runs rr ON rr.refinement_run_id = rp.refinement_run_id
    JOIN environment_runs er ON er.environment_run_id = rr.source_environment_run_id
    WHERE rp.refinement_proposal_id = ?
  `).get(refinementProposalId);
  if (typeof row !== "object" || row === null) throw new ConflictError("Refinement source Run is missing.");
  return {
    environmentRunId: String(Reflect.get(row, "source_environment_run_id")),
    snapshotHash: String(Reflect.get(row, "execution_snapshot_hash"))
  };
};
