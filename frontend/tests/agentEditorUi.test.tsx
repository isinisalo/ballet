import type { Agent, AgentExecutionState } from "@shared/api/workspace-contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentEditor } from "../src/workspace/agents/AgentEditor";
import { now, runtimeBackend, runtimeDevice } from "./runtimeFixtures";

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
    expect(screen.queryByRole("tab", { name: "Tasks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Custom Args" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Running")).toHaveLength(2);
    expect(screen.getByLabelText("Runtime")).toBeInTheDocument();

    const instructions = screen.getByLabelText("Instructions");
    await user.clear(instructions);
    await user.type(instructions, "# Role\nPlan the technical direction.");
    await user.click(screen.getByRole("button", { name: "Save agent" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("agents", expect.objectContaining({
      instructions: "# Role\nPlan the technical direction."
    })));
  });

  it("keeps execution configuration in the profile rail without an Environment tab", () => {
    renderEditor();

    expect(screen.getAllByText("Unbound").length).toBeGreaterThan(0);
    expect(screen.getByText("Execution")).toBeInTheDocument();
    expect(screen.getByLabelText("Runtime")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
    expect(screen.getByLabelText("Reasoning effort")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Network access" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Agent enabled" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save execution" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Environment" })).not.toBeInTheDocument();
  });

  it("renders the saved runtime configuration in the compact Execution section", async () => {
    const device = runtimeDevice({ backends: [runtimeBackend({ id: "backend-copilot", provider: "copilot" })] });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/runtimes/devices") return Response.json({ devices: [device] });
      if (url === "/api/agents/agent-architect/execution-binding") return Response.json({
        id: "binding-1", projectId: "project-1", agentId: "agent-architect", runtimeBackendId: "backend-copilot", deviceId: "device-1", provider: "copilot", model: "gpt-test", reasoning: "high", policy: { network: false, readOnlyRoots: [] }, createdAt: now, updatedAt: now
      });
      return Response.json({ error: `Unhandled ${url}` }, { status: 404 });
    }));

    try {
      renderEditor({ agentId: "agent-architect", status: "running", provider: "copilot", deviceId: "device-1" });

      await waitFor(() => expect(screen.getByLabelText("Runtime")).toHaveTextContent("Iiro's MacBook Pro · online"));
      expect(screen.getByLabelText("Provider")).toHaveTextContent("GitHub Copilot CLI");
      expect(screen.getByLabelText("Model")).toHaveTextContent("GPT Test");
      expect(screen.getByLabelText("Reasoning effort")).toHaveTextContent("high");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("saves execution settings automatically from the profile rail", async () => {
    const user = userEvent.setup();
    const device = runtimeDevice();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/runtimes/devices") return Response.json({ devices: [device] });
      if (url === "/api/agents/agent-architect/execution-binding" && !init?.method) return Response.json(null);
      if (url === "/api/agents/agent-architect/execution-binding" && init?.method === "PUT") return Response.json({
        id: "binding-1", projectId: "project-1", agentId: "agent-architect", runtimeBackendId: "backend-codex", deviceId: "device-1", provider: "codex", model: "gpt-test", reasoning: "high", policy: { network: true, readOnlyRoots: [] }, createdAt: now, updatedAt: now
      });
      return Response.json({ error: `Unhandled ${init?.method ?? "GET"} ${url}` }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      renderEditor();
      const runtime = screen.getByLabelText("Runtime");
      await waitFor(() => expect(runtime).toBeEnabled());
      await user.click(runtime);
      await user.click(await screen.findByRole("option", { name: /Iiro's MacBook Pro/ }));
      await user.click(screen.getByLabelText("Provider"));
      await user.click(await screen.findByRole("option", { name: "Codex CLI" }));
      await user.click(screen.getByLabelText("Model"));
      await user.click(await screen.findByRole("option", { name: "GPT Test" }));
      await user.click(screen.getByLabelText("Reasoning effort"));
      await user.click(await screen.findByRole("option", { name: "high" }));
      await user.click(screen.getByRole("switch", { name: "Network access" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/agents/agent-architect/execution-binding",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ runtimeBackendId: "backend-codex", model: "gpt-test", reasoning: "high", policy: { network: true, readOnlyRoots: [] } }) })
      ));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("edits the name and description independently from their clickable values", async () => {
    const user = userEvent.setup();
    const { save } = renderEditor();

    const nameEdit = screen.getByRole("button", { name: "Edit agent name" });
    expect(screen.queryByLabelText("Agent name")).not.toBeInTheDocument();
    await user.click(nameEdit);
    await user.clear(screen.getByLabelText("Agent name"));
    await user.type(screen.getByLabelText("Agent name"), "Principal Architect");
    await user.click(screen.getByRole("button", { name: "Finish editing agent name" }));

    await user.click(screen.getByRole("button", { name: "Edit agent description" }));
    await user.clear(screen.getByLabelText("Agent description"));
    await user.type(screen.getByLabelText("Agent description"), "Owns technical direction.");
    await user.click(screen.getByRole("button", { name: "Finish editing agent description" }));
    expect(screen.getByLabelText("Runtime")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Environment" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save agent" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("agents", expect.objectContaining({
      name: "Principal Architect",
      description: "Owns technical direction."
    })));
  });
});