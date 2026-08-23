import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PolicyPreviewResultV3,
  ProjectRewardDecisionStrategyV3
} from "@shared/api/workspace-contracts";
import { DecisionModelWorkspace } from "../src/workspace/automation/DecisionModelWorkspace";

describe("Reward-MDP Decision Model workspace", () => {
  it("shows reward, factual acceptance, exact priors and compiled Q/V evidence", () => {
    render(<DecisionModelWorkspace
      strategy={strategy()}
      issues={[]}
      preview={preview()}
      loading={false}
      locked={false}
      onStrategyChange={vi.fn()}
    />);
    expect(screen.getByText(/Reward-MDP v3/)).toBeInTheDocument();
    expect(screen.getByText("Acceptance ledger contract")).toBeInTheDocument();
    expect(screen.getAllByText("default_prior")).toHaveLength(2);
    expect(screen.getByText("Compiled Q / V policy")).toBeInTheDocument();
    expect(screen.getByText("design=42000000")).toBeInTheDocument();
  });

  it("edits integer reward micros and locks an immutable Run snapshot", async () => {
    const onStrategyChange = vi.fn();
    const rendered = render(<DecisionModelWorkspace
      strategy={strategy()}
      issues={[]}
      preview={preview()}
      loading={false}
      locked={false}
      onStrategyChange={onStrategyChange}
    />);
    const cost = screen.getByLabelText("Action cost");
    fireEvent.change(cost, { target: { value: "2000000" } });
    expect(onStrategyChange.mock.calls.at(-1)?.[0].model.reward.actionCostMicros).toBe(2_000_000);

    rendered.rerender(<DecisionModelWorkspace
      strategy={strategy()}
      issues={[]}
      preview={preview()}
      loading={false}
      locked
      onStrategyChange={onStrategyChange}
    />);
    expect(screen.getByText("The immutable Run snapshot locks this model.")).toBeInTheDocument();
    expect(screen.getByLabelText("Action cost")).toBeDisabled();
  });
});

const strategy = (): ProjectRewardDecisionStrategyV3 => ({
  kind: "reward_mdp_v3",
  id: "reward-policy",
  description: "Reward policy",
  capabilityModel: {
    version: 3,
    outcomes: [
      { id: "design-valid", description: "Valid design", result: "PASS", penaltyClass: "none" },
      { id: "design-invalid", description: "Invalid design", result: "FAIL", penaltyClass: "invalid_design" }
    ],
    actions: [{ actionId: "design", guards: [] }]
  },
  model: {
    version: 3,
    discountPpm: 990_000,
    acceptance: { version: 1, obligations: [{ obligationId: "design", description: "Accepted design", weight: 1 }] },
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
      { id: "done", values: {}, verifiedObligationIds: ["design"], invalidatedObligationIds: [], terminal: "success" }
    ],
    stateActions: [{
      stateId: "open",
      actionId: "design",
      successors: [
        { outcomeId: "design-valid", nextStateId: "done", probabilityPpm: 500_000, provenance: "default_prior" },
        { outcomeId: "design-invalid", nextStateId: "open", probabilityPpm: 500_000, provenance: "default_prior" }
      ]
    }],
    solver: { algorithm: "discounted_value_iteration_v3", maxIterations: 1_000, convergenceToleranceMicros: 1 }
  }
});

const preview = (): PolicyPreviewResultV3 => ({
  issues: [],
  preview: {
    derived: true,
    persisted: false,
    state: {
      stateId: "open",
      features: {},
      verifiedProgressPpm: 0,
      featureVectorSha256: "vector",
      sourceStateRevision: 0,
      evidenceRefs: []
    },
    admissibleActionIds: ["design"],
    excludedActions: [],
    selectedActionId: "design",
    actionValues: [{ actionId: "design", qMicros: 42_000_000 }],
    expectedReturnMicros: 42_000_000,
    solverStatus: "compiled",
    modelVersion: 3,
    modelSha256: "model",
    policySha256: "policy",
    compiledPolicy: {
      version: 3,
      algorithm: "discounted_value_iteration_v3",
      status: "compiled",
      states: [{
        stateId: "open",
        selectedActionId: "design",
        valueMicros: 42_000_000,
        actionValues: [{ actionId: "design", qMicros: 42_000_000 }]
      }],
      iterations: 3,
      residualMicros: 1,
      modelSha256: "model",
      policySha256: "policy"
    }
  }
});
