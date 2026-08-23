import { describe, expect, it } from "vitest";
import type { ProjectRewardDecisionStrategyV3 } from "../../shared/domain/decisionModel.js";
import { resolveAdmissibleActions } from "./AdmissibleActionResolver.js";
import { projectDecisionState } from "./DecisionStateProjector.js";

describe("Reward-MDP hard authorization", () => {
  it("projects the immutable authorization snapshot instead of spoofable project State", () => {
    const strategy = fixture();
    const state = projectDecisionState(strategy.model, {
      epochKind: "start",
      actionInvocationCount: 0,
      stateRevision: 0,
      projectState: { deployAuthorized: true },
      authorization: { version: 1, facts: { deployAuthorized: false }, sha256: "auth" },
      acceptanceLedger: {
        version: 1,
        entries: [{ obligationId: "goal", weight: 1, status: "pending", evidenceRefs: [] }],
        sha256: "ledger"
      },
      evidenceRefs: []
    });
    expect(state.stateId).toBe("denied");
    const actions = resolveAdmissibleActions(strategy, state, ["deploy"]);
    expect(actions.actionIds).toEqual([]);
    expect(actions.excludedActions).toEqual([{ actionId: "deploy", reasonCode: "authorization_denied" }]);
  });
});

const fixture = (): ProjectRewardDecisionStrategyV3 => ({
  kind: "reward_mdp_v3",
  id: "authorization",
  description: "Authorization fixture",
  capabilityModel: {
    version: 3,
    outcomes: [{ id: "deployed", description: "Deployed", result: "PASS", penaltyClass: "none" }],
    actions: [{ actionId: "deploy", guards: [{ featureId: "authorized", allowedValues: ["true"] }] }]
  },
  model: {
    version: 3,
    discountPpm: 990_000,
    acceptance: { version: 1, obligations: [{ obligationId: "goal", description: "Goal", weight: 1 }] },
    reward: {
      actionCostMicros: 1,
      completionBonusMicros: 25,
      progressPotentialScaleMicros: 100,
      outcomePenaltyMicros: { none: 0, transient: 2, implementation_defect: 5, invalid_plan: 12, invalid_design: 25 }
    },
    features: [{
      id: "authorized",
      domain: ["false", "true"],
      missingValue: "false",
      source: { kind: "authorization", pointer: "/deployAuthorized" }
    }],
    states: [
      { id: "denied", values: { authorized: "false" }, verifiedObligationIds: [], invalidatedObligationIds: [] },
      { id: "allowed", values: { authorized: "true" }, verifiedObligationIds: [], invalidatedObligationIds: [] },
      { id: "done-false", values: { authorized: "false" }, verifiedObligationIds: ["goal"], invalidatedObligationIds: [], terminal: "success" },
      { id: "done-true", values: { authorized: "true" }, verifiedObligationIds: ["goal"], invalidatedObligationIds: [], terminal: "success" }
    ],
    stateActions: [
      { stateId: "denied", actionId: "deploy", successors: [{ outcomeId: "deployed", nextStateId: "done-false", probabilityPpm: 1_000_000, provenance: "default_prior" }] },
      { stateId: "allowed", actionId: "deploy", successors: [{ outcomeId: "deployed", nextStateId: "done-true", probabilityPpm: 1_000_000, provenance: "default_prior" }] }
    ],
    solver: { algorithm: "discounted_value_iteration_v3", maxIterations: 100, convergenceToleranceMicros: 1 }
  }
});
