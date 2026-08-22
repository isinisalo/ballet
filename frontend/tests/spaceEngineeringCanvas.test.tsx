import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EngineeringInspector, type EngineeringInspectorModel } from "../src/workspace/automation/EngineeringInspector";
import {
  JobEngineeringCanvas,
  SpaceEngineeringCanvas,
  spaceRadialLayout,
  type SpaceCanvasNode
} from "../src/workspace/automation/SpaceEngineeringCanvas";
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

  it("shows only Work and Validation inside a Job Node", async () => {
    const user = userEvent.setup();
    const openWork = vi.fn();
    const openValidation = vi.fn();
    render(<JobEngineeringCanvas
      work={node("work", "Work Node")}
      validation={node("validation", "Validation Node")}
      onWork={openWork}
      onValidation={openValidation}
    />);

    await user.click(screen.getByRole("button", { name: "Work Node work" }));
    await user.click(screen.getByRole("button", { name: "Validation Node validation" }));

    expect(openWork).toHaveBeenCalledOnce();
    expect(openValidation).toHaveBeenCalledOnce();
    expect(screen.getByText("VALIDATE")).toBeInTheDocument();
    expect(screen.getByText("RETRY")).toBeInTheDocument();
    expect(screen.queryByText("PASS")).not.toBeInTheDocument();
    expect(screen.queryByText("FAIL")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Orchestrator/ })).not.toBeInTheDocument();
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
});
