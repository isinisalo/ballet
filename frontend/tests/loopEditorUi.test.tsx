import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  defaultTerminalNodes,
  type Agent,
  type LoopTheme,
  type ProjectAutomationConfig,
  type ProjectLoop
} from "@shared/api/workspace-contracts";
import { LoopEditor } from "../src/workspace/automation/loops/LoopEditor";
import { agentTransitions } from "./agentTransitionFixture";

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
  nodes: [{
    id: "build",
    type: "agent",
    nodeStyle: "sol",
    nodeSize: "large",
    agentId: "builder",
    description: "Build release",
    on: agentTransitions("review", { human: "review" })
  }, {
    id: "review",
    type: "human",
    nodeStyle: "luna",
    nodeSize: "tiny",
    description: "Review release",
    on: { approved: "completed", rejected: "blocked" }
  }, ...defaultTerminalNodes()]
};

const config: ProjectAutomationConfig = { version: 8, loops: [loop] };

describe("compact Loop editor UI", () => {
  it("opens the 50/50 sheet with instructions and Step editor panes", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(await screen.findByRole("button", { name: "Edit step build" }));
    const dialog = screen.getByRole("dialog", { name: "Node editor" });
    const workspace = screen.getByRole("region", { name: "Loop canvas workspace" });
    const paneGrid = [...dialog.children].find((child) => child.className.includes("grid-cols-[3fr_2fr]"));

    expect(workspace).toHaveClass("md:grid-cols-2");
    expect(paneGrid).toBeDefined();
    expect(screen.getByLabelText("Node ID")).toHaveValue("build");
    expect(screen.getByRole("combobox", { name: "Node style" })).toHaveTextContent("Sol");
    expect(screen.getByRole("combobox", { name: "Node size" })).toHaveTextContent("Large");
    expect(screen.getByText("Transitions")).toBeInTheDocument();
    for (const outcome of ["ready", "approved", "changes-requested"]) {
      expect(screen.getByRole("combobox", { name: `${outcome} transition kind` })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: `${outcome} transition target` })).toBeInTheDocument();
    }
    for (const outcome of ["needs_input", "blocked", "failed"]) {
      expect(screen.getByRole("combobox", { name: `${outcome} transition target` })).toBeInTheDocument();
    }
    expect(screen.queryByRole("combobox", { name: "rejected transition target" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from loop" })).toBeEnabled();
  });

  it("shows locked agent fields and no decision transitions for a terminal node", async () => {
    const onChange = vi.fn();
    renderEditor({ onChange });

    await userEvent.click(await screen.findByRole("button", { name: "Edit node completed" }));

    expect(screen.getByLabelText("Node ID")).toHaveValue("completed");
    expect(screen.getByLabelText("Node ID")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Node type" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Agent" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Agent" }).parentElement?.querySelector("input[aria-hidden='true']")).toHaveValue("");
    expect(screen.getByText("Terminal nodes have no transitions.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "approved transition target" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "rejected transition target" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove from loop" })).not.toBeInTheDocument();
  });

  it("groups the complete Node style menu and keeps Node size when the style changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ onChange });
    await user.click(await screen.findByRole("button", { name: "Edit step build" }));
    await user.click(screen.getByRole("combobox", { name: "Node style" }));
    for (const group of ["Classic", "Planets"]) {
      expect(await screen.findByText(group)).toBeInTheDocument();
    }
    expect(screen.queryByText("Ships")).not.toBeInTheDocument();
    expect(screen.queryByText("Monsters")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "Vector planet" }, { timeout: 3_000 }));

    const next = onChange.mock.calls.at(-1)?.[0] as ProjectLoop;
    expect(next.nodes.find((node) => node.id === "build")).toMatchObject({ nodeStyle: "vector-planet", nodeSize: "large" });
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
