import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Agent, ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";
import { LoopEditor } from "../src/workspace/automation/loops/LoopEditor";

const agents: Agent[] = [{
  id: "builder",
  name: "Builder",
  role: "Implementation",
  description: "Builds the requested change.",
  enabled: true,
  skills: [],
  document: "# Builder"
}];

const loop: ProjectLoop = {
  id: "delivery",
  start: "build",
  steps: [{
    id: "build",
    type: "agent",
    agentId: "builder",
    description: "Build release",
    on: { approved: "review", rejected: { end: "failed" } }
  }, {
    id: "review",
    type: "human",
    description: "Review release",
    on: { approved: { end: "completed" }, rejected: "build" }
  }]
};

const config: ProjectAutomationConfig = { version: 2, loops: [loop], runtimes: [] };

describe("compact Loop editor UI", () => {
  it("opens the restored 50/50 sheet with its 3/2 instructions and Step editor panes", async () => {
    const user = userEvent.setup();
    render(<LoopEditor config={config} loop={loop} loops={[loop]} agents={agents} locked={false} onChange={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "Edit step build" }));
    const dialog = screen.getByRole("dialog", { name: "Step editor" });
    const workspace = screen.getByRole("region", { name: "Loop canvas workspace" });
    const paneGrid = [...dialog.children].find((child) => child.className.includes("grid-cols-[3fr_2fr]"));

    expect(workspace).toHaveClass("md:grid-cols-2");
    expect(paneGrid).toBeDefined();
    expect(screen.getByLabelText("Step ID")).toHaveValue("build");
    expect(screen.getByText("Transitions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from loop" })).toBeEnabled();
  });

  it("adds a Step through a terminal ghost without restoring legacy Actions", async () => {
    const onChange = vi.fn();
    render(<LoopEditor config={config} loop={loop} loops={[loop]} agents={agents} locked={false} onChange={onChange} />);

    fireEvent.click(await screen.findByRole("button", { name: "Add step for completed" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as ProjectLoop;
    expect(next.steps.find((step) => step.id === "review")?.on.approved).toBe("new-step");
    expect(next.steps.find((step) => step.id === "new-step")?.on.approved).toEqual({ end: "completed" });
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });
});
