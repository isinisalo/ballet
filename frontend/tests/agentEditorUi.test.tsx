import type { Agent, AgentExecutionState, AgentRuntimeConfiguration, AgentSaveRequest, LocalRuntime } from "@shared/api/workspace-contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentEditor } from "../src/workspace/agents/AgentEditor";
import { agentRuntimeConfiguration, localProvider, localRuntime } from "./runtimeFixtures";

const agent = (): Agent => ({
  id: "agent-architect",
  name: "Architect",
  description: "Designs durable technical systems.",
  instructions: "# Role\nDesign the system.",
  skills: [],
  enabled: true,
  avatar: "compass",
  createdAt: "2026-07-11T10:00:00.000Z",
  updatedAt: "2026-07-11T12:00:00.000Z",
  relativePath: ".codex/agents/brief-agent.toml"
} as Agent);

const emptyRuntimeConfiguration = (): AgentRuntimeConfiguration => ({ localPolicy: { readOnlyRoots: [] }, issues: [] });

const renderEditor = (
  executionState?: AgentExecutionState,
  runtimeConfiguration: AgentRuntimeConfiguration = emptyRuntimeConfiguration(),
  runtime: LocalRuntime = localRuntime()
) => {
  const selectedAgent = agent();
  const save = vi.fn(async (_collection: "agents", item: AgentSaveRequest) => ({ ...selectedAgent, ...item } as Agent));
  const remove = vi.fn(async () => undefined);
  render(<AgentEditor agent={selectedAgent} executionState={executionState} runtime={runtime} runtimeConfiguration={runtimeConfiguration} save={save} remove={remove} />);
  return { save, remove };
};

describe("agent instructions workspace", () => {
  it("edits and saves instructions while keeping other tabs unavailable", async () => {
    const user = userEvent.setup();
    const { save } = renderEditor({
      agentId: "agent-architect",
      status: "running",
      provider: "codex"
    });

    expect(screen.getByRole("tab", { name: "Instructions" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Activity" })).toBeDisabled();
    expect(screen.queryByRole("tab", { name: "Tasks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Custom Args" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Running")).toHaveLength(2);
    expect(screen.queryByLabelText("Runtime")).not.toBeInTheDocument();
    expect(screen.getByText("Markdown Preview")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Role" })).toBeInTheDocument();

    const instructions = screen.getByLabelText("Instructions");
    await user.clear(instructions);
    await user.type(instructions, "# Role\nPlan the technical direction.");
    expect(screen.getByText("Plan the technical direction.", { selector: "p" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save agent" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("agents", expect.objectContaining({
      instructions: "# Role\nPlan the technical direction."
    })));
  });

  it("keeps execution configuration in the profile rail without an Environment tab", () => {
    renderEditor();

    expect(screen.getAllByText("Unbound").length).toBeGreaterThan(0);
    expect(screen.getByText("Execution")).toBeInTheDocument();
    expect(screen.queryByLabelText("Runtime")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
    expect(screen.getByLabelText("Reasoning effort")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Network access" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Node style")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Agent enabled" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save execution" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Environment" })).not.toBeInTheDocument();
  });

  it("renders the saved runtime configuration in the compact Execution section", async () => {
    const runtime = localRuntime({ providers: [localProvider({ provider: "copilot", command: "/opt/homebrew/bin/copilot" })] });
    renderEditor(
      { agentId: "agent-architect", status: "running", provider: "copilot" },
      agentRuntimeConfiguration({ agentId: "agent-architect", provider: "copilot" }),
      runtime
    );

    expect(screen.queryByLabelText("Runtime")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toHaveTextContent("GitHub Copilot CLI");
    expect(screen.getByLabelText("Model")).toHaveTextContent("GPT Test");
    expect(screen.getByLabelText("Reasoning effort")).toHaveTextContent("high");
  });

  it("saves execution settings automatically from the profile rail", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/agents/agent-architect/runtime" && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body)) as { provider: "codex"; model: string; reasoning: string; policy: { network: boolean; readOnlyRoots: string[] } };
        return Response.json(agentRuntimeConfiguration({ agentId: "agent-architect", provider: payload.provider, model: payload.model, reasoning: payload.reasoning, network: payload.policy.network, readOnlyRoots: payload.policy.readOnlyRoots }));
      }
      return Response.json({ error: `Unhandled ${init?.method ?? "GET"} ${url}` }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      renderEditor();
      await user.click(screen.getByLabelText("Provider"));
      await user.click(await screen.findByRole("option", { name: "Codex CLI" }));
      await user.click(screen.getByLabelText("Model"));
      await user.click(await screen.findByRole("option", { name: "GPT Test" }));
      await user.click(screen.getByLabelText("Reasoning effort"));
      await user.click(await screen.findByRole("option", { name: "high" }));
      await user.click(screen.getByRole("switch", { name: "Network access" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/agents/agent-architect/runtime",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ provider: "codex", model: "gpt-test", reasoning: "high", policy: { network: true, readOnlyRoots: [] } }) })
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
    expect(screen.queryByLabelText("Runtime")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Environment" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save agent" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("agents", expect.objectContaining({
      name: "Principal Architect",
      description: "Owns technical direction."
    })));
  });
});

describe("agent avatar", () => {
  it("previews an avatar change and persists it with Save agent", async () => {
    const user = userEvent.setup();
    const { save } = renderEditor();

    expect(screen.getByRole("img", { name: "Compass avatar preview" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit agent description" }));
    await user.clear(screen.getByLabelText("Agent description"));
    await user.type(screen.getByLabelText("Agent description"), "Unsaved description");
    await user.click(screen.getByLabelText("Avatar"));
    await user.click(await screen.findByRole("option", { name: "Rocket" }));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Agent description")).toHaveValue("Unsaved description");
    expect(screen.getByRole("img", { name: "Rocket avatar preview" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save agent" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("agents", expect.objectContaining({
      id: "agent-architect",
      avatar: "rocket",
      description: "Unsaved description"
    })));
  });

  it("clears an avatar with None", async () => {
    const user = userEvent.setup();
    const { save } = renderEditor();

    await user.click(screen.getByLabelText("Avatar"));
    await user.click(await screen.findByRole("option", { name: "None" }));

    expect(screen.getByRole("img", { name: "No avatar selected" }).querySelector("svg")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save agent" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("agents", expect.objectContaining({ avatar: null })));
  });

  it("supports choosing an avatar while creating an agent", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (_collection: "agents", item: AgentSaveRequest) => ({ ...agent(), ...item, id: "agent-new" } as Agent));
    const remove = vi.fn(async () => undefined);
    render(<AgentEditor runtime={localRuntime()} save={save} remove={remove} />);

    expect(screen.getByRole("img", { name: "No avatar selected" }).querySelector("svg")).toBeNull();
    await user.type(screen.getByLabelText("Name"), "Builder");
    await user.type(screen.getByLabelText("Instructions"), "Build the requested change.");
    await user.click(screen.getByLabelText("Avatar"));
    await user.click(await screen.findByRole("option", { name: "Brain circuit" }));
    expect(screen.getByRole("img", { name: "Brain circuit avatar preview" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save agent" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("agents", expect.objectContaining({
      name: "Builder",
      avatar: "brain-circuit"
    })));
  });
});
