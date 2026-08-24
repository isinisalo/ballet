import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PolicyPreviewResultV4,
  ProjectScopedRewardDecisionStrategyV4
} from "@shared/api/workspace-contracts";
import { DecisionModelWorkspace } from "../src/workspace/automation/DecisionModelWorkspace";

describe("hierarchical Reward-MDP Decision Model workspace", () => {
  it("renders one semantic 5×5 Q(s,a) grid with human-scale reward tones", () => {
    const nodes = scopeNodes(5);
    const strategy = strategyFor(nodes.map(({ id }) => id));
    const rendered = render(<DecisionModelWorkspace
      scope="graph"
      strategy={strategy}
      nodes={nodes.map((node, index) => ({ ...node, acceptanceObligationId: `obligation-${index + 1}` }))}
      acceptance={{ version: 1, obligations: nodes.map((_, index) => ({
        obligationId: `obligation-${index + 1}`, description: `Gate ${index + 1}`, weight: 1
      })) }}
      issues={[]}
      preview={previewFor(strategy, 42_000_000)}
      loading={false}
      locked={false}
      onStrategyChange={vi.fn()}
    />);

    expect(screen.getByRole("heading", { name: "5 states × 5 actions" })).toBeInTheDocument();
    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-rowcount", "6");
    expect(grid).toHaveAttribute("aria-colcount", "6");
    expect(screen.getByText("15/25")).toBeInTheDocument();
    expect(screen.getByText("Acceptance is a gate, not a policy state")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /reward units/ })).toHaveLength(15);
    expect(screen.getAllByLabelText(/unavailable/)).toHaveLength(10);
    expect(screen.getAllByTitle("42,000,000 micros").length).toBeGreaterThan(0);
    expect(rendered.container.querySelector("table")).not.toBeInTheDocument();
    expect(screen.queryByText("42000000")).not.toBeInTheDocument();
    const workspace = screen.getByRole("main", { name: "Graph Decision Model" });
    expect(workspace).toHaveClass("overflow-x-hidden");
    expect(workspace.firstElementChild).toHaveClass("grid-cols-[minmax(0,1fr)]");
  });

  it.each([[2, 3], [12, 78]])("renders a %i×%i local matrix with %i sparse cells", (size, modeled) => {
    const nodes = scopeNodes(size);
    const strategy = strategyFor(nodes.map(({ id }) => id));
    render(<DecisionModelWorkspace
      scope="graph_node"
      strategy={strategy}
      nodes={nodes}
      issues={[]}
      preview={previewFor(strategy, -4_000_000)}
      loading={false}
      locked={false}
      onStrategyChange={vi.fn()}
    />);
    expect(screen.getByRole("heading", { name: `${size} states × ${size} actions` })).toBeInTheDocument();
    expect(screen.getByText(`${modeled}/${size * size}`)).toBeInTheDocument();
    expect(screen.getByRole("grid")).toHaveAttribute("aria-rowcount", String(size + 1));
    expect(screen.getAllByRole("button", { name: /reward units/ })).toHaveLength(modeled);
  });

  it.each([
    ["graph", 40],
    ["graph_node", 17],
    ["graph_node", 64]
  ] as const)("keeps the %s %i×%i fixture inside its scrollable matrix viewport", (scope, size) => {
    const nodes = scopeNodes(size);
    const strategy = strategyFor(nodes.map(({ id }) => id));
    render(<DecisionModelWorkspace
      scope={scope}
      strategy={strategy}
      nodes={nodes}
      acceptance={scope === "graph" ? { version: 1, obligations: [] } : undefined}
      issues={[]}
      preview={previewFor(strategy, 1_000_000)}
      loading={false}
      locked={false}
      onStrategyChange={vi.fn()}
    />);
    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-rowcount", String(size + 1));
    expect(grid).toHaveAttribute("aria-colcount", String(size + 1));
    expect(grid.parentElement).toHaveClass("overflow-auto");
    if (size > 20) expect(screen.getAllByRole("row").length).toBeLessThan(size + 1);
  });
});

describe("hierarchical Reward-MDP Decision Model interaction", () => {
  it("zooms from a Graph column and supports arrow-key cell navigation", async () => {
    const onZoomNode = vi.fn();
    const nodes = scopeNodes(2);
    const strategy = strategyFor(nodes.map(({ id }) => id));
    render(<DecisionModelWorkspace
      scope="graph"
      strategy={strategy}
      nodes={nodes}
      acceptance={{ version: 1, obligations: [] }}
      issues={[]}
      preview={previewFor(strategy, 1_000_000)}
      loading={false}
      locked={false}
      onStrategyChange={vi.fn()}
      onZoomNode={onZoomNode}
    />);
    fireEvent.click(screen.getByTitle("Open Node 2 local Decision Model"));
    expect(onZoomNode).toHaveBeenCalledWith("node-2");
    const first = screen.getByRole("button", { name: /node-1 to node-1/ });
    fireEvent.keyDown(first, { key: "ArrowDown" });
    const next = screen.getByRole("button", { name: /node-2 to node-1/ });
    expect(next).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(next).toHaveFocus());
  });

  it("keeps keyboard focus when navigation renders the next virtualized row", async () => {
    const nodes = scopeNodes(40);
    const strategy = strategyFor(nodes.map(({ id }) => id));
    render(<DecisionModelWorkspace
      scope="graph"
      strategy={strategy}
      nodes={nodes}
      acceptance={{ version: 1, obligations: [] }}
      issues={[]}
      preview={previewFor(strategy, 1_000_000)}
      loading={false}
      locked={false}
      onStrategyChange={vi.fn()}
    />);
    const edge = screen.getByRole("button", { name: /node-20 to node-1:/ });
    edge.focus();
    fireEvent.keyDown(edge, { key: "ArrowDown" });
    const next = screen.getByRole("button", { name: /node-21 to node-1:/ });
    expect(next).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(next).toHaveFocus());
  });

  it("changes rewards in one-unit steps and locks controls during a Run", () => {
    const onStrategyChange = vi.fn();
    const nodes = scopeNodes(1);
    const strategy = strategyFor(["node-1"]);
    const rendered = render(<DecisionModelWorkspace
      scope="graph_node" strategy={strategy} nodes={nodes} issues={[]}
      preview={previewFor(strategy, 1_000_000)} loading={false} locked={false}
      onStrategyChange={onStrategyChange}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Action cost" }));
    expect(onStrategyChange.mock.calls.at(-1)?.[0].model.reward.actionCostMicros).toBe(2_000_000);

    rendered.rerender(<DecisionModelWorkspace
      scope="graph_node" strategy={strategy} nodes={nodes} issues={[]}
      preview={previewFor(strategy, 1_000_000)} loading={false} locked
      onStrategyChange={onStrategyChange}
    />);
    expect(screen.getByText("Run active")).toBeInTheDocument();
    const profile = screen.getByRole("heading", { name: "Reward profile" }).closest("section")!;
    expect(within(profile).getByRole("button", { name: "Increase Action cost" })).toBeDisabled();
    expect(within(profile).getByRole("button", { name: "Decrease Action cost" })).toBeDisabled();
  });
});

const scopeNodes = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: `node-${index + 1}`,
  description: `Node ${index + 1}`
}));

const strategyFor = (ids: string[]): ProjectScopedRewardDecisionStrategyV4 => ({
  kind: "reward_mdp_v4",
  id: "reward-policy",
  description: "Scoped reward policy",
  model: {
    version: 4,
    initialStateId: ids[0]!,
    discountPpm: 990_000,
    reward: {
      actionCostMicros: 1_000_000,
      terminalSuccessBonusMicros: 5_000_000,
      acceptanceProgressPotentialScaleMicros: 0,
      outcomePenaltyMicros: {
        none: 0, transient: 2_000_000, implementation_defect: 5_000_000,
        invalid_plan: 12_000_000, invalid_design: 25_000_000
      }
    },
    stateActions: ids.flatMap((stateId, stateIndex) => ids.slice(0, stateIndex + 1).map((actionId) => ({
      stateId,
      actionId,
      guards: [],
      successors: [{
        outcomeId: `${actionId}-pass`,
        target: stateIndex === ids.length - 1 && actionId === stateId
          ? { kind: "terminal" as const, terminal: "success" as const, emitOutcomeId: "complete" }
          : { kind: "state" as const, stateId: ids[Math.min(ids.length - 1, stateIndex + 1)]! },
        probabilityPpm: 1_000_000,
        provenance: "default_prior" as const,
        penaltyClass: "none" as const
      }]
    }))),
    solver: { algorithm: "discounted_value_iteration_v4", maxIterations: 10_000, convergenceToleranceMicros: 1 }
  }
});

const previewFor = (strategy: ProjectScopedRewardDecisionStrategyV4, qMicros: number): PolicyPreviewResultV4 => {
  const ids = [...new Set(strategy.model.stateActions.map(({ stateId }) => stateId))];
  const states = ids.map((stateId) => {
    const actions = strategy.model.stateActions.filter((row) => row.stateId === stateId).map(({ actionId }) => ({ actionId, qMicros }));
    return { stateId, selectedActionId: actions.at(-1)!.actionId, valueMicros: qMicros, actionValues: actions };
  });
  return { issues: [], preview: {
    derived: true,
    persisted: false,
    scope: "graph_node",
    state: { scope: "graph_node", stateId: strategy.model.initialStateId, acceptanceProgressPpm: 0, sourceStateRevision: 0, evidenceRefs: [] },
    admissibleActionIds: states[0]!.actionValues.map(({ actionId }) => actionId),
    excludedActions: [],
    selectedActionId: states[0]!.selectedActionId,
    actionValues: states[0]!.actionValues,
    expectedReturnMicros: qMicros,
    solverStatus: "compiled",
    modelVersion: 4,
    modelSha256: "model",
    policySha256: "policy",
    compiledPolicy: {
      version: 4, scope: "graph_node", graphNodeId: "fixture", algorithm: "discounted_value_iteration_v4",
      status: "compiled", initialStateId: strategy.model.initialStateId, stateIds: ids,
      actionIds: ids, states, iterations: 3, residualMicros: 1, modelSha256: "model", policySha256: "policy"
    }
  } };
};
