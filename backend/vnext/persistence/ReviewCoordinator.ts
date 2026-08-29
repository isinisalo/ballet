import type Database from "better-sqlite3";
import type {
  CriticDueSeed, CriticProposalSeed, FeedbackSeed, HumanDecision,
  RefinementApplySeed, RefinementProposalSeed, RefinementRunSeed
} from "../../../shared/vnext/index.js";
import { ControlFlowStore } from "./ControlFlowStore.js";
import { EnvironmentRunStore } from "./EnvironmentRunStore.js";
import { FeedbackStore } from "./FeedbackStore.js";
import { ReviewStore } from "./ReviewStore.js";
import { VNextConflictError } from "./VNextErrors.js";

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
    this.reviews.createCriticProposal(input);
  }

  decideCritic(criticProposalId: string, decision: HumanDecision, feedback?: FeedbackSeed): void {
    this.connection().transaction(() => {
      const proposal = this.reviews.requireCriticProposal(criticProposalId);
      this.reviews.decideCritic(criticProposalId, decision);
      if (decision.decision === "rejected") {
        if (feedback) throw new VNextConflictError("Rejected Critic Proposal cannot create Feedback.");
        return;
      }
      if (!feedback || feedback.source !== "approved_critic_proposal" || feedback.criticProposalId !== criticProposalId) {
        throw new VNextConflictError("Approved Critic Proposal requires exactly bound Feedback.");
      }
      if (feedback.targetType !== proposal.target_type || feedback.targetId !== proposal.target_id) {
        throw new VNextConflictError("Critic Feedback target differs from its Proposal.");
      }
      this.feedback.create(feedback);
    })();
  }

  createRefinementRun(input: RefinementRunSeed): void {
    this.reviews.createRefinementRun(input);
  }

  createRefinementProposal(input: RefinementProposalSeed): void {
    this.reviews.createRefinementProposal(input);
  }

  decideRefinement(refinementProposalId: string, decision: HumanDecision): void {
    this.connection().transaction(() => this.reviews.decideRefinement(refinementProposalId, decision))();
  }

  recordApply(input: RefinementApplySeed): "stale" | "applied" | "failed" {
    return this.connection().transaction(() => {
      const proposal = this.reviews.requireRefinementProposal(input.refinementProposalId);
      if (proposal.status !== "approved") throw new VNextConflictError("Only an approved Refinement Proposal can be applied.");
      const files = this.reviews.refinementFiles(input.refinementProposalId);
      const stale = files.some((file) => (
        input.observedPreimageHashes[String(file.relative_path)] !== file.expected_preimage_hash
      ));
      if (stale) {
        this.connection().prepare(`
          UPDATE refinement_proposals SET status = 'stale', updated_at = ?
          WHERE refinement_proposal_id = ? AND status = 'approved'
        `).run(input.completedAt, input.refinementProposalId);
        return "stale";
      }
      this.reviews.recordApply(input);
      if (input.status === "failed") {
        if (input.continuation) throw new VNextConflictError("Failed Refinement apply cannot create a continuation.");
        return "failed";
      }
      if (!input.continuation || !input.commitSha) {
        throw new VNextConflictError("Applied Refinement requires a commit and continuation Environment Run.");
      }
      const source = readSource(this.connection(), input.refinementProposalId);
      const continuation = input.continuation;
      if (continuation.source !== "continuation" || continuation.previousRunId !== source.environmentRunId
        || continuation.baseCommit !== input.commitSha
        || continuation.continuationSnapshotHash !== continuation.executionSnapshotHash) {
        throw new VNextConflictError("Continuation identity does not match the immutable Refinement result.");
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
      this.events.append(source.environmentRunId, "continuation_created", {
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
  if (typeof row !== "object" || row === null) throw new VNextConflictError("Refinement source Run is missing.");
  return {
    environmentRunId: String(Reflect.get(row, "source_environment_run_id")),
    snapshotHash: String(Reflect.get(row, "execution_snapshot_hash"))
  };
};
