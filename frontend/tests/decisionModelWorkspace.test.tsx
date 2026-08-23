import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PolicyPreviewResultV3,
  ProjectRewardDecisionStrategyV3
} from "@shared/api/workspace-contracts";
import { DecisionModelWorkspace } from "../src/workspace/automation/DecisionModelWorkspace";

describe("Reward-MDP Decision Model workspace", () => {
  it("shows a visual policy pulse, transition impact and inspectable Q/V evidence", () => {
    const rendered = render(<DecisionModelWorkspace
      strategy={strategy()}
      issues={[]}
      preview={preview()}
      loading={false}
      locked={false}
      onStrategyChange={vi.fn()}
    />);
    expect(screen.getByText(/Reward-MDP v3/)).toBeInTheDocument();
    expect(screen.getByText("Decision pulse")).toBeInTheDocument();
    expect(screen.getByText("Policy horizon")).toBeInTheDocument();
    expect(screen.getByText("Transition impact")).toBeInTheDocument();
    expect(screen.getByText(/Policy landscape/)).toBeInTheDocument();
    expect(screen.getByText("Reward tuning")).toBeInTheDocument();
    expect(screen.getAllByText("50%")).toHaveLength(2);
    expect(screen.getAllByText(/default prior/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("42,000,000 micros").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/design-valid, 50%, \+124 reward units/)).toHaveClass("text-secondary");
    expect(screen.getByLabelText(/design-invalid, 50%, −25 reward units/)).toHaveClass("text-destructive");
    expect(rendered.container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.queryByText("25000000")).not.toBeInTheDocument();
  });

  it("keeps added GraphNodes visible until their transition model exists", () => {
    const model = strategy();
    model.capabilityModel.actions.push({ actionId: "review", guards: [] });
    render(<DecisionModelWorkspace
      strategy={model}
      actionOrder={["review", "design"]}
      issues={[]}
      preview={preview()}
      loading={false}
      locked={false}
      onStrategyChange={vi.fn()}
    />);

    const options = screen.getAllByRole("article").filter((article) =>
      article.textContent?.includes("transition model") || article.textContent?.includes("Q +42"));
    expect(options[0]).toHaveTextContent("review");
    expect(options[0]).toHaveTextContent("needs transition model");
    expect(options[1]).toHaveTextContent("design");
  });

  it("tunes human reward units and locks an immutable Run snapshot", async () => {
    const onStrategyChange = vi.fn();
    const rendered = render(<DecisionModelWorkspace
      strategy={strategy()}
      issues={[]}
      preview={preview()}
      loading={false}
      locked={false}
      onStrategyChange={onStrategyChange}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Increase action cost by 1 reward unit" }));
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
    expect(screen.getByRole("button", { name: "Increase action cost by 1 reward unit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decrease action cost by 1 reward unit" })).toBeDisabled();
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
