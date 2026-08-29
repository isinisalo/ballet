import { afterEach, describe, expect, it } from "vitest";
import { sha256 } from "../../../shared/vnext/primitives.js";
import { ActionOutcomeCoordinator } from "./ActionOutcomeCoordinator.js";
import { FeedbackStore } from "./FeedbackStore.js";
import { FlowCoordinator } from "./FlowCoordinator.js";
import {
  HASH_A, TEST_AT, TEST_SHA, agentRunInput, environmentSeed, feedbackSeed, hash,
  openTestDatabase, productSnapshotSeed, validationOutcome, type TestDatabase
} from "./PersistenceTestFixtures.js";
import { ReviewCoordinator } from "./ReviewCoordinator.js";
import { refinementChangeListHash } from "./ReviewStore.js";

const databases: TestDatabase[] = [];
const actor = { id: "human-1", source: "local_operator" as const };
const scheduleConfig = { id: "schedule-1", kind: "daily" as const, timeZone: "Europe/Helsinki", localTimes: ["10:00"] };
afterEach(() => databases.splice(0).forEach(({ cleanup }) => cleanup()));

describe("Critic schedule and human approval", () => {
  it("deduplicates schedule due instants and creates Feedback only after exact approval", () => {
    const context = completedContext();
    context.reviews.reviews.createSchedule({
      criticScheduleId: "schedule-1", configHash: HASH_A, nextDueAt: TEST_AT,
      config: scheduleConfig, enabled: true, createdAt: TEST_AT
    });
    const due = {
      criticRunId: "critic-run-1", criticScheduleId: "schedule-1", dueAt: TEST_AT,
      dueKey: "schedule-1:2026-08-29T10", productSnapshotId: "snapshot-run-1", createdAt: TEST_AT
    };
    expect(context.reviews.createCriticDue(due)).toBe("critic-run-1");
    expect(context.reviews.createCriticDue({ ...due, criticRunId: "critic-run-duplicate" })).toBe("critic-run-1");
    expect(context.database.connection.prepare("SELECT COUNT(*) AS count FROM critic_runs").get()).toEqual({ count: 1 });
    const content = { title: "Finding", proposedText: "Improve the instruction" };
    context.reviews.createCriticProposal({
      criticProposalId: "critic-proposal-1", criticRunId: "critic-run-1",
      content, contentHash: hash(content), targetType: "action_execution", targetId: "action-execution-1",
      category: "code", createdAt: TEST_AT
    });
    expect(new FeedbackStore(() => context.database.connection).list("run-1")).toEqual([]);
    const decision = {
      decision: "approved" as const, expectedContentHash: hash(content), expectedVersion: 1 as const,
      decidedAt: TEST_AT
    };
    const feedback = feedbackSeed("critic-feedback", "approved_critic_proposal", {
      criticProposalId: "critic-proposal-1", agentRunId: undefined,
      approval: { approvedBy: "human-1", approvedAt: TEST_AT }, provenance: { criticRunId: "critic-run-1" }
    });
    context.reviews.decideCritic("critic-proposal-1", decision, actor, feedback);
    expect(new FeedbackStore(() => context.database.connection).list("run-1")).toHaveLength(1);
    expect(() => context.reviews.decideCritic("critic-proposal-1", decision, actor, feedback)).toThrow(/already decided/);
    expect(context.database.connection.prepare("SELECT COUNT(*) AS count FROM critic_proposal_decisions").get())
      .toEqual({ count: 1 });
  });

  it("rejects a stale proposal hash without recording a human decision", () => {
    const context = completedContext();
    createCriticProposal(context);
    expect(() => context.reviews.decideCritic("critic-proposal-1", {
      decision: "rejected", expectedContentHash: "f".repeat(64), expectedVersion: 1, decidedAt: TEST_AT
    }, actor)).toThrow(/stale/);
    expect(context.database.connection.prepare("SELECT COUNT(*) AS count FROM critic_proposal_decisions").get())
      .toEqual({ count: 0 });
  });
});

describe("Refinement exact proposal and continuation", () => {
  it("stores a stale preimage decision without applying any file result", () => {
    const context = completedContext();
    const proposal = createRefinement(context, "refinement-1", "refinement-proposal-1", "feedback-1");
    context.reviews.decideRefinement(proposal.refinementProposalId, refinementDecision(proposal), actor);
    const result = context.reviews.recordApply({
      refinementApplyId: "apply-1", refinementProposalId: proposal.refinementProposalId,
      status: "applied", worktreePath: "/tmp/refinement", branch: "codex/refinement",
      commitSha: "c".repeat(40), observedPreimageHashes: { ".ballet/instructions/work.md": "f".repeat(64) },
      completedAt: TEST_AT
    });
    expect(result).toBe("stale");
    expect(context.reviews.reviews.requireRefinementProposal(proposal.refinementProposalId).status).toBe("stale");
    expect(context.database.connection.prepare("SELECT COUNT(*) AS count FROM refinement_applies").get()).toEqual({ count: 0 });
  });

  it("records approved apply, immutable continuation, restart persistence, and rejects a cycle", () => {
    const context = completedContext();
    const proposal = createRefinement(context, "refinement-1", "refinement-proposal-1", "feedback-1");
    const decision = {
      ...refinementDecision(proposal)
    };
    context.reviews.decideRefinement(proposal.refinementProposalId, decision, actor);
    expect(() => context.reviews.decideRefinement(proposal.refinementProposalId, decision, actor)).toThrow(/already decided/);
    const commitSha = "c".repeat(40);
    const continuation = {
      ...environmentSeed({
        environmentRunId: "run-2", source: "continuation", previousRunId: "run-1",
        baseCommit: commitSha, stateCount: 1
      }),
      continuationLinkId: "continuation-1"
    };
    const result = context.reviews.recordApply({
      refinementApplyId: "apply-1", refinementProposalId: proposal.refinementProposalId,
      status: "applied", worktreePath: "/tmp/refinement", branch: "codex/refinement",
      commitSha, observedPreimageHashes: { ".ballet/instructions/work.md": HASH_A },
      completedAt: TEST_AT,
      continuation: { ...continuation, continuationSnapshotHash: continuation.executionSnapshotHash }
    });
    expect(result).toBe("applied");
    expect(context.flow.runs.require("run-2")).toMatchObject({ source: "continuation", previousRunId: "run-1", baseCommit: commitSha });
    expect(() => context.reviews.reviews.recordContinuation({
      continuationLinkId: "cycle", sourceRunId: "run-2", continuationRunId: "run-1",
      refinementApplyId: "apply-1", sourceSnapshotHash: HASH_A,
      continuationSnapshotHash: HASH_A, createdAt: TEST_AT
    })).toThrow(/cycle/);
    context.database.manager.close();
    expect(context.database.manager.connection().prepare("SELECT COUNT(*) AS count FROM continuation_links").get())
      .toEqual({ count: 1 });
  });

  it("rejects unsafe proposal paths before persisting a proposal", () => {
    const context = completedContext();
    new FeedbackStore(() => context.database.connection).create(feedbackSeed(
      "feedback-1", "validation_blocked", { agentRunId: "precheck-1" }
    ));
    context.reviews.createRefinementRun({
      refinementRunId: "refinement-1", sourceEnvironmentRunId: "run-1",
      feedbackEntryIds: ["feedback-1"], createdAt: TEST_AT
    });
    const candidate = proposalInput("refinement-1", "proposal-unsafe", "/tmp/work.md");
    candidate.changeListHash = refinementChangeListHash(candidate);
    expect(() => context.reviews.createRefinementProposal(candidate)).toThrow(/unsafe/);
    expect(context.database.connection.prepare("SELECT COUNT(*) AS count FROM refinement_proposals").get())
      .toEqual({ count: 0 });
  });
});

const completedContext = () => {
  const database = openTestDatabase();
  databases.push(database);
  const flow = new FlowCoordinator(() => database.connection);
  const outcomes = new ActionOutcomeCoordinator(() => database.connection);
  flow.createEnvironmentRun(environmentSeed({ stateCount: 1 }));
  const action = flow.advance("run-1", 0, TEST_AT);
  outcomes.createPrecheck(action.actionExecutionId, action.revision, agentRunInput("precheck-1", "precheck", 1));
  outcomes.applyPrecheck({
    agentRunId: "precheck-1", providerOutcomeKey: "terminal", expectedActionRevision: 2,
    outcome: validationOutcome({ phase: "precheck", decision: "done", evidence: {} }), completedAt: TEST_AT
  });
  flow.completeState("state-execution-1", 1, TEST_AT);
  flow.completeEnvironment(productSnapshotSeed(), flow.runs.require("run-1").revision);
  return { database, flow, reviews: new ReviewCoordinator(() => database.connection) };
};

const createCriticProposal = (context: ReturnType<typeof completedContext>) => {
  context.reviews.reviews.createSchedule({
    criticScheduleId: "schedule-1", configHash: HASH_A, nextDueAt: TEST_AT, enabled: true, createdAt: TEST_AT
    ,config: scheduleConfig
  });
  context.reviews.createCriticDue({
    criticRunId: "critic-run-1", criticScheduleId: "schedule-1", dueAt: TEST_AT,
    dueKey: "due-1", productSnapshotId: "snapshot-run-1", createdAt: TEST_AT
  });
  const content = { proposedText: "Improve" };
  context.reviews.createCriticProposal({
    criticProposalId: "critic-proposal-1", criticRunId: "critic-run-1",
    content, contentHash: hash(content), targetType: "action_execution", targetId: "action-execution-1",
    category: "code", createdAt: TEST_AT
  });
};

const createRefinement = (
  context: ReturnType<typeof completedContext>,
  refinementRunId: string,
  refinementProposalId: string,
  feedbackEntryId: string
) => {
  new FeedbackStore(() => context.database.connection).create(feedbackSeed(
    feedbackEntryId, "validation_blocked", { agentRunId: "precheck-1" }
  ));
  context.reviews.createRefinementRun({ refinementRunId, sourceEnvironmentRunId: "run-1", feedbackEntryIds: [feedbackEntryId], createdAt: TEST_AT });
  const proposal = proposalInput(refinementRunId, refinementProposalId, ".ballet/instructions/work.md");
  proposal.changeListHash = refinementChangeListHash(proposal);
  context.reviews.createRefinementProposal(proposal);
  return proposal;
};

const proposalInput = (refinementRunId: string, refinementProposalId: string, relativePath: string) => ({
  refinementProposalId, refinementRunId, targetActionId: "action-1",
  expectedBaseCommit: TEST_SHA, impactScope: { actionIds: ["action-1"] }, changeListHash: "",
  expectedBehavioralImprovement: "Validation passes", risks: ["Prompt drift"],
  validationPlan: ["instruction_contract" as const], rollback: "Discard local branch",
  files: [{
    operation: "replace" as const,
    relativePath, expectedPreimageHash: HASH_A,
    proposedContentHash: sha256("# Task\nChanged"), proposedContent: "# Task\nChanged", rationale: "Clarify task"
  }],
  createdAt: TEST_AT
});

const refinementDecision = (proposal: ReturnType<typeof proposalInput>) => ({
  decision: "approved" as const, expectedContentHash: proposal.changeListHash, expectedVersion: 1 as const,
  expectedChangeHashes: proposal.files.map(({ proposedContentHash }) => proposedContentHash),
  expectedImpactActionIds: ["action-1"], acknowledgeLocalCommitAndContinuation: true,
  decidedAt: TEST_AT
});
