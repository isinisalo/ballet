import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  type Agent,
  type LoopTheme,
  type ProjectAutomationConfig,
  type ProjectLoop
} from "@shared/api/workspace-contracts";
import { LoopEditor } from "../src/workspace/automation/loops/LoopEditor";

const agents: Agent[] = [{
  id: "builder",
  name: "Builder",
  role: "Implementation",
  description: "Builds the requested change.",
  enabled: true,
  avatar: "rocket",
  skills: [],
  document: "# Builder"
}];

const loop: ProjectLoop = {
  id: "delivery",
  start: "build",
  steps: [{
    id: "build",
    type: "agent",
    nodeStyle: "sol",
    agentId: "builder",
    description: "Build release",
    on: { approved: "review", rejected: { end: "failed" } }
  }, {
    id: "review",
    type: "human",
    nodeStyle: "luna",
    description: "Review release",
    on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
  }]
};

const config: ProjectAutomationConfig = { version: 7, loops: [loop] };

describe("compact Loop editor UI", () => {
  it("opens the 50/50 sheet with instructions and Step editor panes", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(await screen.findByRole("button", { name: "Edit step build" }));
    const dialog = screen.getByRole("dialog", { name: "Step editor" });
    const workspace = screen.getByRole("region", { name: "Loop canvas workspace" });
    const paneGrid = [...dialog.children].find((child) => child.className.includes("grid-cols-[3fr_2fr]"));

    expect(workspace).toHaveClass("md:grid-cols-2");
    expect(paneGrid).toBeDefined();
    expect(screen.getByLabelText("Step ID")).toHaveValue("build");
    expect(screen.getByRole("combobox", { name: "Node style" })).toHaveTextContent("Sol · Large");
    expect(screen.getByText("Transitions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from loop" })).toBeEnabled();
  });

  it("adds a Flat Step before a terminal node and preserves the terminal", async () => {
    const onChange = vi.fn();
    renderEditor({ onChange });

    fireEvent.click(await screen.findByRole("button", { name: "Add step before completed" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as ProjectLoop;
    expect(next.steps.find((step) => step.id === "review")?.on.approved).toBe("new-step");
    expect(next.steps.find((step) => step.id === "new-step")).toMatchObject({
      nodeStyle: "flat",
      on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
    });
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("renders Step-owned styles, sizes, reasoning, and connection points", async () => {
    const { container } = renderEditor({
      agentExecutionStates: [{ agentId: "builder", status: "idle", reasoning: "high" }]
    });

    const build = await screen.findByRole("button", { name: "Edit step build" });
    const review = screen.getByRole("button", { name: "Edit step review" });
    expect(build).toHaveAttribute("data-loop-node-size", "large");
    expect(build).toHaveAttribute("data-loop-node-style", "sol");
    expect(build).toHaveAttribute("data-loop-reasoning-glow", "4");
    expect(build).toHaveAttribute("data-loop-reasoning-effort", "high");
    expect(review).toHaveAttribute("data-loop-node-size", "tiny");
    expect(review).toHaveAttribute("data-loop-node-style", "luna");
    expect(review).toHaveAttribute("data-loop-reasoning-glow", "0");
    expect(review).toHaveAttribute("data-loop-node-kind", "human");
    expect(container.querySelector('[data-loop-node-label="build"]')).toHaveClass("left-1/2", "-translate-x-1/2", "top-full");
    expect(container.querySelector('[data-loop-edge-display-label="build"]')).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-loop-connection-point]").length).toBeGreaterThan(0);
  });

  it("uses the single project theme without a selector", async () => {
    const projectTheme: LoopTheme = {
      ...structuredClone(defaultLoopTheme),
      node: { ...defaultLoopTheme.node, labelColor: "#112233", showAgentAvatarInNode: true },
      edge: { ...defaultLoopTheme.edge, color: "#445566" }
    };
    const { container } = renderEditor({ theme: projectTheme });

    expect(screen.queryByRole("combobox", { name: "Loop theme" })).not.toBeInTheDocument();
    expect(container.querySelector("[data-loop-canvas]")).toHaveAttribute("data-loop-theme", "project");
    expect(container.querySelector("[data-loop-canvas]")).toHaveStyle({ "--loop-theme-node-label": "#112233" });
    expect(container.querySelector("[data-loop-canvas]")).toHaveStyle({ "--loop-theme-edge-color": "#445566" });
    expect(await screen.findByRole("button", { name: "Edit step build" })).toHaveAttribute("data-loop-node-style", "sol");
    expect(container.querySelector(".loop-agent-avatar")).toBeInTheDocument();
  });
});

function renderEditor(overrides: Partial<React.ComponentProps<typeof LoopEditor>> = {}) {
  const props: React.ComponentProps<typeof LoopEditor> = {
    config,
    loop,
    loops: [loop],
    agents,
    theme: defaultLoopTheme,
    locked: false,
    onChange: () => undefined,
    ...overrides
  };
  return render(<LoopEditor {...props} />);
}
