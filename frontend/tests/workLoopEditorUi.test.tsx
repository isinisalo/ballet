import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultLoopTheme, type AppData, type ProjectInstruction } from "@shared/api/workspace-contracts";
import { AutomationView } from "../src/workspace/automation/AutomationView";
import { emptyData } from "../src/workspace/types";
import { localRuntime } from "./runtimeFixtures";
import { v11Automation, v11Loop } from "./v11Fixtures";

const instruction = (id: string): ProjectInstruction => ({
  id,
  title: id,
  body: "Instruction body.",
  relativePath: `.ballet/instructions/${id}.md`,
  origin: "project",
  valid: true,
  sourceSha256: "a".repeat(64),
  contentSha256: "b".repeat(64),
  sizeBytes: 17
});
const profile = {
  id: "codex-test",
  name: "Codex test",
  provider: "codex" as const,
  model: "gpt-test",
  reasoningEffort: "high",
  networkAccess: false
};
const workspace = (): AppData => ({
  ...emptyData,
  executionProfiles: [profile],
  instructions: [instruction("project:architect"), instruction("project:worker")],
  automation: v11Automation(v11Loop("existing-loop")),
  automationIssues: [],
  loopTheme: structuredClone(defaultLoopTheme),
  runtime: localRuntime()
});

describe("strict-v11 Work Loop editor", () => {
  it("creates a Loop with state, composite roles, fixed edges, and an explicit OK target", async () => {
    const user = userEvent.setup();
    const saveAutomation = vi.fn(async (config) => config);
    render(<AutomationView data={workspace()} view="loop" creating saveAutomation={saveAutomation} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    expect(screen.getByRole("form", { name: "Loop definition" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Loop" })).toBeDisabled();
    await user.type(screen.getByLabelText("Loop description"), "Create and validate generic work.");
    await user.type(screen.getByLabelText("State description"), "Canonical shared state.");

    const stateEditor = screen.getByLabelText("Initial state JSON");
    fireEvent.change(stateEditor, { target: { value: "{" } });
    expect(screen.getByText("Initial state must be valid JSON.")).toBeInTheDocument();
    fireEvent.change(stateEditor, { target: { value: '{"count":0}' } });
    expect(screen.queryByText("Initial state must be valid JSON.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add node" }));
    expect(screen.getByRole("form", { name: "Work Loop Node new-loop-work" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work Node" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Validation Node" })).toBeInTheDocument();
    expect(screen.getAllByText("Fixed:", { selector: "strong" })).toHaveLength(2);
    await user.type(screen.getByLabelText("Work Loop Node description"), "Perform and validate the work.");
    await chooseOption(user, "Work node type", "Human");
    await user.type(screen.getByLabelText("Work task"), "Perform the requested work.");
    await user.type(screen.getByLabelText("Validation criteria"), "Validate the completed work.");

    await user.click(screen.getByRole("button", { name: "Loop definition" }));
    expect(screen.getByLabelText("new-loop-work Validation OK target")).toHaveTextContent("Terminal · completed");
    expect(screen.getByRole("button", { name: "Save Loop" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save Loop" }));
    await waitFor(() => expect(saveAutomation).toHaveBeenCalled());
    const saved = saveAutomation.mock.calls[0]?.[0];
    expect(saved).toMatchObject({ version: 11 });
    expect(saved?.loops.find((loop) => loop.id === "new-loop")).toMatchObject({
      id: "new-loop",
      state: { initial: { count: 0 } },
      nodes: [expect.objectContaining({ work: expect.objectContaining({ type: "human" }), validation: expect.objectContaining({ type: "human" }) })],
      edges: [expect.objectContaining({ source: "new-loop-work", target: { terminal: "completed" } })]
    });
  });

  it("shows each Loop as one box and keeps internal nodes, State, and Edges in the detailed editor", () => {
    const first = v11Loop("source-loop");
    const target = v11Loop("target-loop");
    const config = v11Automation(first, target);
    config.graph.loopEdges = [{ id: "source-repair", source: first.id, target: target.id, kind: "repair", capability: "test:loop.transfer", description: "Repair generic work." }];
    const data = workspace();
    data.automation = config;
    render(<AutomationView data={data} view="graph" saveAutomation={vi.fn(async (value) => value)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Loop Orchestrator" })).toBeInTheDocument();
    expect(screen.getByText("Routing component")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Custom Loop source-loop/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Custom Loop target-loop/ })).toBeInTheDocument();
    expect(screen.getAllByText("Custom Loop")).toHaveLength(2);
    expect(screen.queryByText(/Work · agent/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Validation · human/)).not.toBeInTheDocument();
    expect(screen.queryByText("Repair generic work.")).not.toBeInTheDocument();
  });

  it("edits Validation OK and repair Loop Edges without exposing fixed internal edges", async () => {
    const user = userEvent.setup();
    const source = v11Loop("source-loop");
    const target = v11Loop("target-loop");
    target.nodes[0] = { ...target.nodes[0]!, id: "target-work" };
    target.startNodeId = "target-work";
    target.edges[0] = { ...target.edges[0]!, source: "target-work" };
    const data = workspace();
    data.automation = v11Automation(source, target);
    const saveAutomation = vi.fn(async (config) => config);
    render(<AutomationView data={data} view="loop" selectedId={source.id} saveAutomation={saveAutomation} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    await chooseOption(user, "work Validation OK target", "Terminal · failed");
    expect(screen.queryByRole("button", { name: "Add Loop Edge" })).not.toBeInTheDocument();
    expect(screen.getByText("Connections to other Loops are edited in Graph Engineering.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save Loop" }));
    await waitFor(() => expect(saveAutomation).toHaveBeenCalled());
    expect(saveAutomation.mock.calls[0]?.[0].loops.find((loop) => loop.id === source.id)?.edges[0]?.target).toEqual({ terminal: "failed" });

    cleanup();
    const graphSave = vi.fn(async (config) => config);
    render(<AutomationView data={data} view="graph" saveAutomation={graphSave} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Custom Loop source-loop/ }));
    await user.click(screen.getByRole("button", { name: "Add Loop Edge" }));
    await chooseOption(user, "Loop Edge kind", "Repair allowlist");
    expect(screen.getByLabelText("Target Loop")).toHaveTextContent("target-loop");
    expect(screen.queryByLabelText(/Work completed target/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save graph" }));
    await waitFor(() => expect(graphSave).toHaveBeenCalled());
    expect(graphSave.mock.calls[0]?.[0].graph.loopEdges[0]).toMatchObject({ source: source.id, target: target.id, kind: "repair" });
  });

  it("updates explicit orchestrator limits from Graph Engineering", () => {
    const config = v11Automation(v11Loop("orchestrated-loop"));
    const data = workspace(); data.automation = config;
    render(<AutomationView data={data} view="graph" saveAutomation={vi.fn(async (value) => value)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Maximum repair depth"), { target: { value: "7" } });
    expect(screen.getByRole("button", { name: "Save graph" })).toBeEnabled();
  });

  it("does not offer Scheduled for non-start Work or any Validation Node", async () => {
    const user = userEvent.setup();
    const loop = v11Loop("restriction-loop");
    const second = structuredClone(loop.nodes[0]!);
    second.id = "validate-more";
    second.description = "Second composite node.";
    loop.nodes.push(second);
    loop.edges[0] = { ...loop.edges[0]!, target: { nodeId: second.id } };
    loop.edges.push({ id: "validate-more-ok", source: second.id, target: { terminal: "completed" } });
    const data = workspace();
    data.automation = v11Automation(loop);
    render(<AutomationView data={data} view="loop" selectedId={loop.id} saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: `Edit Work Loop Node ${second.id}` }));
    await user.click(screen.getByRole("combobox", { name: "Work node type" }));
    expect(screen.queryByRole("option", { name: "Scheduled" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("combobox", { name: "Validation node type" }));
    expect(screen.queryByRole("option", { name: "Scheduled" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("form", { name: `Work Loop Node ${second.id}` })).getByLabelText("Validation criteria")).toBeInTheDocument();
  });
});

async function chooseOption(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}
