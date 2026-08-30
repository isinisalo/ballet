/* eslint-disable max-lines, max-lines-per-function */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import type { CreateEnvironmentRunInput } from "../../../shared/orchestration/persistence.js";
import { ActionOutcomeCoordinator } from "../persistence/ActionOutcomeCoordinator.js";
import { FeedbackStore } from "../persistence/FeedbackStore.js";
import { FlowCoordinator } from "../persistence/FlowCoordinator.js";
import {
  HASH_A, TEST_AT, TEST_SHA, VALID_INSTRUCTION, agentRunInput, environmentSeed, feedbackSeed, hash,
  openTestDatabase, runEvidenceSeed, validationOutcome, type TestDatabase
} from "../persistence/PersistenceTestFixtures.js";
import { ReviewCoordinator } from "../persistence/ReviewCoordinator.js";
import { refinementChangeListHash } from "../persistence/ReviewStore.js";
import { CriticSchedulerService } from "./CriticSchedulerService.js";
import { nextCriticDue } from "./CriticScheduleCalculator.js";
import { FeedbackBoxService } from "./FeedbackBoxService.js";
import { FeedbackResolutionService } from "./FeedbackResolutionService.js";
import { RefinementApplyService } from "./RefinementApplyService.js";
import { resolveRefinementImpact } from "./RefinementImpactResolver.js";
import { GovernanceExecutionService, validAgentTomlRefinement } from "./GovernanceExecutionService.js";
import { DeterministicExecutionQueue } from "../runtime/ExecutionQueueBoundary.js";
import { mapProviderPermissions } from "../runtime/ProviderPermissions.js";

const databases: TestDatabase[] = [];
const directories: string[] = [];
const actor = { id: "human-1", source: "local_operator" as const };
afterEach(() => {
  databases.splice(0).forEach(({ cleanup }) => cleanup());
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("durable Critic schedules", () => {
  test("calculates daily and weekly due instants across DST deterministically", () => {
    expect(nextCriticDue({ id: "daily", kind: "daily", timeZone: "Europe/Helsinki", localTimes: ["03:30"] },
      "2026-03-28T23:30:00Z")).toBe("2026-03-29T01:30:00Z");
    expect(nextCriticDue({ id: "weekly", kind: "weekly", weekdays: [7], timeZone: "Europe/Helsinki", localTimes: ["03:30"] },
      "2026-10-24T23:30:00Z")).toBe("2026-10-25T00:30:00Z");
  });

  test("rejects an invalid IANA timezone at the config boundary", () => {
    expect(() => nextCriticDue({ id: "x", kind: "daily", timeZone: "Mars/Olympus", localTimes: ["09:00"] }, TEST_AT))
      .toThrow();
  });

  test("disabled creates no run; missed due creates only one skipped run and no burst", () => {
    const db = trackedDb();
    let now = "2026-08-29T10:00:00Z";
    const scheduler = new CriticSchedulerService(() => db.connection, { now: () => now }, ids("schedule"));
    const config = { id: "daily", kind: "daily" as const, timeZone: "UTC", localTimes: ["10:01"] };
    scheduler.configure([config], false);
    now = "2026-08-30T12:00:00Z";
    expect(scheduler.tick()).toEqual([]);
    scheduler.configure([config], true);
    now = "2026-08-31T12:00:00Z";
    expect(scheduler.tick()).toHaveLength(1);
    expect(scheduler.tick()).toEqual([]);
    expect(db.connection.prepare("SELECT status, skip_reason FROM critic_runs").all())
      .toEqual([{ status: "skipped", skip_reason: "no_run_evidence" }]);
  });

  test("disables schedules removed from the current valid configuration", () => {
    const db = trackedDb();
    const scheduler = new CriticSchedulerService(() => db.connection, { now: () => TEST_AT }, ids("schedule-remove"));
    scheduler.configure([{ id: "removed", kind: "daily", timeZone: "UTC", localTimes: ["11:00"] }], true);
    scheduler.configure([], true);
    expect(db.connection.prepare("SELECT critic_schedule_id, enabled FROM critic_schedules").all())
      .toEqual([{ critic_schedule_id: "removed", enabled: 0 }]);
  });

  test("dedupes due, forbids overlap and releases a shutdown claim", () => {
    const context = completedDb();
    let now = "2026-08-29T10:00:00Z";
    const scheduler = new CriticSchedulerService(() => context.db.connection, { now: () => now }, ids("critic"));
    scheduler.configure([{ id: "daily", kind: "daily", timeZone: "UTC", localTimes: ["10:01"] }], true);
    now = "2026-08-29T10:02:00Z";
    const [runId] = scheduler.tick();
    expect(runId).toBeTruthy();
    const reviews = context.reviews.reviews;
    expect(reviews.claimCriticRun(runId!, now)).toBe(true);
    context.db.connection.prepare("UPDATE critic_schedules SET next_due_at = ?").run("2026-08-29T10:01:00Z");
    expect(scheduler.tick()).toEqual([]);
    expect(scheduler.shutdown()).toBe(1);
    expect(context.db.connection.prepare("SELECT status FROM critic_runs WHERE critic_run_id = ?").get(runId))
      .toEqual({ status: "queued" });
  });
});

describe("Feedback Box trust and lifecycle", () => {
  test("human source is assigned by the trusted service and target is validated", () => {
    const context = completedDb();
    const service = new FeedbackBoxService(() => context.db.connection);
    service.createHuman({
      feedbackEntryId: "human-feedback", category: "documentation",
      comment: "Instruction is ambiguous", sourceCommit: TEST_SHA, createdAt: TEST_AT,
      ...({ source: "approved_critic_proposal" } as object)
    }, actor);
    expect(service.list({ environmentRunId: "run-1" })[0]).toMatchObject({ source: "human", created_by: "human-1" });
    expect(() => service.createHuman({
      feedbackEntryId: "bad", category: "code", comment: "", sourceCommit: TEST_SHA, createdAt: TEST_AT
    }, actor)).toThrow(/comment is required/);
  });

  test("only a trusted human terminal transition resolves or dismisses", () => {
    const context = completedDb();
    const service = new FeedbackBoxService(() => context.db.connection);
    service.createHuman({
      feedbackEntryId: "human-feedback", category: "system", comment: "Description",
      sourceCommit: TEST_SHA, createdAt: TEST_AT
    }, actor);
    service.transitionHuman("human-feedback", "open", "dismissed", TEST_AT, actor);
    expect(new FeedbackStore(() => context.db.connection).require("human-feedback").status).toBe("dismissed");
    expect(() => service.transitionHuman("human-feedback", "open", "resolved", TEST_AT, actor)).toThrow(/terminal/);
  });
});

describe("read-only governance proposal execution", () => {
  test("Refinement can change only developer_instructions in a fixed Agent TOML", () => {
    const snapshot = environmentSeed().executionSnapshot;
    const current = snapshot.agents[0]!;
    const toml = (model: string, instructions: string) => `name = "${current.name}"\ndescription = "${current.description}"\nmodel = "${model}"\nmodel_reasoning_effort = "${current.reasoningEffort}"\nsandbox_mode = "read-only"\ndeveloper_instructions = "${instructions}"\n`;
    const file = { operation: "replace" as const, relativePath: `.codex/agents/${current.id}.toml`,
      preimageSha256: current.contentSha256, proposedContentSha256: HASH_A, proposedContent: toml(current.model, "Clarified"), rationale: "Feedback" };
    expect(validAgentTomlRefinement(file, snapshot)).toBe(true);
    expect(validAgentTomlRefinement({ ...file, proposedContent: toml("gpt-5.6-luna", "Clarified") }, snapshot)).toBe(false);
    expect(validAgentTomlRefinement({ ...file, operation: "delete", proposedContent: undefined }, snapshot)).toBe(false);
  });

  test("Critic callback creates only pending human proposal, never Feedback or approval", async () => {
    const context = completedDb();
    const config = { id: "daily", kind: "daily" as const, timeZone: "UTC", localTimes: ["10:00"] };
    context.reviews.reviews.createSchedule({
      criticScheduleId: "daily", configHash: HASH_A, config, nextDueAt: TEST_AT, enabled: true, createdAt: TEST_AT
    });
    context.reviews.createCriticDue({
      criticRunId: "critic-run", criticScheduleId: "daily", dueAt: TEST_AT, dueKey: "daily:due",
      runEvidenceId: "snapshot-run-1", createdAt: TEST_AT
    });
    const queue = new DeterministicExecutionQueue();
    const execution = new GovernanceExecutionService(() => context.db.connection, queue, ids("governance"), () => TEST_AT);
    const taskId = await execution.queueCritic("critic-run");
    const proposal = {
      proposalId: "critic-proposal", title: "Finding", finding: "Instruction can be clearer", evidenceRefs: ["snapshot-run-1"],
      category: "documentation", targetType: "run_evidence", targetId: "snapshot-run-1",
      severity: "medium", priority: 2, recommendedCorrectiveActions: ["Clarify instruction"],
      rationale: "Validation evidence", confidence: 0.9
    };
    expect(execution.applyProviderOutput(taskId, "critic-terminal", JSON.stringify({
      version: 11, role: "critic", summary: "Reviewed",
      checks: [{ name: "fixture", status: "passed", evidenceRefs: ["test:fixture"] }], proposal
    }))).toBe("proposal");
    expect(context.reviews.reviews.requireCriticProposal("critic-proposal").status).toBe("pending_human_review");
    expect(new FeedbackStore(() => context.db.connection).list("run-1")).toEqual([]);
    expect(context.db.connection.prepare("SELECT COUNT(*) AS count FROM critic_proposal_decisions").get()).toEqual({ count: 0 });
  });

  test("Critic rejection creates no Feedback and Refinement proposal has no writable root", () => {
    const context = completedDb();
    const config = { id: "daily", kind: "daily" as const, timeZone: "UTC", localTimes: ["10:00"] };
    context.reviews.reviews.createSchedule({ criticScheduleId: "daily", configHash: HASH_A, config,
      nextDueAt: TEST_AT, enabled: true, createdAt: TEST_AT });
    context.reviews.createCriticDue({ criticRunId: "critic-run", criticScheduleId: "daily", dueAt: TEST_AT,
      dueKey: "daily:due", runEvidenceId: "snapshot-run-1", createdAt: TEST_AT });
    const content = { finding: "No change" };
    context.reviews.createCriticProposal({ criticProposalId: "critic-proposal", criticRunId: "critic-run",
      content, contentHash: sha256(JSON.stringify(content)), targetType: "run_evidence",
      targetId: "snapshot-run-1", category: "system", createdAt: TEST_AT });
    const storedHash = String(context.reviews.reviews.requireCriticProposal("critic-proposal").content_hash);
    context.reviews.decideCritic("critic-proposal", {
      decision: "rejected", expectedContentHash: storedHash, expectedVersion: 2, decidedAt: TEST_AT
    }, actor);
    expect(new FeedbackStore(() => context.db.connection).list("run-1")).toEqual([]);
    const permission = mapProviderPermissions({ provider: "codex", role: "refinement", toolPolicy: "read_only",
      worktreePath: "/tmp/worktree" });
    expect(permission).toMatchObject({ approvalPolicy: "never", writableRoots: [] });
  });
});

describe("exact Refinement approval and managed apply", () => {
  test("shared Skill impact includes every referencing Action", () => {
    const environment = environmentSeed({ stateCount: 2 }).executionSnapshot.environment;
    for (const state of environment.states) for (const action of state.actions) action.work.skillResources = ["shared"];
    for (const relativePath of [".agents/skills/shared/SKILL.md", ".agents/skills/shared/SKILL.md"]) {
      expect(resolveRefinementImpact(environment, [{
        operation: "replace", relativePath, expectedPreimageHash: HASH_A,
        proposedContentHash: HASH_A, proposedContent: "x", rationale: "x", resourceId: "shared"
      }], "action-1")).toEqual(["action-1", "action-2"]);
    }
  });

  test("exact approval creates one local commit and continuation without merge, push, or early resolution", async () => {
    const repository = gitRepository();
    const context = completedDb(repository.head);
    const proposal = createApprovedRefinement(context, repository.head, VALID_INSTRUCTION,
      `${VALID_INSTRUCTION}\n\nRefined guidance.`, ["instruction_contract", "resource_contract", "relevant_tests"]);
    const validationCalls: string[] = [];
    const service = new RefinementApplyService(
      () => context.db.connection, repository.root, repository.worktrees,
      { run: async (id) => { validationCalls.push(id); } },
      async ({ commitSha, refinementProposalId }) => {
        const continuation = environmentSeed({
          environmentRunId: "run-2", source: "continuation", previousRunId: "run-1", baseCommit: commitSha, stateCount: 1
        });
        bindContinuationLineage(continuation, refinementProposalId, commitSha);
        return { ...continuation, continuationLinkId: "continuation-1", continuationSnapshotHash: continuation.executionSnapshotHash };
      }, () => TEST_AT
    );
    const applyResult = await service.apply(proposal.refinementProposalId, "apply-1");
    const applyRow = context.db.connection.prepare(
      "SELECT error_message FROM refinement_applies WHERE refinement_apply_id = 'apply-1'"
    ).get() as { error_message: string | null };
    expect(applyResult, applyRow.error_message ?? undefined).toBe("applied");
    expect(git(repository.root, ["rev-parse", "HEAD"])).toBe(repository.head);
    expect(git(path.join(repository.worktrees, "apply-1"), ["rev-parse", "HEAD"])).not.toBe(repository.head);
    expect(git(repository.root, ["remote"])).toBe("");
    expect(validationCalls).toEqual(["instruction_contract", "resource_contract", "relevant_tests"]);
    expect(new FeedbackStore(() => context.db.connection).require("feedback-1").status).toBe("in_refinement");
    completeContinuation(context, "run-2");
    expect(new FeedbackResolutionService(() => context.db.connection).reconcileContinuation("run-2", TEST_AT)).toBe("resolved");
    expect(new FeedbackStore(() => context.db.connection).require("feedback-1").status).toBe("resolved");
  });

  test("claims an approved Refinement exactly once before any asynchronous project write", async () => {
    const repository = gitRepository();
    const context = completedDb(repository.head);
    const proposal = createApprovedRefinement(context, repository.head, VALID_INSTRUCTION,
      `${VALID_INSTRUCTION}\n\nOne apply only.`, ["instruction_contract"]);
    let releaseValidation!: () => void;
    const validationGate = new Promise<void>((resolve) => { releaseValidation = resolve; });
    let validationStarted!: () => void;
    const started = new Promise<void>((resolve) => { validationStarted = resolve; });
    const service = new RefinementApplyService(
      () => context.db.connection, repository.root, repository.worktrees,
      { run: async () => { validationStarted(); await validationGate; } },
      async ({ commitSha, refinementProposalId }) => {
        const continuation = environmentSeed({ environmentRunId: "run-concurrent", source: "continuation",
          previousRunId: "run-1", baseCommit: commitSha, stateCount: 1 });
        bindContinuationLineage(continuation, refinementProposalId, commitSha);
        return { ...continuation, continuationLinkId: "continuation-concurrent",
          continuationSnapshotHash: continuation.executionSnapshotHash };
      }, () => TEST_AT
    );
    const first = service.apply(proposal.refinementProposalId, "apply-first");
    await started;
    await expect(service.apply(proposal.refinementProposalId, "apply-second")).rejects.toThrow(/already has an apply/);
    releaseValidation();
    expect(await first).toBe("applied");
    expect(context.db.connection.prepare("SELECT COUNT(*) AS count FROM refinement_applies").get()).toEqual({ count: 1 });
  });

  test("applies from the approved immutable evidence commit without rewinding a newer checkout", async () => {
    const repository = gitRepository();
    const context = completedDb(repository.head);
    const proposal = createApprovedRefinement(context, repository.head, VALID_INSTRUCTION,
      `${VALID_INSTRUCTION}\n\nRefined from evidence commit.`, ["instruction_contract"]);
    writeFileSync(path.join(repository.root, "README.md"), "newer checkout\n");
    git(repository.root, ["add", "README.md"]);
    git(repository.root, ["-c", "user.name=Test", "-c", "user.email=test@localhost", "commit", "-m", "newer checkout"]);
    const newerHead = git(repository.root, ["rev-parse", "HEAD"]);
    const service = new RefinementApplyService(
      () => context.db.connection, repository.root, repository.worktrees,
      { run: async () => undefined }, async ({ commitSha, refinementProposalId }) => {
        const continuation = environmentSeed({ environmentRunId: "run-2", source: "continuation",
          previousRunId: "run-1", baseCommit: commitSha, stateCount: 1 });
        bindContinuationLineage(continuation, refinementProposalId, commitSha);
        return { ...continuation, continuationLinkId: "continuation-1", continuationSnapshotHash: continuation.executionSnapshotHash };
      }, () => TEST_AT
    );
    expect(await service.apply(proposal.refinementProposalId, "apply-evidence-base")).toBe("applied");
    expect(git(repository.root, ["rev-parse", "HEAD"])).toBe(newerHead);
    expect(git(path.join(repository.worktrees, "apply-evidence-base"), ["merge-base", "HEAD", repository.head]))
      .toBe(repository.head);
  });

  test("symlink escape or stale approval fails without changing current checkout or resolving Feedback", async () => {
    const repository = gitRepository(true);
    const context = completedDb(repository.head);
    const proposal = createApprovedRefinement(context, repository.head, "outside", "replacement", ["instruction_contract"],
      ".ballet/instructions/link.md");
    const service = new RefinementApplyService(
      () => context.db.connection, repository.root, repository.worktrees,
      { run: async () => undefined }, async () => { throw new Error("Continuation must not run"); }, () => TEST_AT
    );
    expect(await service.apply(proposal.refinementProposalId, "apply-failed")).toBe("apply_failed");
    expect(git(repository.root, ["rev-parse", "HEAD"])).toBe(repository.head);
    expect(new FeedbackStore(() => context.db.connection).require("feedback-1").status).toBe("in_refinement");
    expect(context.db.connection.prepare("SELECT status FROM refinement_applies").get()).toEqual({ status: "apply_failed" });
  });

  test("reject reopens Feedback and cannot write files", () => {
    const repository = gitRepository();
    const context = completedDb(repository.head);
    const proposal = createRefinement(context, repository.head, VALID_INSTRUCTION, `${VALID_INSTRUCTION}\nChange`);
    context.reviews.decideRefinement(proposal.refinementProposalId, {
      ...decisionFor(proposal), decision: "rejected", acknowledgeLocalCommitAndContinuation: false
    }, actor);
    expect(new FeedbackStore(() => context.db.connection).require("feedback-1").status).toBe("open");
    expect(git(repository.root, ["status", "--short"])).toBe("");
  });

  test("stale exact change approval and arbitrary validation command are rejected", () => {
    const repository = gitRepository();
    const context = completedDb(repository.head);
    const proposal = createRefinement(context, repository.head, VALID_INSTRUCTION, `${VALID_INSTRUCTION}\nChange`);
    expect(() => context.reviews.decideRefinement(proposal.refinementProposalId, {
      ...decisionFor(proposal), expectedChangeHashes: ["f".repeat(64)]
    }, actor)).toThrow(/exact changes/);
    const unsafe = { ...proposal, refinementProposalId: "proposal-unsafe", refinementRunId: "refinement-unsafe",
      validationPlan: ["rm -rf" as never] };
    new FeedbackStore(() => context.db.connection).create(feedbackSeed(
      "feedback-unsafe", "validation_blocked", { agentRunId: "precheck-1" }
    ));
    context.reviews.createRefinementRun({ refinementRunId: "refinement-unsafe", sourceEnvironmentRunId: "run-1",
      feedbackEntryIds: ["feedback-unsafe"], createdAt: TEST_AT });
    unsafe.changeListHash = refinementChangeListHash(unsafe);
    expect(() => context.reviews.createRefinementProposal(unsafe)).toThrow(/non-allowlisted/);
  });

  test("blocked continuation reopens selected Feedback", async () => {
    const repository = gitRepository();
    const context = completedDb(repository.head);
    const proposal = createApprovedRefinement(context, repository.head, VALID_INSTRUCTION,
      `${VALID_INSTRUCTION}\nRefined.`, ["instruction_contract"]);
    const service = new RefinementApplyService(
      () => context.db.connection, repository.root, repository.worktrees,
      { run: async () => undefined }, async ({ commitSha, refinementProposalId }) => {
        const continuation = environmentSeed({ environmentRunId: "run-2", source: "continuation",
          previousRunId: "run-1", baseCommit: commitSha, stateCount: 1 });
        bindContinuationLineage(continuation, refinementProposalId, commitSha);
        return { ...continuation, continuationLinkId: "continuation-1", continuationSnapshotHash: continuation.executionSnapshotHash };
      }, () => TEST_AT
    );
    expect(await service.apply(proposal.refinementProposalId, "apply-blocked")).toBe("applied");
    context.db.connection.prepare("UPDATE environment_runs SET status = 'blocked' WHERE environment_run_id = 'run-2'").run();
    expect(new FeedbackResolutionService(() => context.db.connection).reconcileContinuation("run-2", TEST_AT)).toBe("reopened");
    expect(new FeedbackStore(() => context.db.connection).require("feedback-1").status).toBe("open");
  });
});

const trackedDb = (): TestDatabase => { const db = openTestDatabase(); databases.push(db); return db; };
const completedDb = (baseCommit?: string) => {
  const db = trackedDb();
  const flow = new FlowCoordinator(() => db.connection);
  const outcomes = new ActionOutcomeCoordinator(() => db.connection);
  flow.createEnvironmentRun(environmentSeed({ stateCount: 1, baseCommit }));
  const action = flow.advance("run-1", 0, TEST_AT);
  outcomes.createPrecheck(action.actionExecutionId, action.revision, agentRunInput("precheck-1", "precheck", 1));
  outcomes.applyPrecheck({
    agentRunId: "precheck-1", providerOutcomeKey: "terminal", expectedActionRevision: 2,
    outcome: validationOutcome({ phase: "precheck", decision: "done", evidence: {} }), completedAt: TEST_AT
  });
  const state = flow.runs.states("run-1")[0]!;
  flow.completeState(state.stateExecutionId, state.revision, TEST_AT);
  flow.completeEnvironment({ ...runEvidenceSeed(), baseCommit: baseCommit ?? runEvidenceSeed().baseCommit }, flow.runs.require("run-1").revision);
  return { db, flow, reviews: new ReviewCoordinator(() => db.connection) };
};

const createRefinement = (
  context: ReturnType<typeof completedDb>, baseCommit: string, oldContent: string, newContent: string,
  validationPlan: Array<"instruction_contract" | "resource_contract" | "relevant_tests"> = ["instruction_contract"],
  relativePath = ".ballet/instructions/work.md"
) => {
  new FeedbackStore(() => context.db.connection).create(feedbackSeed(
    "feedback-1", "validation_blocked", { agentRunId: "precheck-1" }
  ));
  context.reviews.createRefinementRun({ refinementRunId: "refinement-1", sourceEnvironmentRunId: "run-1",
    feedbackEntryIds: ["feedback-1"], createdAt: TEST_AT });
  const proposal = {
    refinementProposalId: "proposal-1", refinementRunId: "refinement-1", targetActionId: "action-1",
    expectedBaseCommit: baseCommit, impactScope: { actionIds: ["action-1"] }, changeListHash: "",
    expectedBehavioralImprovement: "Validation passes", risks: ["Prompt drift"], validationPlan,
    rollback: "Discard local branch", files: [{
      operation: "replace" as const, relativePath, expectedPreimageHash: sha256(oldContent),
      proposedContentHash: sha256(newContent), proposedContent: newContent, rationale: "Clarify instruction"
    }], createdAt: TEST_AT
  };
  proposal.changeListHash = refinementChangeListHash(proposal);
  context.reviews.createRefinementProposal(proposal);
  return proposal;
};
const createApprovedRefinement = (
  context: ReturnType<typeof completedDb>, baseCommit: string, oldContent: string, newContent: string,
  validationPlan: Array<"instruction_contract" | "resource_contract" | "relevant_tests">,
  relativePath?: string
) => {
  const proposal = createRefinement(context, baseCommit, oldContent, newContent, validationPlan, relativePath);
  context.reviews.decideRefinement(proposal.refinementProposalId, decisionFor(proposal), actor);
  return proposal;
};
const decisionFor = (proposal: ReturnType<typeof createRefinement>) => ({
  decision: "approved" as const, expectedContentHash: proposal.changeListHash, expectedVersion: 2 as const,
  expectedChangeHashes: proposal.files.map(({ proposedContentHash }) => proposedContentHash),
  expectedImpactActionIds: ["action-1"], acknowledgeLocalCommitAndContinuation: true, decidedAt: TEST_AT
});
const completeContinuation = (context: ReturnType<typeof completedDb>, runId: string): void => {
  const action = context.flow.advance(runId, 0, TEST_AT);
  const precheck = agentRunInput("continuation-precheck", "precheck", 1, action.actionExecutionId, runId);
  new ActionOutcomeCoordinator(() => context.db.connection).createPrecheck(action.actionExecutionId, action.revision, precheck);
  new ActionOutcomeCoordinator(() => context.db.connection).applyPrecheck({
    agentRunId: "continuation-precheck", providerOutcomeKey: "continuation-terminal", expectedActionRevision: 2,
    outcome: validationOutcome({ phase: "precheck", decision: "done", evidence: {} }), completedAt: TEST_AT
  });
  const state = context.flow.runs.states(runId)[0]!;
  context.flow.completeState(state.stateExecutionId, state.revision, TEST_AT);
  const run = context.flow.runs.require(runId);
  context.flow.completeEnvironment({
    ...runEvidenceSeed(runId), branch: run.branch, worktreePath: run.worktreePath, baseCommit: run.baseCommit
  }, run.revision);
};

const bindContinuationLineage = (
  seed: CreateEnvironmentRunInput, refinementProposalId: string, commitSha: string
): void => {
  seed.executionSnapshot = { ...seed.executionSnapshot, lineage: {
    parentRootRunId: "run-1", refinementProposalId,
    refinementApprovalId: `${refinementProposalId}:decision`, refinementCommitSha: commitSha
  } };
  seed.executionSnapshotHash = hash(seed.executionSnapshot);
};

const gitRepository = (symlink = false) => {
  const directory = mkdtempSync(path.join(tmpdir(), "ballet-refinement-test-"));
  directories.push(directory);
  const root = path.join(directory, "repo");
  const worktrees = path.join(directory, "worktrees");
  mkdirSync(path.join(root, ".ballet/instructions"), { recursive: true });
  writeFileSync(path.join(root, ".ballet/instructions/work.md"), VALID_INSTRUCTION);
  if (symlink) {
    writeFileSync(path.join(directory, "outside"), "outside");
    symlinkSync(path.join(directory, "outside"), path.join(root, ".ballet/instructions/link.md"));
  }
  git(root, ["init"]);
  git(root, ["add", "-A"]);
  git(root, ["-c", "user.name=Test", "-c", "user.email=test@localhost", "commit", "-m", "initial"]);
  return { root, worktrees, head: git(root, ["rev-parse", "HEAD"]) };
};
const git = (cwd: string, args: string[]): string => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const ids = (prefix: string) => { let value = 0; return () => `${prefix}-${++value}`; };
