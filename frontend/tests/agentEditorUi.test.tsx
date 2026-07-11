import type { Agent, AgentExecutionState } from "@shared/api/workspace-contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentEditor } from "../src/workspace/agents/AgentEditor";

const agent = (): Agent => ({
  id: "agent-architect",
  name: "Architect",
  description: "Designs durable technical systems.",
  instructions: "# Role\nDesign the system.",
  skills: [],
  enabled: true,
  createdAt: "2026-07-11T10:00:00.000Z",
  updatedAt: "2026-07-11T12:00:00.000Z",
  relativePath: ".codex/agents/brief-agent.toml"
} as Agent);

const renderEditor = (executionState?: AgentExecutionState) => {
  const selectedAgent = agent();
  const save = vi.fn(async (_collection: "agents", item: Partial<Agent>) => ({ ...selectedAgent, ...item } as Agent));
  const remove = vi.fn(async () => undefined);
  render(<AgentEditor agent={selectedAgent} executionState={executionState} save={save} remove={remove} />);
  return { save, remove };
};

describe("agent instructions workspace", () => {
  it("edits and saves instructions while keeping other tabs unavailable", async () => {
    const user = userEvent.setup();
    const { save } = renderEditor({
      agentId: "agent-architect",
      status: "running",
      provider: "codex",
      deviceId: "device-local"
    });

    expect(screen.getByRole("tab", { name: "Instructions" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Activity" })).toBeDisabled();
    expect(screen.getAllByText("Running")).toHaveLength(2);
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();
    expect(screen.getByText("device-local")).toBeInTheDocument();

    const instructions = screen.getByLabelText("Instructions");
    await user.clear(instructions);
    await user.type(instructions, "# Role\nPlan the technical direction.");
    await user.click(screen.getByRole("button", { name: "Save agent" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("agents", expect.objectContaining({
      instructions: "# Role\nPlan the technical direction."
    })));
  });

  it("uses an explicit unbound fallback when no live state exists", () => {
    renderEditor();

    expect(screen.getAllByText("Unbound").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not configured")).toHaveLength(2);
  });
});