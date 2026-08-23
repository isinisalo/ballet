import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PolicyPreviewResultV2, ProjectIntrinsicOutcome, ProjectSspDecisionStrategyV2
} from "@shared/api/workspace-contracts";
import { DecisionModelWorkspace } from "../src/workspace/automation/DecisionModelWorkspace";

describe("Decision Model dashboard", () => {
  beforeEach(() => Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 }));

  it("renders arbitrary configured actions, ranks Q evidence, and opens the exact selected rule", async () => {
    const user = userEvent.setup();
    const onStrategyChange = vi.fn();
    renderWorkspace(onStrategyChange);

    const headers = screen.getAllByRole("columnheader").slice(1).map((header) => header.textContent);
    expect(headers).toEqual(["alphaAlpha action", "omegaOmega action", "route-xRouting action", "manual-reviewHuman review"]);
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText("Guard denied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add rule for state open and action route-x" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit rule for state open and action omega" }));
    const inspector = screen.getByRole("complementary", { name: "open → omega decision rule inspector" });
    expect(within(inspector).getByText("open → omega")).toBeInTheDocument();
    expect(within(inspector).getByText("Derived Q(s,a)")).toBeInTheDocument();
    expect(within(inspector).getByText("100%")).toBeInTheDocument();
    expect(within(inspector).getByText("No rule-level problems detected.")).toBeInTheDocument();
    await user.clear(within(inspector).getByLabelText("Configured cost"));
    await user.type(within(inspector).getByLabelText("Configured cost"), "7.25");
    expect(onStrategyChange.mock.calls.at(-1)?.[0].model.stateActions[0].expectedCostMicros).toBe(7_250_000);
  });

  it("opens focused rule editing in a narrow Sheet without hiding matrix actions", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    renderWorkspace(vi.fn());
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "Edit rule for state open and action omega" }));
    expect(await screen.findByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});

function renderWorkspace(onStrategyChange: (strategy: ProjectSspDecisionStrategyV2) => void) {
  return render(<DecisionModelWorkspace scopeKey="graph" strategy={strategy()} actionContracts={contracts()} issues={[]} preview={preview()} loading={false} locked={false} onStrategyChange={onStrategyChange} onRepairChange={vi.fn()} />);
}

const contracts = () => [
  contract("alpha", "Alpha action"), contract("omega", "Omega action"),
  contract("route-x", "Routing action"), contract("manual-review", "Human review")
];
const contract = (id: string, description: string): { id: string; description: string; outcomes: ProjectIntrinsicOutcome[] } => ({
  id, description, outcomes: [{ outcomeId: `${id}-ok`, result: "PASS", description: `${id} succeeds` }]
});

const strategy = (): ProjectSspDecisionStrategyV2 => ({
  kind: "ssp_v2", id: "arbitrary-policy", description: "Arbitrary scoped policy",
  capabilityModel: {
    version: 2, outcomes: contracts().map(({ id }) => ({ id: `${id}-ok`, description: `${id} succeeds` })),
    actions: [
      { actionId: "alpha", guards: [{ featureId: "mode", allowedValues: ["closed"] }] },
      { actionId: "omega", guards: [] }, { actionId: "route-x", guards: [] }, { actionId: "manual-review", guards: [] }
    ]
  },
  model: {
    version: 2,
    features: [{ id: "mode", domain: ["open", "closed"], missingValue: "open", source: { kind: "project_state", pointer: "/mode" } }],
    states: [{ id: "open", values: { mode: "open" } }, { id: "done", values: { mode: "closed" }, terminal: "success" }],
    stateActions: [{ stateId: "open", actionId: "omega", expectedCostMicros: 5_000_000, successors: [{ outcomeId: "omega-ok", expectedNextStateId: "done", probabilityPpm: 1_000_000 }] }],
    solver: { algorithm: "ssp_value_iteration_v2", epsilon: 0.000001, maxIterations: 1000, maxSolveMillis: 250 },
    projection: { maxDecisionEpochs: 8, maxProjectionNodes: 64 }
  }
});

const preview = (): PolicyPreviewResultV2 => ({ issues: [], preview: {
  derived: true, persisted: false, scope: "graph", scopeKey: "graph",
  state: { stateId: "open", features: { mode: "open" }, featureVectorSha256: "vector", sourceStateRevision: 2, evidenceRefs: [] },
  admissibleActionIds: ["omega", "route-x", "manual-review"], excludedActions: [{ actionId: "alpha", reasonCode: "guard_denied" }],
  selectedActionId: "omega", actionValues: [{ actionId: "route-x", qMicros: 8_000_000 }, { actionId: "omega", qMicros: 6_000_000 }],
  expectedRemainingCostMicros: 6_000_000, solverStatus: "converged", modelVersion: 2, modelSha256: "hash"
} });
