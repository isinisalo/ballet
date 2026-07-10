import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoopHandlerAgentInstructions } from "../src/workspace/automation/loops/LoopHandlerAgentInstructions";
import type { LoopHandlerRoute } from "../src/workspace/automation/loops/LoopHandlerSheet";

const now = "2026-07-10T10:00:00.000Z";

const agent = (id: string, name: string, instructions: string): Agent => ({
  id,
  name,
  description: "",
  instructions,
  skills: [],
  enabled: true,
  status: "online",
  createdAt: now,
  updatedAt: now,
  relativePath: `.codex/agents/${id}.toml`,
  frontmatter: {}
});

const route = (id: string, actionId: string): LoopHandlerRoute => ({
  id,
  loopId: "loop-1",
  stepIndex: Number(id.replace(/\D/g, "")) || 0,
  sourceLabel: actionId,
  actionId,
  actionLabel: actionId
});

const config = (actions: ProjectAutomationConfig["actions"]): ProjectAutomationConfig => ({
  version: 1,
  actions,
  outputRoutes: [],
  humanGateResponses: [],
  loops: [],
  runtimes: []
});

describe("LoopHandlerAgentInstructions", () => {
  it("renders unique agents once and preserves their first-selection order", () => {
    const agents = [agent("agent-1", "First Agent", "## First instructions"), agent("agent-2", "Second Agent", "## Second instructions")];
    render(
      <LoopHandlerAgentInstructions
        routes={[route("route-1", "action-1"), route("route-2", "action-2"), route("route-3", "action-3")]}
        agents={agents}
        config={config([
          { id: "action-1", description: "", agentId: "agent-1" },
          { id: "action-2", description: "", agentId: "agent-2" },
          { id: "action-3", description: "", agentId: "agent-1" }
        ])}
      />
    );

    const preview = screen.getByRole("complementary", { name: "Agent instructions" });
    const agentHeadings = within(preview).getAllByRole("heading", { level: 3 });
    expect(agentHeadings.map((heading) => heading.textContent)).toEqual(["First Agent", "Second Agent"]);
    expect(within(preview).getAllByText("agent-1")).toHaveLength(1);
  });

  it.each([
    {
      name: "an unselected action",
      routes: [route("route-1", "")],
      actions: [],
      agents: [],
      message: "Select a handler action to preview its agent instructions."
    },
    {
      name: "a human gate",
      routes: [route("route-1", "human")],
      actions: [{ id: "human", description: "", humanGate: true }],
      agents: [],
      message: "Human gates do not have agent instructions."
    },
    {
      name: "an unknown agent",
      routes: [route("route-1", "missing")],
      actions: [{ id: "missing", description: "", agentId: "unknown" }],
      agents: [],
      message: "Agent not found."
    },
    {
      name: "empty instructions",
      routes: [route("route-1", "empty")],
      actions: [{ id: "empty", description: "", agentId: "agent-1" }],
      agents: [agent("agent-1", "Empty Agent", "")],
      message: "No instructions configured."
    }
  ])("shows a clear empty state for $name", ({ routes, actions, agents, message }) => {
    render(<LoopHandlerAgentInstructions routes={routes} agents={agents} config={config(actions)} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
