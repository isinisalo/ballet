import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProjectAutomationConfig, type AppData, type ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { AutomationView } from "../src/workspace/automation/AutomationView";
import { emptyData } from "../src/workspace/types";
import { projectInstruction } from "./projectInstructionFixture";

describe("Automation Action flow integration", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });
  it("opens the matching inspector from Take action and Verify Result", async () => {
    const user = userEvent.setup();
    render(<AutomationView
      data={appData()}
      level="action_node"
      graphNodeId="graph-node"
      actionNodeId="job"
      saveAutomation={vi.fn(async (value) => value)}
      navigate={vi.fn()}
      setNavigationBlocker={vi.fn()}
    />);

    expect(screen.getByRole("region", { name: "Action flow job" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByText("Action Node · job")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Work Node, work" }));
    const workInspector = screen.getByRole("complementary", { name: "Work inspector" });
    expect(within(workInspector).getByText("Work · work")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Validation Node, validation" }));
    const validationInspector = screen.getByRole("complementary", { name: "Validation inspector" });
    expect(within(validationInspector).getByText("Validation · validation")).toBeInTheDocument();
  });

  it("uses MDP action terminology on the Graph Node authoring level", () => {
    render(<AutomationView
      data={appData()}
      level="graph_node"
      graphNodeId="graph-node"
      saveAutomation={vi.fn(async (value) => value)}
      navigate={vi.fn()}
      setNavigationBlocker={vi.fn()}
    />);

    expect(screen.getByText("Action Nodes and local Reward-MDP")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action Nodes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decision Model" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Action Node" })).toBeInTheDocument();
  });

  it("opens the same Work settings in a narrow-viewport Sheet", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    render(<AutomationView
      data={appData()}
      level="action_node"
      graphNodeId="graph-node"
      actionNodeId="job"
      saveAutomation={vi.fn(async (value) => value)}
      navigate={vi.fn()}
      setNavigationBlocker={vi.fn()}
    />);

    await user.click(screen.getByRole("button", { name: "Work Node, work" }));
    expect(await screen.findByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Work inspector" })).not.toBeInTheDocument();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  it("keeps inspection available but locks fields during an active Graph Node Run", async () => {
    const user = userEvent.setup();
    const data = appData();
    data.activeRootRuns = [activeGraphNodeRun()];
    render(<AutomationView
      data={data}
      level="action_node"
      graphNodeId="graph-node"
      actionNodeId="job"
      saveAutomation={vi.fn(async (value) => value)}
      navigate={vi.fn()}
      setNavigationBlocker={vi.fn()}
    />);

    await user.click(screen.getByRole("button", { name: /Work Node, work/ }));
    const inspector = screen.getByRole("complementary", { name: "Work inspector" });
    expect(within(inspector).getByText("Locked while an active Run uses this snapshot.")).toBeInTheDocument();
    expect(within(inspector).getByLabelText("Description")).toBeDisabled();
    expect(within(inspector).getByLabelText("Task")).toBeDisabled();
  });
});

const activeGraphNodeRun = (): AppData["activeRootRuns"][number] => ({
  rootRunId: "run-1", kind: "graph_node", targetId: "graph-node", source: "manual", status: "running",
  stateRevision: 0, worktreePath: "/tmp/run-1", branch: "run-1", headSha: "head", configHash: "config",
  snapshotHash: "snapshot", transitionCount: 0,
  executionSnapshot: {} as AppData["activeRootRuns"][number]["executionSnapshot"],
  createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z"
});

const appData = (): AppData => ({
  ...emptyData,
  executionProfiles: [{
    id: "luna-medium", name: "Luna medium", provider: "codex", model: "gpt-test",
    reasoningEffort: "medium", networkAccess: false
  }],
  instructions: [projectInstruction("project:graph"), projectInstruction("project:work"), projectInstruction("project:validation")],
  automation: automation()
});

const automation = (): ProjectAutomationConfig => {
  const config = defaultProjectAutomationConfig();
  config.graph.id = "graph";
  config.graph.name = "Graph";
  config.graph.graphNodes = [{
      id: "graph-node", description: "Graph Node", outcomes: [
        { outcomeId: "graph-node-complete", result: "PASS", acceptanceEffects: [] },
        { outcomeId: "graph-node-failed", result: "FAIL", acceptanceEffects: [] }
      ],
      capabilities: { accepts: [], provides: [] }, stateContract: { description: "Uses shared state." },
      strategy: {
        kind: "reward_mdp_v4", id: "graph-node-local", description: "Local policy",
        model: {
          version: 4, initialStateId: "job", discountPpm: 990_000,
          reward: {
            actionCostMicros: 1_000_000, terminalSuccessBonusMicros: 5_000_000,
            acceptanceProgressPotentialScaleMicros: 0,
            outcomePenaltyMicros: {
              none: 0, transient: 2_000_000, implementation_defect: 5_000_000,
              invalid_plan: 12_000_000, invalid_design: 25_000_000
            }
          },
          stateActions: [{
            stateId: "job", actionId: "job", guards: [], successors: [
              { outcomeId: "job-complete", target: { kind: "terminal", terminal: "success", emitOutcomeId: "graph-node-complete" }, probabilityPpm: 800_000, provenance: "default_prior", penaltyClass: "none" },
              { outcomeId: "job-failed", target: { kind: "terminal", terminal: "failure", emitOutcomeId: "graph-node-failed" }, probabilityPpm: 200_000, provenance: "default_prior", penaltyClass: "implementation_defect" }
            ]
          }],
          solver: { algorithm: "discounted_value_iteration_v4", maxIterations: 10_000, convergenceToleranceMicros: 1 }
        }
      },
      actionNodes: [{
        id: "job", description: "Action", outcomes: [
          { outcomeId: "job-complete", result: "PASS" },
          { outcomeId: "job-failed", result: "FAIL" }
        ],
        capabilities: { accepts: [], provides: [] }, maxRetries: 2,
        workNode: {
          id: "work", description: "Work", task: "Perform work.", type: "agent", nodeStyle: "sol", nodeSize: "large",
          executionProfileId: "luna-medium", primaryInstructionId: "project:work", skillIds: []
        },
        validationNode: {
          id: "validation", description: "Validation", task: "Verify work.", type: "agent", nodeStyle: "luna", nodeSize: "small",
          executionProfileId: "luna-medium", primaryInstructionId: "project:validation", skillIds: []
        }
      }]
    }];
  return config;
};
