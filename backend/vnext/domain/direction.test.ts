import { describe, expect, it } from "vitest";
import {
  actionFlags, approveUseCase, canTransitionUseCase, deriveEnvironmentStatus, deriveStateStatus,
  hasValidUseCaseApproval, invalidateUseCaseApproval,
  nextRunnableAction, nextRunnableState, orderedActions, orderedStates, retryBudget, stateFlags,
  useCaseApprovalHash, validateActionInstruction, validateRunnableEnvironment,
  type ActionExecution, type Direction, type EnvironmentDefinition, type StateExecution, type UseCase
} from "../../../shared/vnext/index.js";

const draftUseCase = (): UseCase => ({
  id: "UC-1",
  name: "Deliver evidence",
  status: "draft",
  examples: [{ given: "approved direction", when: "work completes", then: "evidence is visible" }],
  successGoals: ["Evidence exists"],
  failureGoals: ["Evidence is missing"],
  expectedOutcomes: ["Auditable result"],
  goalIds: ["goal-1"],
  adrIds: ["adr-1"],
  constraintIds: ["constraint-1"]
});

const approvedUseCase = (): UseCase => approveUseCase(draftUseCase(), {
  approvedBy: "human-1", approvedAt: "2026-08-29T10:00:00.000Z", revision: 1
});

const direction = (useCase: UseCase = approvedUseCase()): Direction => ({
  goals: [{ id: "goal-1", name: "Goal", status: "accepted" }],
  adrs: [{ id: "adr-1", name: "Decision", status: "accepted" }],
  constraints: [{
    id: "constraint-1", name: "No early advance", status: "accepted", kind: "prohibited",
    description: "Do not advance early", rationale: "Preserve ordering"
  }],
  useCases: [useCase]
});

const environment = (): EnvironmentDefinition => ({
  id: "env-1",
  name: "Environment",
  description: "Ordered delivery",
  states: [{
    id: "state-1", name: "State", description: "First state", order: 1, useCaseIds: ["UC-1"],
    actions: [{
      id: "action-1", name: "Action", description: "First action", priority: 1,
      useCaseIds: ["UC-1"], maxRetries: 1,
      validation: { executionProfileId: "profile", instructionResource: "validation", skillResources: [], toolPolicy: "read_only" },
      work: { executionProfileId: "profile", instructionResource: "work", skillResources: [], toolPolicy: "workspace_write" }
    }]
  }]
});

describe("Use Case approval", () => {
  it("produces a deterministic hash independent of approval timestamps and set ordering", () => {
    const first = approvedUseCase();
    const reordered = { ...first, goalIds: ["goal-2", "goal-1"], approval: undefined, status: "draft" as const };
    const equivalent = { ...reordered, goalIds: ["goal-1", "goal-2"] };
    expect(useCaseApprovalHash(reordered)).toBe(useCaseApprovalHash(equivalent));
    expect(useCaseApprovalHash(first)).toBe(useCaseApprovalHash({ ...first, approval: { ...first.approval!, approvedAt: "2030-01-01T00:00:00.000Z" } }));
    expect(hasValidUseCaseApproval(first)).toBe(true);
  });

  it("invalidates approval when semantic content changes", () => {
    const previous = approvedUseCase();
    const changed = invalidateUseCaseApproval(previous, { ...previous, name: "Changed" });
    expect(changed).toMatchObject({ status: "draft" });
    expect(changed.approval).toBeUndefined();
  });

  it.each([
    ["draft", "approved", true], ["approved", "draft", true],
    ["draft", "draft", false], ["approved", "approved", false]
  ] as const)("transition %s to %s is %s", (from, to, expected) => {
    expect(canTransitionUseCase(from, to)).toBe(expected);
  });
});

describe("ordered Environment gates", () => {
  it("orders without mutating inputs", () => {
    const states = [{ id: "second", order: 2 }, { id: "first", order: 1 }];
    const actions = [{ id: "second", priority: 2 }, { id: "first", priority: 1 }];
    expect(orderedStates(states).map(({ id }) => id)).toEqual(["first", "second"]);
    expect(orderedActions(actions).map(({ id }) => id)).toEqual(["first", "second"]);
    expect(states[0].id).toBe("second");
  });

  it("accumulates duplicate, empty, draft, and missing direction issues", () => {
    const candidate = environment();
    candidate.states.push({ ...candidate.states[0], id: "state-2", actions: [] });
    candidate.states[0].actions.push({ ...candidate.states[0].actions[0], id: "action-2" });
    const brokenDirection = direction(approveUseCase({
      ...draftUseCase(), goalIds: ["missing"], adrIds: ["missing"], constraintIds: ["missing"]
    }, { approvedBy: "human-1", approvedAt: "2026-08-29T10:00:00.000Z", revision: 1 }));
    const codes = validateRunnableEnvironment(candidate, brokenDirection).map(({ code }) => code);
    expect(codes).toEqual(expect.arrayContaining([
      "duplicate_state_order", "duplicate_action_priority", "empty_state",
      "missing_goal_reference", "missing_adr_reference", "missing_constraint_reference"
    ]));
    expect(validateRunnableEnvironment(environment(), direction(draftUseCase())).map(({ code }) => code)).toContain("unapproved_use_case");
  });

  it("rejects a reference to a non-accepted direction item", () => {
    const candidate = direction();
    candidate.goals[0].status = "draft";
    expect(validateRunnableEnvironment(environment(), candidate).map(({ code }) => code)).toContain("inactive_goal_reference");
  });

  it("never dispatches beyond the first unfinished or blocked item", () => {
    const states = [state("s1", 1, "done"), state("s2", 2, "blocked"), state("s3", 3, "pending")];
    expect(nextRunnableState(states)).toBeUndefined();
    expect(nextRunnableState([state("s1", 1, "done"), state("s2", 2, "pending")])?.id).toBe("s2");
    const actions = [action("a1", 1, "done"), action("a2", 2, "working"), action("a3", 3, "pending")];
    expect(nextRunnableAction(actions)).toBeUndefined();
    expect(nextRunnableAction([action("a1", 1, "done"), action("a2", 2, "pending")])?.id).toBe("a2");
  });

  it.each([
    [0, 0, 1, 0, false], [0, 1, 0, 0, true],
    [1, 1, 1, 1, false], [1, 2, 0, 0, true],
    [3, 1, 3, 3, false], [3, 4, 0, 0, true],
    [20, 20, 1, 1, false], [20, 21, 0, 0, true]
  ])("computes maxRetries=%i attempts=%i", (maxRetries, attempts, remaining, retries, exhausted) => {
    expect(retryBudget(maxRetries, attempts)).toMatchObject({ attemptsRemaining: remaining, retriesRemaining: retries, exhausted });
  });

  it("derives mutually exclusive done and blocked flags", () => {
    expect(actionFlags("done")).toEqual({ done: true, blocked: false });
    expect(actionFlags("blocked")).toEqual({ done: false, blocked: true });
    expect(stateFlags([action("a", 1, "done")])).toEqual({ done: true, blocked: false });
    expect(stateFlags([action("a", 1, "blocked")])).toEqual({ done: false, blocked: true });
    expect(deriveStateStatus([action("a", 1, "done")])).toBe("done");
    expect(deriveStateStatus([action("a", 1, "pending")])).toBe("pending");
    expect(deriveEnvironmentStatus([state("s", 1, "done")])).toBe("completed");
    expect(deriveEnvironmentStatus([state("s", 1, "blocked")])).toBe("blocked");
  });
});

describe("Action instruction contract", () => {
  it("accumulates missing and empty required sections", () => {
    const issues = validateActionInstruction("# Task\n\n## Role\nworker\n");
    expect(issues.map(({ code }) => code)).toContain("empty_instruction_section");
    expect(issues.filter(({ code }) => code === "missing_instruction_section")).toHaveLength(6);
  });

  it("accepts all eight non-empty sections", () => {
    const headings = ["Task", "Role", "Goals", "Priorities", "Method", "Output contract", "Tool policy", "Acceptance evidence"];
    expect(validateActionInstruction(headings.map((heading) => `## ${heading}\nContent`).join("\n"))).toEqual([]);
  });
});

const state = (id: string, order: number, status: StateExecution["status"]): StateExecution => ({
  id, order, status, environmentRunId: "run", stateId: id, createdAt: "now", updatedAt: "now"
});

const action = (id: string, priority: number, status: ActionExecution["status"]): ActionExecution => ({
  id, priority, status, stateExecutionId: "state", actionId: id, workAttempts: 0, maxRetries: 1,
  createdAt: "now", updatedAt: "now"
});
