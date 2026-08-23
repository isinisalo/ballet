import { describe, expect, it } from "vitest";
import type { DecisionOptionModelRowV2, ProjectSspDecisionModelV2 } from "../../shared/domain/decisionModel.js";
import { solvePolicy } from "./SspPolicySolver.js";

const row = (
  stateId: string, actionId: string, expectedCostMicros: number, successors: Array<[string, number]>
): DecisionOptionModelRowV2 => ({
  stateId, actionId, expectedCostMicros,
  successors: successors.map(([expectedNextStateId, probabilityPpm], index) => ({
    outcomeId: `${actionId}-outcome-${index + 1}`, expectedNextStateId, probabilityPpm
  }))
});

const model = (rows: DecisionOptionModelRowV2[], extraStates: string[] = []): ProjectSspDecisionModelV2 => ({
  version: 2,
  features: [{ id: "phase", domain: ["active"], missingValue: "active", source: { kind: "runtime", fact: "epoch_kind" } }],
  states: [
    { id: "start", values: { phase: "active" } },
    ...extraStates.map((id) => ({ id, values: { phase: "active" } })),
    { id: "success", values: { phase: "active" }, terminal: "success" as const },
    { id: "failure", values: { phase: "active" }, terminal: "failure" as const },
    { id: "blocked", values: { phase: "active" }, terminal: "blocked" as const }
  ],
  stateActions: rows,
  solver: { algorithm: "ssp_value_iteration_v2", epsilon: 1e-9, maxIterations: 10_000, maxSolveMillis: 2_000 },
  projection: { maxDecisionEpochs: 20, maxProjectionNodes: 100 }
});

const solve = (value: ProjectSspDecisionModelV2, currentStateId = "start", override?: Record<string, string[]>) => solvePolicy({
  model: value, currentStateId,
  admissibleActionsByState: override ?? Object.fromEntries(value.states.map((state) => [
    state.id, value.stateActions.filter((candidate) => candidate.stateId === state.id).map(({ actionId }) => actionId)
  ])), modelSha256: "model-hash"
});

describe("finite undiscounted outcome-aware SSP value iteration", () => {
  it("solves one deterministic action analytically", () => {
    const solution = solve(model([row("start", "prototype", 7, [["success", 1_000_000]])]));
    expect(solution).toMatchObject({ status: "converged", selectedActionId: "prototype", stateValueMicros: 7 });
    expect(solution.actionValues).toEqual([{ actionId: "prototype", qMicros: 7 }]);
  });

  it("selects the lower expected cost of two actions", () => {
    const solution = solve(model([
      row("start", "package", 13, [["success", 1_000_000]]),
      row("start", "security-check", 5, [["success", 1_000_000]])
    ]));
    expect(solution.selectedActionId).toBe("security-check");
    expect(solution.actionValues).toEqual([{ actionId: "package", qMicros: 13 }, { actionId: "security-check", qMicros: 5 }]);
  });

  it("rejects a deceptively cheap stochastic detour in favor of the global optimum", () => {
    const solution = solve(model([
      row("start", "discover", 1, [["expensive", 900_000], ["success", 100_000]]),
      row("start", "publish", 5, [["success", 1_000_000]]),
      row("expensive", "prototype", 100, [["success", 1_000_000]])
    ], ["expensive"]));
    expect(solution.selectedActionId).toBe("publish");
    expect(solution.actionValues.find(({ actionId }) => actionId === "discover")?.qMicros).toBeCloseTo(91, 9);
  });

  it("solves a retry self-loop", () => {
    const solution = solve(model([row("start", "prototype", 2, [["start", 500_000], ["success", 500_000]])]));
    expect(solution).toMatchObject({ status: "converged" });
    expect(solution.stateValueMicros).toBeCloseTo(4, 8);
  });

  it("distinguishes unreachable success from absence of an almost-sure proper policy", () => {
    expect(solve(model([row("start", "discover", 1, [["start", 1_000_000]])])).status).toBe("policy_goal_unreachable");
    expect(solve(model([row("start", "discover", 1, [["success", 500_000], ["failure", 500_000]])])).status).toBe("policy_no_proper_policy");
  });

  it("rejects malformed probability distributions", () => {
    expect(solve(model([row("start", "discover", 1, [["success", 999_999]])])).status).toBe("policy_model_invalid");
  });

  it("uses stable action IDs for epsilon ties independent of row order", () => {
    const first = model([row("start", "publish", 5, [["success", 1_000_000]]), row("start", "package", 5, [["success", 1_000_000]])]);
    const second = { ...first, stateActions: [...first.stateActions].reverse() };
    expect(solve(first)).toMatchObject({ selectedActionId: "package", tiedActionIds: ["package", "publish"] });
    expect(solve(second)).toMatchObject({ selectedActionId: "package", tiedActionIds: ["package", "publish"] });
  });

  it("fails explicitly when the convergence bound is exhausted", () => {
    const value = model([row("start", "prototype", 2, [["start", 500_000], ["success", 500_000]])]);
    value.solver.maxIterations = 1;
    expect(solve(value)).toMatchObject({ status: "policy_not_converged", iterations: 1 });
  });

  it("never evaluates an action removed from the hard admissible set", () => {
    const solution = solve(model([
      row("start", "cheap-but-denied", 1, [["success", 1_000_000]]),
      row("start", "allowed", 20, [["success", 1_000_000]])
    ]), "start", { start: ["allowed"], success: [], failure: [], blocked: [] });
    expect(solution.actionValues).toEqual([{ actionId: "allowed", qMicros: 20 }]);
  });

  it("rejects a model that exceeds the configured action bound", () => {
    const rows = Array.from({ length: 65 }, (_, index) => row("start", `option-${String(index).padStart(2, "0")}`, 1, [["success", 1_000_000]]));
    expect(solve(model(rows)).status).toBe("policy_model_invalid");
  });
});
