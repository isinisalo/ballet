import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EngineeringInspector, type EngineeringInspectorModel } from "../src/workspace/automation/EngineeringInspector";
import { JobFlowCanvas } from "../src/workspace/automation/JobFlowCanvas";
import type { ProjectJobNode } from "@shared/api/workspace-contracts";
import { projectInstruction } from "./projectInstructionFixture";

describe("Action Node engineering canvas", () => {
  it("shows the industrial Action flow and opens only Work and Validation", async () => {
    const user = userEvent.setup();
    const openWork = vi.fn();
    const openValidation = vi.fn();
    render(<JobFlowCanvas
      job={jobNode()}
      selected="work"
      locked={false}
      onWork={openWork}
      onValidation={openValidation}
    />);

    const work = screen.getByRole("button", { name: "Work Node, work" });
    const validation = screen.getByRole("button", { name: "Validation Node, validation" });
    expect(work).toHaveAttribute("aria-pressed", "true");
    await user.tab();
    expect(work).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(validation).toHaveFocus();
    await user.keyboard(" ");

    expect(openWork).toHaveBeenCalledOnce();
    expect(openValidation).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Start")).toBeInTheDocument();
    expect(screen.getByLabelText("Retry count 2")).toBeInTheDocument();
    expect(screen.getByText("Retry count 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Pass?")).toBeInTheDocument();
    expect(screen.getByLabelText("Retry?")).toBeInTheDocument();
    expect(screen.getByLabelText("Continue")).toBeInTheDocument();
    expect(screen.getByLabelText("Escalate")).toBeInTheDocument();
    expect(screen.queryByText("Take action")).not.toBeInTheDocument();
    expect(screen.queryByText("Verify Result")).not.toBeInTheDocument();
    expect(screen.queryByText("Graph Node Orchestrator")).not.toBeInTheDocument();
    expect(screen.queryByText("Next job")).not.toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(screen.queryByText("PASS / FAIL")).not.toBeInTheDocument();
    expect(screen.queryByText("Retries left?")).not.toBeInTheDocument();
    expect(screen.queryByText("Human gate")).not.toBeInTheDocument();
  });

});

const jobNode = (maxRetries = 2): ProjectJobNode => ({
  id: "job", description: "Action", outcomes: [], capabilities: { accepts: [], provides: [] }, maxRetries,
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
