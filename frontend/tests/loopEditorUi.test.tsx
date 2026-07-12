import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { builtInLoopThemes, type Agent, type LoopTheme, type ProjectAutomationConfig, type ProjectLoop } from "@shared/api/workspace-contracts";
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
  theme: "open-ai",
  start: "build",
  steps: [{
    id: "build",
    type: "agent",
    nodeSize: "large",
    agentId: "builder",
    description: "Build release",
    on: { approved: "review", rejected: { end: "failed" } }
  }, {
    id: "review",
    type: "human",
    nodeSize: "small",
    description: "Review release",
    on: { approved: { end: "completed" }, rejected: "build" }
  }]
};

const config: ProjectAutomationConfig = { version: 6, loops: [loop] };

describe("compact Loop editor UI", () => {
  it("opens the restored 50/50 sheet with its 3/2 instructions and Step editor panes", async () => {
    const user = userEvent.setup();
    render(<LoopEditor config={config} loop={loop} loops={[loop]} agents={agents} themes={builtInLoopThemes} locked={false} onChange={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "Edit step build" }));
    const dialog = screen.getByRole("dialog", { name: "Step editor" });
    const workspace = screen.getByRole("region", { name: "Loop canvas workspace" });
    const paneGrid = [...dialog.children].find((child) => child.className.includes("grid-cols-[3fr_2fr]"));

    expect(workspace).toHaveClass("md:grid-cols-2");
    expect(paneGrid).toBeDefined();
    expect(screen.getByLabelText("Step ID")).toHaveValue("build");
    expect(screen.getByRole("combobox", { name: "Node size" })).toHaveTextContent("Large");
    expect(screen.getByText("Transitions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from loop" })).toBeEnabled();
  });

  it("adds a Step through a terminal ghost without restoring legacy Actions", async () => {
    const onChange = vi.fn();
    render(<LoopEditor config={config} loop={loop} loops={[loop]} agents={agents} themes={builtInLoopThemes} locked={false} onChange={onChange} />);

    fireEvent.click(await screen.findByRole("button", { name: "Add step for completed" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as ProjectLoop;
    expect(next.steps.find((step) => step.id === "review")?.on.approved).toBe("new-step");
    expect(next.steps.find((step) => step.id === "new-step")?.on.approved).toEqual({ end: "completed" });
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("renders open-ai Steps as size-owned celestial nodes with bright connection points", async () => {
    const { container } = render(<LoopEditor config={config} loop={loop} loops={[loop]} agents={agents} agentExecutionStates={[{ agentId: "builder", status: "idle", reasoning: "high" }]} themes={builtInLoopThemes} locked={false} onChange={() => undefined} />);

    expect(await screen.findByRole("button", { name: "Edit step build" })).toHaveAttribute("data-loop-node-size", "large");
    expect(screen.getByRole("button", { name: "Edit step build" })).toHaveAttribute("data-loop-node-renderer", "sol");
    expect(screen.getByRole("button", { name: "Edit step build" })).toHaveAttribute("data-loop-reasoning-glow", "4");
    expect(screen.getByRole("button", { name: "Edit step build" })).toHaveAttribute("data-loop-reasoning-effort", "high");
    expect(screen.getByRole("button", { name: "Edit step review" })).toHaveAttribute("data-loop-node-size", "small");
    expect(screen.getByRole("button", { name: "Edit step review" })).toHaveAttribute("data-loop-node-renderer", "luna");
    expect(screen.getByRole("button", { name: "Edit step review" })).toHaveAttribute("data-loop-reasoning-glow", "0");
    expect(screen.getByRole("button", { name: "Edit step review" })).toHaveAttribute("data-loop-node-kind", "human");
    expect(container.querySelector('[data-loop-node-label="build"]')).toHaveClass("left-1/2", "-translate-x-1/2", "top-full");
    expect(container.querySelector('[data-loop-edge-display-label="build"]')).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-loop-connection-point]").length).toBeGreaterThan(0);
  });

  it("previews a Loop theme change and locks the selector with an active Run", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(<LoopEditor config={config} loop={loop} loops={[loop]} agents={agents} themes={builtInLoopThemes} locked={false} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Loop theme" }));
    await user.click(await screen.findByRole("option", { name: "Default" }));
    expect(onChange).toHaveBeenCalledWith({ ...loop, theme: "default" });

    const defaultLoop = { ...loop, theme: "default" as const };
    view.rerender(<LoopEditor config={{ version: 6, loops: [defaultLoop] }} loop={defaultLoop} loops={[defaultLoop]} agents={agents} themes={builtInLoopThemes} locked onChange={onChange} />);
    expect(screen.getByRole("combobox", { name: "Loop theme" })).toBeDisabled();
    expect(document.querySelector("[data-loop-canvas]")).toHaveAttribute("data-loop-theme", "default");
    expect(await screen.findByRole("button", { name: "Edit step build" })).toHaveAttribute("data-loop-node-renderer", "flat");
    expect(document.querySelector(".loop-agent-avatar")).toBeInTheDocument();
  });

  it("offers project themes in the Loop theme selector", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const customTheme = {
      ...structuredClone(builtInLoopThemes[0]!),
      id: "project-aurora",
      label: "Project Aurora"
    } satisfies LoopTheme;
    const view = render(<LoopEditor config={config} loop={loop} loops={[loop]} agents={agents} themes={[...builtInLoopThemes, customTheme]} locked={false} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Loop theme" }));
    await user.click(await screen.findByRole("option", { name: "Project Aurora" }));
    expect(onChange).toHaveBeenCalledWith({ ...loop, theme: "project-aurora" });

    const customLoop = { ...loop, theme: customTheme.id };
    view.rerender(<LoopEditor config={{ version: 6, loops: [customLoop] }} loop={customLoop} loops={[customLoop]} agents={agents} themes={[...builtInLoopThemes, customTheme]} locked={false} onChange={onChange} />);
    expect(document.querySelector("[data-loop-canvas]")).toHaveAttribute("data-loop-theme", "project-aurora");
    expect(await screen.findByRole("button", { name: "Edit step build" })).toHaveAttribute("data-loop-node-renderer", "flat");
  });

});
