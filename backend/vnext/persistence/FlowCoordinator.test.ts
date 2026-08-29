import { afterEach, describe, expect, it } from "vitest";
import { ActionOutcomeCoordinator } from "./ActionOutcomeCoordinator.js";
import { ControlFlowStore } from "./ControlFlowStore.js";
import { FeedbackStore } from "./FeedbackStore.js";
import { FlowCoordinator } from "./FlowCoordinator.js";
import {
  TEST_AT, agentRunInput, environmentSeed, feedbackSeed, openTestDatabase,
  productSnapshotSeed, validationOutcome, workOutcome, type TestDatabase
} from "./PersistenceTestFixtures.js";
import { ProductSnapshotStore } from "./ProductSnapshotStore.js";

const databases: TestDatabase[] = [];
afterEach(() => databases.splice(0).forEach(({ cleanup }) => cleanup()));

describe("Environment flow transactions", () => {
  it("seeds ordered States and Actions from one immutable aggregate", () => {
    const context = setup();
    expect(context.flow.runs.states("run-1").map(({ order }) => order)).toEqual([1, 2]);
    expect(context.flow.runs.actions("state-execution-1").map(({ priority }) => priority)).toEqual([1]);
    expect(new ControlFlowStore(() => context.database.connection).list("run-1").map(({ kind }) => kind))
      .toEqual(["environment_started"]);
  });

  it("allows exactly one active Action and rejects duplicate or stale advance", () => {
    const context = setup();
    const selected = context.flow.advance("run-1", 0, TEST_AT);
    expect(selected).toMatchObject({ actionExecutionId: "action-execution-1", status: "prechecking" });
    expect(() => context.flow.advance("run-1", 0, TEST_AT)).toThrow(/revision is stale/);
    const active = context.database.connection.prepare(`
      SELECT COUNT(*) AS count FROM action_executions
      WHERE environment_run_id = 'run-1' AND status IN ('prechecking','working','postchecking')
    `).get();
    expect(active).toEqual({ count: 1 });
  });

  it("does not complete or bypass a State with unfinished Actions", () => {
    const context = setup();
    context.flow.advance("run-1", 0, TEST_AT);
    expect(() => context.flow.completeState("state-execution-1", 1, TEST_AT)).toThrow(/every Action is done/);
    expect(context.flow.runs.requireState("state-execution-2").status).toBe("pending");
  });

  it("activates the next State only after the previous State is done", () => {
    const context = setup();
    const first = context.flow.advance("run-1", 0, TEST_AT);
    context.outcomes.createPrecheck(first.actionExecutionId, first.revision, agentRunInput("precheck-1", "precheck", 1));
    context.outcomes.applyPrecheck({
      agentRunId: "precheck-1", providerOutcomeKey: "terminal", expectedActionRevision: 2,
      outcome: validationOutcome({ phase: "precheck", decision: "done", evidence: {} }), completedAt: TEST_AT
    });
    context.flow.completeState("state-execution-1", 1, TEST_AT);
    const run = context.flow.runs.require("run-1");
    expect(context.flow.advance("run-1", run.revision, TEST_AT).actionExecutionId).toBe("action-execution-2");
  });

  it("rolls back blocked state when Feedback creation fails, then commits both atomically", () => {
    const context = setup();
    const selected = context.flow.advance("run-1", 0, TEST_AT);
    context.outcomes.createPrecheck(selected.actionExecutionId, selected.revision, agentRunInput("precheck-1", "precheck", 1));
    const blocked = validationOutcome({
      phase: "precheck", decision: "blocked", reason: "Missing prerequisite",
      correctiveActions: ["Provide prerequisite"], evidence: {}
    });
    const invalidFeedback = feedbackSeed("feedback-1", "validation_blocked", {
      correctiveActions: [], agentRunId: "precheck-1"
    });
    expect(() => context.outcomes.applyPrecheck({
      agentRunId: "precheck-1", providerOutcomeKey: "terminal-1", expectedActionRevision: 2,
      outcome: blocked, feedback: invalidFeedback, completedAt: TEST_AT
    })).toThrow(/corrective actions/);
    expect(context.flow.runs.requireAction(selected.actionExecutionId).status).toBe("prechecking");
    expect(context.executionAgentStatus("precheck-1")).toBe("queued");
    const validFeedback = feedbackSeed("feedback-1", "validation_blocked", { agentRunId: "precheck-1" });
    const action = context.outcomes.applyPrecheck({
      agentRunId: "precheck-1", providerOutcomeKey: "terminal-1", expectedActionRevision: 2,
      outcome: blocked, feedback: validFeedback, completedAt: TEST_AT
    });
    expect(action.status).toBe("blocked");
    expect(context.flow.runs.require("run-1").status).toBe("blocked");
    expect(new FeedbackStore(() => context.database.connection).list("run-1")).toHaveLength(1);
    expect(() => context.flow.advance("run-1", context.flow.runs.require("run-1").revision, TEST_AT)).toThrow(/cannot advance/);
  });
});

describe("Validation-led Action transactions", () => {
  it("runs Validation → Work → Validation and applies a duplicate provider terminal only once", () => {
    const context = setup({ stateCount: 1 });
    const action = context.flow.advance("run-1", 0, TEST_AT);
    context.outcomes.createPrecheck(action.actionExecutionId, action.revision, agentRunInput("precheck-1", "precheck", 1));
    const delegated = validationOutcome({
      phase: "precheck", decision: "delegate", workPrompt: "Perform the work", evidence: {}
    });
    let current = context.outcomes.applyPrecheck({
      agentRunId: "precheck-1", providerOutcomeKey: "precheck-terminal", expectedActionRevision: 2,
      outcome: delegated, nextWork: agentRunInput("work-1", "work", 1), completedAt: TEST_AT
    });
    expect(current).toMatchObject({ status: "working", workAttempt: 1 });
    current = context.outcomes.applyWork({
      agentRunId: "work-1", providerOutcomeKey: "work-terminal", expectedActionRevision: current.revision,
      outcome: workOutcome(), nextValidation: agentRunInput("postwork-1", "postwork", 1), completedAt: TEST_AT
    });
    expect(current.status).toBe("postchecking");
    const done = validationOutcome({ phase: "postwork", decision: "done", evidence: {} });
    current = context.outcomes.applyPostwork({
      agentRunId: "postwork-1", providerOutcomeKey: "postwork-terminal", expectedActionRevision: current.revision,
      outcome: done, completedAt: TEST_AT
    });
    const eventCount = new ControlFlowStore(() => context.database.connection).list("run-1").length;
    const duplicate = context.outcomes.applyPostwork({
      agentRunId: "postwork-1", providerOutcomeKey: "postwork-terminal", expectedActionRevision: 0,
      outcome: done, completedAt: TEST_AT
    });
    expect(duplicate).toMatchObject({ status: "done", workAttempt: 1 });
    expect(new ControlFlowStore(() => context.database.connection).list("run-1")).toHaveLength(eventCount);
  });

  it("turns retry exhaustion into blocked Action and Feedback atomically", () => {
    const context = setup({ maxRetries: 0, stateCount: 1 });
    let action = context.flow.advance("run-1", 0, TEST_AT);
    context.outcomes.createPrecheck(action.actionExecutionId, action.revision,
      agentRunInput("precheck-1", "precheck", 1, action.actionExecutionId, "run-1", "Perform the work", 0));
    action = context.outcomes.applyPrecheck({
      agentRunId: "precheck-1", providerOutcomeKey: "precheck-terminal", expectedActionRevision: 2,
      outcome: validationOutcome({ phase: "precheck", decision: "delegate", workPrompt: "Perform the work", evidence: {} }),
      nextWork: agentRunInput("work-1", "work", 1, action.actionExecutionId, "run-1", "Perform the work", 0), completedAt: TEST_AT
    });
    action = context.outcomes.applyWork({
      agentRunId: "work-1", providerOutcomeKey: "work-terminal", expectedActionRevision: action.revision,
      outcome: workOutcome(), nextValidation: agentRunInput("postwork-1", "postwork", 1, action.actionExecutionId, "run-1", "Perform the work", 0),
      completedAt: TEST_AT
    });
    action = context.outcomes.applyPostwork({
      agentRunId: "postwork-1", providerOutcomeKey: "validation-terminal", expectedActionRevision: action.revision,
      outcome: validationOutcome({
        phase: "postwork", decision: "retry", workPrompt: "Try again", feedback: "Failed",
        expectedCorrection: "Pass", evidence: {}
      }),
      feedback: feedbackSeed("retry-feedback", "retry_exhaustion"), completedAt: TEST_AT
    });
    expect(action).toMatchObject({ status: "blocked", workAttempt: 1, maxRetries: 0 });
    expect(new FeedbackStore(() => context.database.connection).list("run-1")).toHaveLength(1);
  });

  it("completes Environment and Product Snapshot atomically only after every State is done", () => {
    const context = setup({ stateCount: 1 });
    expect(() => new ProductSnapshotStore(() => context.database.connection).create(productSnapshotSeed()))
      .toThrow(/completed Environment/);
    const action = context.flow.advance("run-1", 0, TEST_AT);
    context.outcomes.createPrecheck(action.actionExecutionId, action.revision, agentRunInput("precheck-1", "precheck", 1));
    const doneAction = context.outcomes.applyPrecheck({
      agentRunId: "precheck-1", providerOutcomeKey: "terminal", expectedActionRevision: 2,
      outcome: validationOutcome({ phase: "precheck", decision: "done", evidence: {} }), completedAt: TEST_AT
    });
    expect(doneAction.status).toBe("done");
    context.flow.completeState("state-execution-1", 1, TEST_AT);
    const run = context.flow.runs.require("run-1");
    const completed = context.flow.completeEnvironment(productSnapshotSeed(), run.revision);
    expect(completed.status).toBe("completed");
    expect(new ProductSnapshotStore(() => context.database.connection).requireByRun("run-1"))
      .toMatchObject({ result_commit: "b".repeat(40) });
  });

  it("cancels the active Agent and never dispatches later work", () => {
    const context = setup();
    const action = context.flow.advance("run-1", 0, TEST_AT);
    context.outcomes.createPrecheck(action.actionExecutionId, action.revision, agentRunInput("precheck-1", "precheck", 1));
    const run = context.flow.runs.require("run-1");
    expect(context.flow.stop("run-1", run.revision, "cancelled", TEST_AT).status).toBe("cancelled");
    expect(context.executionAgentStatus("precheck-1")).toBe("cancelled");
    expect(context.flow.runs.requireState("state-execution-2").status).toBe("pending");
    expect(() => context.flow.advance("run-1", context.flow.runs.require("run-1").revision, TEST_AT)).toThrow(/cannot advance/);
  });
});

const setup = (options: Parameters<typeof environmentSeed>[0] = {}) => {
  const database = openTestDatabase();
  databases.push(database);
  const flow = new FlowCoordinator(() => database.connection);
  const outcomes = new ActionOutcomeCoordinator(() => database.connection);
  flow.createEnvironmentRun(environmentSeed(options));
  return {
    database, flow, outcomes,
    executionAgentStatus: (id: string) => String((database.connection.prepare(
      "SELECT status FROM agent_runs WHERE agent_run_id = ?"
    ).get(id) as { status: string }).status)
  };
};
