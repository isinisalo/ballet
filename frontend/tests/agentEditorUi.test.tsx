import type { Agent, AgentExecutionState, AgentRuntimeConfiguration, AgentSaveRequest, LocalRuntime } from "@shared/api/workspace-contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("edits and saves instructions without duplicate workspace chrome", async () => {
    const user = userEvent.setup();
    const { save } = renderEditor({
      agentId: "agent-architect",
      status: "running",
      provider: "codex"
    });

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("Preview and edit the Markdown injected into every task.")).not.toBeInTheDocument();
    expect(screen.getAllByText("Running")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Architect" })).toBeInTheDocument();
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

    expect(screen.getAllByText("Unbound")).toHaveLength(1);
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

  it("shows adjacent creation errors in the same profile-preview-editor workspace", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (_collection: "agents", item: AgentSaveRequest) => ({ ...agent(), ...item, id: "agent-new" } as Agent));
    render(<AgentEditor runtime={localRuntime()} save={save} remove={vi.fn(async () => undefined)} />);

    expect(screen.getByRole("heading", { name: "New agent" })).toBeInTheDocument();
    expect(screen.getByText("Markdown Preview")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.queryByText("Execution")).not.toBeInTheDocument();
    expect(screen.queryByText("Details")).not.toBeInTheDocument();

    const name = screen.getByLabelText("Name");
    const instructions = screen.getByLabelText("Instructions");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(instructions).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Agent name is required.")).toHaveAttribute("id", name.getAttribute("aria-describedby"));
    expect(screen.getByText("Agent instructions are required.")).toHaveAttribute("id", instructions.getAttribute("aria-describedby"));
    expect(screen.getByRole("button", { name: "Save agent" })).toBeDisabled();

    await user.type(name, "Builder");
    await user.type(instructions, "Build the requested change.");
    expect(screen.getByRole("button", { name: "Save agent" })).toBeEnabled();
  });
});

describe("agent save state", () => {
  it("prevents duplicate saves while a request is pending", async () => {
    let resolveSave: ((saved: Agent) => void) | undefined;
    const save = vi.fn((_collection: "agents", item: AgentSaveRequest) => new Promise<Agent>((resolve) => {
      resolveSave = resolve;
      void item;
    }));
    render(<AgentEditor agent={agent()} runtime={localRuntime()} save={save} remove={vi.fn(async () => undefined)} />);

    const instructions = screen.getByLabelText("Instructions");
    fireEvent.change(instructions, { target: { value: "# Role\nUpdated instructions." } });
    const form = instructions.closest("form");
    if (!form) throw new Error("Expected instructions inside the agent form.");
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Save agent in progress" })).toBeDisabled();
    resolveSave?.({ ...agent(), instructions: "# Role\nUpdated instructions." });
    await waitFor(() => expect(screen.getByTitle("Save agent")).toBeDisabled());
  });

  it("keeps edits made while a save response is pending", async () => {
    let resolveSave: ((saved: Agent) => void) | undefined;
    const save = vi.fn(() => new Promise<Agent>((resolve) => { resolveSave = resolve; }));
    render(<AgentEditor agent={agent()} runtime={localRuntime()} save={save} remove={vi.fn(async () => undefined)} />);

    const instructions = screen.getByLabelText("Instructions");
    fireEvent.change(instructions, { target: { value: "# Role\nSubmitted instructions." } });
    const form = instructions.closest("form");
    if (!form) throw new Error("Expected instructions inside the agent form.");
    fireEvent.submit(form);
    fireEvent.change(instructions, { target: { value: "# Role\nEdited while saving." } });
    resolveSave?.({ ...agent(), instructions: "# Role\nSubmitted instructions." });

    await waitFor(() => expect(instructions).toHaveValue("# Role\nEdited while saving."));
    expect(screen.getByRole("button", { name: "Save agent" })).toBeEnabled();
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
