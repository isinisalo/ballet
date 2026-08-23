import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import type {
  ProjectCapabilityModelV3,
  ProjectRewardDecisionModelV3
} from "../../shared/domain/decisionModel.js";
import { decisionModelSha256 } from "./DecisionModelCanonical.js";
import { compileRewardPolicy, rewardBreakdown, stateProgressPpm } from "./RewardMdpCompiler.js";

describe("RewardMdpCompiler", () => {
  it("uses outcome-specific penalties in Q even when next state is identical", () => {
    const { model, capabilityModel } = fixture();
    const compiled = compileRewardPolicy({
      model,
      capabilityModel,
      admissibleActionsByState: { open: ["safe", "defective"], done: [] },
      modelSha256: decisionModelSha256(model)
    });
    expect(compiled.status).toBe("compiled");
    const values = compiled.states[0]!.actionValues;
    expect(values.find(({ actionId }) => actionId === "safe")!.qMicros)
      .toBeGreaterThan(values.find(({ actionId }) => actionId === "defective")!.qMicros);
    expect(rewardBreakdown(model, capabilityModel, model.states[0]!, model.states[1]!, "defect").outcomePenaltyMicros)
      .toBe(5_000_000);
  });

  it("produces identical policy/hash/Q/V for reordered model arrays", () => {
    const { model, capabilityModel } = fixture();
    const compile = (candidateModel: ProjectRewardDecisionModelV3, candidateCapability: ProjectCapabilityModelV3) =>
      compileRewardPolicy({
        model: candidateModel,
        capabilityModel: candidateCapability,
        admissibleActionsByState: { open: ["defective", "safe"], done: [] },
        modelSha256: "canonical-model"
      });
    const baseline = compile(model, capabilityModel);
    const reordered = compile({
      ...model,
      states: [...model.states].reverse(),
      stateActions: [...model.stateActions].reverse()
    }, {
      ...capabilityModel,
      outcomes: [...capabilityModel.outcomes].reverse(),
      actions: [...capabilityModel.actions].reverse()
    });
    expect(reordered).toEqual(baseline);
  });

  it("rejects a selected nonterminal recurrent class", () => {
    const { model, capabilityModel } = fixture();
    model.reward = {
      ...model.reward,
      progressPotentialScaleMicros: 0,
      completionBonusMicros: 0,
      outcomePenaltyMicros: { ...model.reward.outcomePenaltyMicros, invalid_design: 200_000_000 }
    };
    capabilityModel.outcomes.push({
      id: "loop",
      description: "Loop",
      result: "FAIL",
      penaltyClass: "none"
    });
    capabilityModel.actions.push({ actionId: "loop", guards: [] });
    model.stateActions.push({
      stateId: "open",
      actionId: "loop",
      successors: [{ outcomeId: "loop", nextStateId: "open", probabilityPpm: 1_000_000, provenance: "default_prior" }]
    });
    capabilityModel.outcomes[0]!.penaltyClass = "invalid_design";
    capabilityModel.outcomes[1]!.penaltyClass = "invalid_design";
    const compiled = compileRewardPolicy({
      model,
      capabilityModel,
      admissibleActionsByState: { open: ["safe", "defective", "loop"], done: [] },
      modelSha256: "recurrent"
    });
    expect(compiled.status).toBe("policy_no_proper_policy");
  });

  it("loads exact symmetric default priors and factual progress from the v18 default Graph", () => {
    const project = projectConfigSchema.parse(JSON.parse(readFileSync(".ballet/project.json", "utf8")));
    const model = project.graph.strategy.model;
    expect(model.stateActions.every(({ successors }) =>
      successors.reduce((sum, branch) => sum + branch.probabilityPpm, 0) === 1_000_000
      && successors.every(({ provenance }) => provenance === "default_prior"))).toBe(true);
    const verified = model.states.find(({ id }) => id === "ledger-vpppp")!;
    const invalidated = model.states.find(({ id }) => id === "ledger-ipppp")!;
    expect(stateProgressPpm(model, verified)).toBe(200_000);
    expect(stateProgressPpm(model, invalidated)).toBe(0);
  });

  it("reports zero factual progress delta for duplicate verification and a negative delta for invalidation", () => {
    const { model, capabilityModel } = fixture();
    const verified = { id: "verified", values: {}, verifiedObligationIds: ["goal"], invalidatedObligationIds: [] };
    const invalidated = { id: "invalidated", values: {}, verifiedObligationIds: [], invalidatedObligationIds: ["goal"] };
    expect(rewardBreakdown(model, capabilityModel, verified, verified, "ok").verifiedProgressDeltaPpm).toBe(0);
    expect(rewardBreakdown(model, capabilityModel, verified, invalidated, "ok").verifiedProgressDeltaPpm).toBe(-1_000_000);
  });
});

const fixture = (): { model: ProjectRewardDecisionModelV3; capabilityModel: ProjectCapabilityModelV3 } => ({
  capabilityModel: {
    version: 3,
    outcomes: [
      { id: "ok", description: "OK", result: "PASS", penaltyClass: "none" },
      { id: "defect", description: "Defect", result: "PASS", penaltyClass: "implementation_defect" }
    ],
    actions: [{ actionId: "safe", guards: [] }, { actionId: "defective", guards: [] }]
  },
  model: {
    version: 3,
    discountPpm: 990_000,
    acceptance: { version: 1, obligations: [{ obligationId: "goal", description: "Goal", weight: 1 }] },
    reward: {
      actionCostMicros: 1_000_000,
      completionBonusMicros: 25_000_000,
      progressPotentialScaleMicros: 100_000_000,
      outcomePenaltyMicros: {
        none: 0,
        transient: 2_000_000,
        implementation_defect: 5_000_000,
        invalid_plan: 12_000_000,
        invalid_design: 25_000_000
      }
    },
    features: [],
    states: [
      { id: "open", values: {}, verifiedObligationIds: [], invalidatedObligationIds: [] },
      { id: "done", values: {}, verifiedObligationIds: ["goal"], invalidatedObligationIds: [], terminal: "success" }
    ],
    stateActions: [
      { stateId: "open", actionId: "safe", successors: [{ outcomeId: "ok", nextStateId: "done", probabilityPpm: 1_000_000, provenance: "default_prior" }] },
      { stateId: "open", actionId: "defective", successors: [{ outcomeId: "defect", nextStateId: "done", probabilityPpm: 1_000_000, provenance: "default_prior" }] }
    ],
    solver: { algorithm: "discounted_value_iteration_v3", maxIterations: 10_000, convergenceToleranceMicros: 1 }
  }
});
