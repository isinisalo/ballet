import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppData, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { AutomationView } from "../src/workspace/automation/AutomationView";
import { emptyData } from "../src/workspace/types";
import { projectInstruction } from "./projectInstructionFixture";

describe("Automation Job flow integration", () => {
  it("opens the matching inspector from Take action and Verify Result", async () => {
    const user = userEvent.setup();
    render(<AutomationView
      data={appData()}
      level="job_node"
      graphNodeId="graph-node"
      jobNodeId="job"
      saveAutomation={vi.fn(async (value) => value)}
      navigate={vi.fn()}
      setNavigationBlocker={vi.fn()}
    />);

    await user.click(screen.getByRole("button", { name: "Take action, Work Node · work" }));
    const workInspector = screen.getByRole("complementary", { name: "Take action inspector" });
    expect(within(workInspector).getByText("Work Node · work")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Verify Result, Validation Node · validation" }));
    const validationInspector = screen.getByRole("complementary", { name: "Verify Result inspector" });
    expect(within(validationInspector).getByText("Validation Node · validation")).toBeInTheDocument();
  });

  it("opens the same Work settings in a narrow-viewport Sheet", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    render(<AutomationView
      data={appData()}
      level="job_node"
      graphNodeId="graph-node"
      jobNodeId="job"
      saveAutomation={vi.fn(async (value) => value)}
      navigate={vi.fn()}
      setNavigationBlocker={vi.fn()}
    />);

    await user.click(screen.getByRole("button", { name: "Take action, Work Node · work" }));
    expect(await screen.findByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Take action inspector" })).not.toBeInTheDocument();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  it("keeps inspection available but locks fields during an active Graph Node Run", async () => {
    const user = userEvent.setup();
    const data = appData();
    data.activeRootRuns = [activeGraphNodeRun()];
    render(<AutomationView
      data={data}
      level="job_node"
      graphNodeId="graph-node"
      jobNodeId="job"
      saveAutomation={vi.fn(async (value) => value)}
      navigate={vi.fn()}
      setNavigationBlocker={vi.fn()}
    />);

    await user.click(screen.getByRole("button", { name: /Take action, Work Node · work/ }));
    const inspector = screen.getByRole("complementary", { name: "Take action inspector" });
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

const automation = (): ProjectAutomationConfig => ({
  version: 14,
  graph: {
    id: "graph", name: "Graph", state: { description: "Shared state.", initial: {} },
    orchestrator: {
      id: "graph-orchestrator", description: "Routes Graph Nodes.", nodeStyle: "luna", nodeSize: "medium",
      executionProfileId: "luna-medium", primaryInstructionId: "project:graph", skillIds: [],
      maxTransitions: 256, maxRouteAttempts: 3,
      routing: { start: { id: "graph-start", candidates: [{ target: { graphNodeId: "graph-node" }, description: "Start graph node." }] }, continuation: [], repair: [] }
    },
    graphNodes: [{
      id: "graph-node", description: "Graph Node", nodeStyle: "terra", nodeSize: "medium",
      capabilities: { accepts: [], provides: [] }, stateContract: { description: "Uses shared state." },
      orchestrator: {
        id: "graph-node-orchestrator", description: "Routes Jobs.", nodeStyle: "luna", nodeSize: "medium",
        executionProfileId: "luna-medium", primaryInstructionId: "project:graph", skillIds: [],
        maxTransitions: 256, maxRouteAttempts: 3,
        routing: { start: { id: "job-start", candidates: [{ target: { jobNodeId: "job" }, description: "Start job." }] }, continuation: [], repair: [] }
      },
      jobNodes: [{
        id: "job", description: "Job", nodeStyle: "terra", nodeSize: "medium",
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
    }]
  }
});
