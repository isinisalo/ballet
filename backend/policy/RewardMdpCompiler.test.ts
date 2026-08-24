import { describe, expect, it } from "vitest";
import type { ProjectScopedRewardDecisionModelV4 } from "../../shared/domain/decisionModel.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";
import { acceptanceProgressCatalog } from "./DecisionStateProjector.js";
import { compilePolicyScope, policyGuardContext } from "./PolicyScope.js";
import { compileRewardPolicy, rewardBreakdown, type CompileRewardPolicyInput } from "./RewardMdpCompiler.js";

describe("hierarchical Reward-MDP compiler", () => {
  it("compiles a deterministic sparse 2×2 lower-triangle policy", () => {
    const compiled = compileRewardPolicy(fixture());
    expect(compiled).toMatchObject({
      version: 4,
      scope: "graph_node",
      status: "compiled",
      initialStateId: "first",
      stateIds: ["first", "second"],
      actionIds: ["first", "second"]
    });
    expect(compiled.states).toHaveLength(2);
    expect(compiled.states.map(({ selectedActionId }) => selectedActionId)).toEqual(["first", "second"]);
  });

  it("rejects duplicate typed outcomes in one state/action cell", () => {
    const input = fixture();
    input.model.stateActions[0]!.successors[1]!.outcomeId = "pass";
    expect(compileRewardPolicy(input)).toMatchObject({
      status: "policy_model_invalid",
      message: expect.stringContaining("must be unique")
    });
  });

  it("requires exact 1,000,000 ppm probability mass", () => {
    const input = fixture();
    input.model.stateActions[0]!.successors[0]!.probabilityPpm = 799_999;
    expect(compileRewardPolicy(input)).toMatchObject({
      status: "policy_model_invalid",
      message: expect.stringContaining("1,000,000 ppm")
    });
  });

  it("requires an explicit initial state derived from the owned nodes", () => {
    const input = fixture();
    input.model.initialStateId = "free-floating-state";
    expect(compileRewardPolicy(input)).toMatchObject({
      status: "policy_model_invalid",
      message: expect.stringContaining("outside the decision scope")
    });
  });

  it("blocks a newly added node until its required lower-triangle cells are authored", () => {
    const input = fixture();
    input.stateIds = ["first", "second", "third"];
    input.actionIds = ["first", "second", "third"];
    input.outcomeIdsByAction = { ...input.outcomeIdsByAction, third: ["pass", "fail"] };
    input.admissibleActionsByState = { ...input.admissibleActionsByState, third: ["first", "second", "third"] };
    input.acceptanceProgressPpmByState = { ...input.acceptanceProgressPpmByState, third: 0 };
    expect(compileRewardPolicy(input)).toMatchObject({
      status: "policy_model_invalid",
      message: expect.stringContaining("third has no authored action cell")
    });
  });

  it("forbids acceptance progress shaping inside a Graph Node-local policy", () => {
    const input = fixture();
    input.model.reward.acceptanceProgressPotentialScaleMicros = 1;
    expect(compileRewardPolicy(input)).toMatchObject({
      status: "policy_model_invalid",
      message: expect.stringContaining("cannot include acceptance progress")
    });
  });

  it("gives no progress reward for an unchanged acceptance potential", () => {
    const model = fixture().model;
    const branch = model.stateActions[0]!.successors[0]!;
    expect(rewardBreakdown(model, 500_000, 500_000, branch).acceptanceProgressDeltaPpm).toBe(0);
    expect(rewardBreakdown(model, 0, 500_000, branch).acceptanceProgressDeltaPpm).toBe(500_000);
  });

  it("does not mint Graph progress for an unbound Graph Node or a local Action Node split", () => {
    const graph = structuredClone(new ProjectConfigurationRepository().load(".").config!.graph);
    const before = acceptanceProgressCatalog(graph);
    const unbound = structuredClone(graph.graphNodes[0]!);
    unbound.id = "unbound-node";
    delete unbound.acceptanceObligationId;
    graph.graphNodes.splice(1, 0, unbound);
    const after = acceptanceProgressCatalog(graph);
    for (const node of graph.graphNodes.filter(({ id }) => id !== unbound.id)) {
      expect(after[node.id]).toBe(before[node.id]);
    }
    expect(after[unbound.id]).toBe(before.plan);

    const model = fixture().model;
    const nonTerminal = model.stateActions[0]!.successors[0]!;
    expect(rewardBreakdown(model, 0, 0, nonTerminal)).toMatchObject({
      acceptanceProgressDeltaPpm: 0,
      potentialDeltaMicros: 0,
      terminalSuccessBonusMicros: 0
    });
    const terminal = model.stateActions.at(-1)!.successors[0]!;
    expect(rewardBreakdown(model, 0, 0, terminal).terminalSuccessBonusMicros)
      .toBe(model.reward.terminalSuccessBonusMicros);
  });

  it("loads the default 5×5, Plan 2×2 and Design 12×12 policies", () => {
    const config = new ProjectConfigurationRepository().load(".").config!;
    const entries = config.graph.acceptance.obligations.map(({ obligationId, weight }) => ({
      obligationId, weight, status: "pending" as const, evidenceRefs: []
    }));
    const authorization = { version: 1 as const, facts: {}, sha256: jsonSha256({}) };
    const ledger = { version: 1 as const, entries, sha256: jsonSha256(entries) };
    const context = policyGuardContext({
      graphState: config.graph.state.initial, stateRevision: 0, authorization, acceptanceLedger: ledger
    });
    const global = compilePolicyScope(config.graph, "graph", context);
    const plan = compilePolicyScope(config.graph, "graph_node", context, "plan");
    const design = compilePolicyScope(config.graph, "graph_node", context, "design");
    expect(global).toMatchObject({ status: "compiled", stateIds: ["design", "plan", "build", "deploy", "verify"] });
    expect(global.states.flatMap(({ actionValues }) => actionValues)).toHaveLength(15);
    expect(plan.states).toHaveLength(2);
    expect(plan.states.flatMap(({ actionValues }) => actionValues)).toHaveLength(3);
    expect(design.states).toHaveLength(12);
    expect(design.states.flatMap(({ actionValues }) => actionValues)).toHaveLength(78);
    expect(acceptanceProgressCatalog(config.graph)).toMatchObject({ design: 0, plan: 200_000, build: 400_000 });
  });
});

function fixture(): CompileRewardPolicyInput {
  const model: ProjectScopedRewardDecisionModelV4 = {
    version: 4,
    initialStateId: "first",
    discountPpm: 900_000,
    reward: {
      actionCostMicros: 1_000_000,
      terminalSuccessBonusMicros: 5_000_000,
      acceptanceProgressPotentialScaleMicros: 0,
      outcomePenaltyMicros: {
        none: 0, transient: 1_000_000, implementation_defect: 2_000_000,
        invalid_plan: 3_000_000, invalid_design: 4_000_000
      }
    },
    stateActions: [
      row("first", "first", { kind: "state", stateId: "second" }, { kind: "state", stateId: "first" }),
      row("second", "first", { kind: "state", stateId: "second" }, { kind: "state", stateId: "first" }),
      row("second", "second", { kind: "terminal", terminal: "success", emitOutcomeId: "complete" }, { kind: "state", stateId: "second" })
    ],
    solver: { algorithm: "discounted_value_iteration_v4", maxIterations: 10_000, convergenceToleranceMicros: 1 }
  };
  return {
    scope: "graph_node",
    graphNodeId: "plan",
    model,
    stateIds: ["first", "second"],
    actionIds: ["first", "second"],
    outcomeIdsByAction: { first: ["pass", "fail"], second: ["pass", "fail"] },
    terminalOutcomeIds: ["complete", "failed"],
    admissibleActionsByState: { first: ["first"], second: ["first", "second"] },
    acceptanceProgressPpmByState: { first: 0, second: 0 },
    modelSha256: "model-sha"
  };
}

function row(
  stateId: string,
  actionId: string,
  passTarget: ProjectScopedRewardDecisionModelV4["stateActions"][number]["successors"][number]["target"],
  failTarget: ProjectScopedRewardDecisionModelV4["stateActions"][number]["successors"][number]["target"]
) {
  return {
    stateId,
    actionId,
    guards: [],
    successors: [
      { outcomeId: "pass", target: passTarget, probabilityPpm: 800_000, provenance: "default_prior" as const, penaltyClass: "none" as const },
      { outcomeId: "fail", target: failTarget, probabilityPpm: 200_000, provenance: "default_prior" as const, penaltyClass: "transient" as const }
    ]
  };
}
