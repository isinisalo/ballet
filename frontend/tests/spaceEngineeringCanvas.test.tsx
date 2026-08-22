import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EngineeringInspector, type EngineeringInspectorModel } from "../src/workspace/automation/EngineeringInspector";
import {
  SpaceEngineeringCanvas,
  spaceRadialLayout,
  type SpaceCanvasNode
} from "../src/workspace/automation/SpaceEngineeringCanvas";
import { JobFlowCanvas } from "../src/workspace/automation/JobFlowCanvas";
import type { ProjectJobNode } from "@shared/api/workspace-contracts";
import { projectInstruction } from "./projectInstructionFixture";

const node = (id: string, role = "Graph Node"): SpaceCanvasNode => ({
  id,
  label: id,
  role,
  nodeStyle: "terra",
  nodeSize: "medium"
});

describe("three-level engineering canvases", () => {
  it("keeps the hub, repair and children in the Graph scope without result endpoints", async () => {
    const user = userEvent.setup();
    const openHub = vi.fn();
    const openRepair = vi.fn();
    const openChild = vi.fn();
    render(<SpaceEngineeringCanvas
      hub={node("graph-orchestrator", "Graph Orchestrator")}
      repair={node("graph-repair", "Repair Node")}
      children={[node("plan"), node("build"), node("verify")]}
      onHub={openHub}
      onRepair={openRepair}
      onChild={openChild}
    />);

    await user.click(screen.getByRole("button", { name: "Graph Orchestrator graph-orchestrator" }));
    await user.click(screen.getByRole("button", { name: "Repair Node graph-repair" }));
    await user.click(screen.getByRole("button", { name: "Graph Node build" }));

    expect(openHub).toHaveBeenCalledOnce();
    expect(openRepair).toHaveBeenCalledOnce();
    expect(openChild).toHaveBeenCalledWith("build");
    expect(screen.queryByText("PASS")).not.toBeInTheDocument();
    expect(screen.queryByText("FAIL")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Work Node/ })).not.toBeInTheDocument();
  });

  it("shows the industrial Job flow and opens only Work and Validation", async () => {
    const user = userEvent.setup();
    const openWork = vi.fn();
    const openValidation = vi.fn();
    render(<JobFlowCanvas
      job={jobNode()}
      orchestratorId="graph-node-orchestrator"
      selected="work"
      locked={false}
      onWork={openWork}
      onValidation={openValidation}
    />);

    const work = screen.getByRole("button", { name: "Take action, Work Node · work" });
    const validation = screen.getByRole("button", { name: "Verify Result, Validation Node · validation" });
    expect(work).toHaveAttribute("aria-pressed", "true");
    await user.tab();
    expect(work).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(validation).toHaveFocus();
    await user.keyboard(" ");

    expect(openWork).toHaveBeenCalledOnce();
    expect(openValidation).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Start, Job entry")).toBeInTheDocument();
    expect(screen.getByLabelText("Graph Node Orchestrator, graph-node-orchestrator")).toBeInTheDocument();
    expect(screen.getByLabelText("Next job, Not configured")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Done, Complete Graph Node · PASS")).toBeInTheDocument();
    expect(screen.getByLabelText("Escalate, Graph Node Orchestrator")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next job|Done|Escalate|Orchestrator/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Human gate")).not.toBeInTheDocument();
  });

  it.each([1, 5, 17, 40, 64])("places %i nodes deterministically without button overlap", (count) => {
    const children = Array.from({ length: count }, (_, index) => node(`node-${index + 1}`));
    const first = spaceRadialLayout(children);
    const second = spaceRadialLayout(children);

    expect(second).toEqual(first);
    expect(first.nodes).toHaveLength(count);
    for (let left = 0; left < first.nodes.length; left += 1) {
      for (let right = left + 1; right < first.nodes.length; right += 1) {
        const a = first.nodes[left]!;
        const b = first.nodes[right]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(144);
      }
    }
  });
});

const jobNode = (maxRetries = 2): ProjectJobNode => ({
  id: "job", description: "Job", nodeStyle: "terra", nodeSize: "medium",
  capabilities: { accepts: [], provides: [] }, maxRetries,
  workNode: {
    id: "work", description: "Work", task: "Perform work.", type: "agent", nodeStyle: "sol", nodeSize: "large",
    executionProfileId: "luna-medium", primaryInstructionId: "project:work", skillIds: []
  },
  validationNode: {
    id: "validation", description: "Validation", task: "Verify work.", type: "agent", nodeStyle: "luna", nodeSize: "small",
    executionProfileId: "luna-medium", primaryInstructionId: "project:validation", skillIds: []
  }
});

describe("engineering inspector", () => {
  it("resolves origin-scoped instruction ids exactly once", () => {
    const instruction = projectInstruction("project:graph-orchestrator");
    const model: EngineeringInspectorModel = {
      key: "graph-orchestrator",
      role: "Graph Orchestrator",
      title: "Graph Orchestrator",
      id: "graph-orchestrator",
      description: "Routes Graph Nodes.",
      executionProfileId: "luna-medium",
      primaryInstructionId: instruction.id
    };
    render(<EngineeringInspector
      model={model}
      profiles={[{
        id: "luna-medium",
        name: "Luna medium",
        provider: "codex",
        model: "gpt-5.6-luna",
        reasoningEffort: "medium",
        networkAccess: false
      }]}
      instructions={[instruction]}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />);

    expect(screen.getByText("Instruction body.")).toBeInTheDocument();
    const select = screen.getByLabelText("Primary instruction");
    expect(select).toHaveValue("project:graph-orchestrator");
    expect(within(select).getByRole("option")).toHaveValue("project:graph-orchestrator");
    expect(within(select).getByRole("option")).not.toHaveValue("project:project:graph-orchestrator");
  });

  it("closes the narrow-viewport Sheet instead of immediately reopening it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    render(<EngineeringInspector
      model={{
        key: "work",
        role: "Work Node",
        title: "Work",
        id: "work",
        description: "Performs work."
      }}
      profiles={[]}
      instructions={[]}
      onChange={vi.fn()}
      onClose={onClose}
    />);

    await user.click(await screen.findByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  it("keeps inspection available while disabling authoring for an active Run", () => {
    render(<EngineeringInspector
      model={{
        key: "work", role: "Work Node", title: "Take action", id: "work",
        description: "Performs work.", task: "Perform the task.", locked: true
      }}
      profiles={[]}
      instructions={[]}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />);

    expect(screen.getByText("Locked while an active Run uses this snapshot.")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeDisabled();
    expect(screen.getByLabelText("Task")).toBeDisabled();
  });
});
