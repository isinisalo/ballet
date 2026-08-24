import { describe, expect, it } from "vitest";
import type { ProjectScopedRewardDecisionStrategyV4 } from "../../shared/domain/decisionModel.js";
import { resolveAdmissibleActions } from "./AdmissibleActionResolver.js";

describe("Reward-MDP guards", () => {
  it("classifies authorization denials without a separate capability-action catalog", () => {
    const strategy = fixture();
    const result = resolveAdmissibleActions(strategy, "deploy", ["deploy"], context(false, "ready"));
    expect(result).toEqual({
      actionIds: [],
      excludedActions: [{ actionId: "deploy", reasonCode: "authorization_denied" }]
    });
  });

  it("admits the same derived node action when authorization and project-state guards match", () => {
    expect(resolveAdmissibleActions(fixture(), "deploy", ["deploy"], context(true, "ready"))).toEqual({
      actionIds: ["deploy"], excludedActions: []
    });
  });

  it("distinguishes a project-state guard denial", () => {
    expect(resolveAdmissibleActions(fixture(), "deploy", ["deploy"], context(true, "draft"))).toEqual({
      actionIds: [], excludedActions: [{ actionId: "deploy", reasonCode: "guard_denied" }]
    });
  });
});

const context = (authorized: boolean, releaseStatus: string) => ({
  stateRevision: 0,
  projectState: { releaseStatus },
  authorization: { version: 1 as const, facts: { externalWritesAuthorized: authorized }, sha256: "auth" },
  acceptanceLedger: { version: 1 as const, entries: [], sha256: "ledger" },
  evidenceRefs: []
});

const fixture = (): ProjectScopedRewardDecisionStrategyV4 => ({
  kind: "reward_mdp_v4",
  id: "deploy-local",
  description: "Deploy guard fixture.",
  model: {
    version: 4,
    initialStateId: "deploy",
    discountPpm: 990_000,
    reward: {
      actionCostMicros: 1, terminalSuccessBonusMicros: 2, acceptanceProgressPotentialScaleMicros: 0,
      outcomePenaltyMicros: { none: 0, transient: 1, implementation_defect: 1, invalid_plan: 1, invalid_design: 1 }
    },
    stateActions: [{
      stateId: "deploy",
      actionId: "deploy",
      guards: [
        { source: { kind: "authorization", pointer: "/externalWritesAuthorized" }, allowedValues: [true] },
        { source: { kind: "project_state", pointer: "/releaseStatus" }, allowedValues: ["ready"] }
      ],
      successors: [{
        outcomeId: "pass",
        target: { kind: "terminal", terminal: "success", emitOutcomeId: "complete" },
        probabilityPpm: 1_000_000,
        provenance: "authored_evidence",
        penaltyClass: "none"
      }]
    }],
    solver: { algorithm: "discounted_value_iteration_v4", maxIterations: 100, convergenceToleranceMicros: 1 }
  }
});
