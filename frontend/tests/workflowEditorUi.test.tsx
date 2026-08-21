import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultLoopTheme, type AppData, type ProjectInstruction } from "@shared/api/workspace-contracts";
import { AutomationView } from "../src/workspace/automation/AutomationView";
import { addJobPair } from "../src/workspace/automation/loops/loopEditorState";
import { emptyData } from "../src/workspace/types";
import { localRuntime } from "./runtimeFixtures";
import { workflowAutomation, workflowLoop } from "./workflowFixtures";

const instruction = (id: string): ProjectInstruction => ({
  id, title: id, body: "Instruction body.", relativePath: `.ballet/instructions/${id}.md`,
  origin: "project", valid: true, sourceSha256: "a".repeat(64), contentSha256: "b".repeat(64), sizeBytes: 17
});
const profile = {
  id: "codex-test", name: "Codex test", provider: "codex" as const,
  model: "gpt-test", reasoningEffort: "high", networkAccess: false
};
const workspace = (): AppData => ({
  ...emptyData,
  executionProfiles: [profile],
  instructions: [instruction("project:architect"), instruction("project:worker")],
  automation: workflowAutomation(workflowLoop("existing-loop")),
  automationIssues: [],
  loopTheme: structuredClone(defaultLoopTheme),
  runtime: localRuntime()
});

describe("strict-v13 Workflow Engineering editor", () => {
  it("creates a Loop with separate Job/Validation Nodes and explicit PASS/FAIL Edges", async () => {
    const user = userEvent.setup();
    const saveAutomation = vi.fn(async (config) => config);
    render(<AutomationView data={workspace()} view="workflow" creating saveAutomation={saveAutomation} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    await user.type(screen.getByLabelText("Loop description"), "Create and validate generic work.");
    await user.type(screen.getByLabelText("State description"), "Canonical shared state.");
    await user.type(screen.getByLabelText("Accepted capabilities"), "test:job.requested");
    await user.type(screen.getByLabelText("Provided capabilities"), "test:job.completed");
    const stateEditor = screen.getByLabelText("Initial State JSON");
    fireEvent.change(stateEditor, { target: { value: "{" } });
    expect(screen.getByText("Initial State must be valid JSON.")).toBeInTheDocument();
    fireEvent.change(stateEditor, { target: { value: '{"count":0}' } });

    await user.click(screen.getByRole("button", { name: "Add Job" }));
    expect(screen.getByRole("form", { name: "Job Node new-loop-job" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Job description"), "Perform the work.");
    await chooseOption(user, "Job node type", "Human");
    await user.type(screen.getByLabelText("Job task"), "Perform the requested work.");
    await user.click(screen.getByRole("button", { name: "Loop definition" }));
    await user.click(screen.getAllByRole("button", { name: "Edit Validation Node new-loop-job-validation" }).at(-1)!);
    expect(screen.getByRole("form", { name: "Validation Node new-loop-job-validation" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Validation description"), "Validate the work.");
    await user.type(screen.getByLabelText("Validation criteria"), "Confirm the requested outcome.");

    expect(screen.getByRole("button", { name: "Save Loop" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save Loop" }));
    await waitFor(() => expect(saveAutomation).toHaveBeenCalled());
    const saved = saveAutomation.mock.calls[0]?.[0];
    expect(saved).toMatchObject({ version: 13 });
    expect(saved?.loops.find((loop) => loop.id === "new-loop")?.workflow).toMatchObject({
      startJobNodeId: "new-loop-job",
      jobNodes: [expect.objectContaining({ id: "new-loop-job", type: "human", maxRetries: 3 })],
      validationNodes: [expect.objectContaining({ id: "new-loop-job-validation", type: "human" })],
      passEdges: [expect.objectContaining({ target: { workflowResult: "PASS" } })],
      failEdges: [expect.objectContaining({ target: { workflowResult: "FAIL" } })]
    });
  });

  it("edits PassEdge and FailEdge in separate inspectors while keeping Graph Edges out", async () => {
    const user = userEvent.setup();
    const data = workspace();
    const loop = data.automation.loops[0]!;
    render(<AutomationView data={data} view="workflow" selectedId={loop.id} saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    await user.click(screen.getAllByRole("button", { name: `Edit Pass Edge ${loop.workflow.passEdges[0]!.id}` }).at(-1)!);
    expect(screen.getByRole("form", { name: `Pass Edge ${loop.workflow.passEdges[0]!.id}` })).toBeInTheDocument();
    expect(screen.getByLabelText("Pass target")).toHaveTextContent("Workflow result · PASS");
    await user.click(screen.getByRole("button", { name: "Loop definition" }));
    await user.click(screen.getAllByRole("button", { name: `Edit Fail Edge ${loop.workflow.failEdges[0]!.id}` }).at(-1)!);
    expect(screen.getByRole("form", { name: `Fail Edge ${loop.workflow.failEdges[0]!.id}` })).toHaveTextContent("escalates outside the Workflow");
    expect(screen.queryByRole("button", { name: "Add Loop Edge" })).not.toBeInTheDocument();
  });

  it("shows Graph Loops as black boxes with Jobs count and the Workflow open action", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<AutomationView data={workspace()} view="graph" saveAutomation={vi.fn(async (value) => value)} navigate={navigate} setNavigationBlocker={vi.fn()} />);
    const node = screen.getByRole("button", { name: /Loop EXISTING-LOOP, ID existing-loop.*1 Jobs/ });
    await user.click(node);
    expect(screen.getByRole("button", { name: "Open Workflow Engineering" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Workflow Engineering" }));
    expect(navigate).toHaveBeenCalledWith("/automation/loops?view=workflow&id=existing-loop");
  });

  it("does not offer Scheduled for a non-start Job or any Validation Node", async () => {
    const user = userEvent.setup();
    const loop = addJobPair(workflowLoop("restriction-loop"));
    const data = workspace();
    data.automation = workflowAutomation(loop);
    render(<AutomationView data={data} view="workflow" selectedId={loop.id} saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    await user.click(screen.getAllByRole("button", { name: "Edit Job Node job-2" }).at(-1)!);
    await user.click(screen.getByRole("combobox", { name: "Job node type" }));
    expect(screen.queryByRole("option", { name: "Scheduled" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Loop definition" }));
    await user.click(screen.getAllByRole("button", { name: "Edit Validation Node job-2-validation" }).at(-1)!);
    await user.click(screen.getByRole("combobox", { name: "Validation node type" }));
    expect(screen.queryByRole("option", { name: "Scheduled" })).not.toBeInTheDocument();
  });

  it("updates the explicit RunBook transition limit from Graph Engineering", () => {
    render(<AutomationView data={workspace()} view="graph" saveAutomation={vi.fn(async (value) => value)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Maximum transitions"), { target: { value: "128" } });
    expect(screen.getByRole("button", { name: "Save graph" })).toBeEnabled();
  });
});

async function chooseOption(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}
