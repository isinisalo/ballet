import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionWorkspace } from "../src/orchestration/configure/ActionWorkspace";
import { AgentDefinitionsWorkspace } from "../src/orchestration/configure/AgentDefinitionsWorkspace";
import { CriticWorkspace } from "../src/orchestration/configure/CriticWorkspace";
import { DirectionWorkspace } from "../src/orchestration/configure/DirectionWorkspace";
import { EnvironmentWorkspace } from "../src/orchestration/configure/EnvironmentWorkspace";
import { ResourceWorkspace } from "../src/orchestration/configure/ResourceWorkspace";
import { RuntimesWorkspace } from "../src/orchestration/configure/RuntimesWorkspace";
import { StateWorkspace } from "../src/orchestration/configure/StateWorkspace";
import { UseCasesWorkspace } from "../src/orchestration/configure/UseCasesWorkspace";
import { OrchestrationSidebar } from "../src/orchestration/OrchestrationSidebar";
import { SidebarProvider, SidebarTrigger } from "../src/components/ui/sidebar";
import { orchestrationApi, orchestrationApiBase } from "../src/orchestration/orchestrationApi";
import { resources, orchestrationConfig } from "./orchestrationFixtures";

const directionProps = () => { const config = orchestrationConfig(); return { direction: config.direction, documents: { goals: [{ kind: "goal" as const, id: "goal-1", content: "# Goal", contentHash: "a".repeat(64) }], adrs: [], constraints: [] }, references: [], locked: false, onSave: vi.fn(), onDelete: vi.fn() }; };

describe("orchestration Configure UI", () => {
  it("renders Direction list/detail selection", async () => { const user = userEvent.setup(); render(<DirectionWorkspace {...directionProps()} />); await user.click(screen.getByRole("button", { name: /goal-1 Goal/ })); expect(screen.getByRole("heading", { name: "Edit goal-1" })).toBeInTheDocument(); });
  it("renders Constraint kind and status as text", async () => { const user = userEvent.setup(); render(<DirectionWorkspace {...directionProps()} />); await user.click(screen.getByRole("button", { name: /constraint-1 No skip/ })); expect(screen.getByLabelText("Constraint semantics")).toHaveValue("prohibited"); expect(screen.getAllByText("accepted").length).toBeGreaterThan(0); });
  it("disables Direction delete when references exist", async () => { const user = userEvent.setup(); const props = directionProps(); props.references = [{ kind: "goal", id: "goal-1", references: [{ ownerType: "use-case", ownerId: "UC-1", field: "goalIds" }] }]; render(<DirectionWorkspace {...props} />); await user.click(screen.getByRole("button", { name: /goal-1 Goal/ })); expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled(); });
  it("renders Use Case draft editing", async () => { const user = userEvent.setup(); const config = orchestrationConfig(); const draft = { ...config.direction.useCases[0]!, status: "draft" as const, approval: undefined }; render(<UseCasesWorkspace useCases={[draft]} documents={[]} locked={false} onSave={vi.fn()} onApprove={vi.fn()} onDraft={vi.fn()} />); await user.click(screen.getByRole("button", { name: /UC-1/ })); expect(screen.getByLabelText("Name")).toHaveValue("Deliver outcome"); expect(screen.getByRole("button", { name: "Save draft content" })).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Approve…" })).toBeInTheDocument(); });
  it("requires explicit Use Case approval confirmation with hash", async () => { const user = userEvent.setup(); const config = orchestrationConfig(); const draft = { ...config.direction.useCases[0]!, status: "draft" as const, approval: undefined }; const approve = vi.fn(); render(<UseCasesWorkspace useCases={[draft]} documents={[]} locked={false} onSave={vi.fn()} onApprove={approve} onDraft={vi.fn()} />); await user.click(screen.getByRole("button", { name: /UC-1/ })); await user.click(screen.getByRole("button", { name: "Approve…" })); expect(screen.getByRole("dialog")).toHaveTextContent(/[a-f0-9]{64}/); await user.click(screen.getByRole("button", { name: "Approve exact content" })); expect(approve).toHaveBeenCalledOnce(); });
  it("warns that an approved semantic edit returns to draft", async () => { const user = userEvent.setup(); const useCase = orchestrationConfig().direction.useCases[0]!; render(<UseCasesWorkspace useCases={[useCase]} documents={[]} locked={false} onSave={vi.fn()} onApprove={vi.fn()} onDraft={vi.fn()} />); await user.click(screen.getByRole("button", { name: /UC-1/ })); await user.clear(screen.getByLabelText("Name")); await user.type(screen.getByLabelText("Name"), "Changed"); expect(screen.getByRole("alert")).toHaveTextContent("returns this Use Case to draft"); });
  it("renders only State IDs in ascending order", () => { const config = orchestrationConfig(); render(<EnvironmentWorkspace environment={{ ...config.environment, states: [...config.environment.states].reverse() }} issues={[]} locked={false} navigate={vi.fn()} onSave={vi.fn()} onCreate={vi.fn()} onReorder={vi.fn()} />); const lanes = screen.getByRole("list", { name: "Ordered State lanes" }); expect(within(lanes).getAllByRole("button", { name: /Open State/ }).map((item) => item.textContent)).toEqual(["state-1", "state-2"]); expect(within(lanes).queryByText(/ORDER|Build|Verify/)).not.toBeInTheDocument(); });
  it("owns fixed Agent selection in the canonical sidebar URL", async () => { window.history.replaceState({}, "", "/agents/ballet-critic-agent"); const user = userEvent.setup(); const navigate = vi.fn(); const data = sidebarData(); render(<SidebarProvider><OrchestrationSidebar route={{ view: "orchestration", workspaceView: "agents", entityId: "ballet-critic-agent" }} data={data} navigate={navigate} /></SidebarProvider>); const entity = screen.getByRole("button", { name: /Critic Agentready/ }); expect(entity).toHaveAttribute("aria-current", "page"); await user.click(entity); expect(navigate).toHaveBeenCalledWith("/agents/ballet-critic-agent"); });
  it("renders the Loop Engineering State and Action hierarchy in canonical order", () => {
    window.history.replaceState({}, "", "/automation/loops/states/state-1/actions/action-1");
    const config = orchestrationConfig();
    const firstState = config.environment.states[0]!;
    const secondAction = { ...firstState.actions[0]!, id: "action-later", name: "Package", priority: 2 };
    config.environment.states = [{ ...config.environment.states[1]! }, { ...firstState, actions: [secondAction, firstState.actions[0]!] }];
    render(<SidebarProvider><OrchestrationSidebar route={{ view: "orchestration", workspaceView: "action", stateId: "state-1", actionId: "action-1", canvasMode: "flow" }} data={sidebarData(config)} navigate={vi.fn()} /></SidebarProvider>);
    const hierarchy = screen.getByRole("list", { name: "Loop Engineering hierarchy" });
    expect(within(hierarchy).getAllByText(/^S\d$/).map((node) => node.textContent)).toEqual(["S1", "S2"]);
    expect(within(hierarchy).getAllByText(/^A\d$/).map((node) => node.textContent)).toEqual(["A1", "A2"]);
    expect(screen.getByRole("button", { name: "Open Action action-1: Implement" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Loop Engineering" })).not.toHaveAttribute("aria-current");
  });
  it("navigates the exact hierarchy URLs and toggles non-selected States from the keyboard", async () => {
    window.history.replaceState({}, "", "/automation/loops/states/state-1");
    const user = userEvent.setup(); const navigate = vi.fn();
    render(<SidebarProvider><OrchestrationSidebar route={{ view: "orchestration", workspaceView: "state", stateId: "state-1" }} data={sidebarData()} navigate={navigate} /></SidebarProvider>);
    expect(screen.getByRole("button", { name: "Open State state-1: Build" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Open Action action-1: Implement" })).toBeInTheDocument();
    const expand = screen.getByRole("button", { name: "Expand Actions for State Verify" });
    expand.focus(); await user.keyboard("{Enter}");
    expect(expand).toHaveAttribute("aria-expanded", "true");
    const action = screen.getByRole("button", { name: "Open Action action-2: Verify" });
    await user.click(action); expect(navigate).toHaveBeenLastCalledWith("/automation/loops/states/state-2/actions/action-2");
    await user.click(screen.getByRole("button", { name: "Collapse Actions for State Verify" }));
    expect(screen.queryByRole("button", { name: "Open Action action-2: Verify" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open State state-2: Verify" }));
    expect(navigate).toHaveBeenLastCalledWith("/automation/loops/states/state-2");
  });
  it("keeps the mobile sidebar open for disclosure and closes it after hierarchy navigation", async () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
    window.history.replaceState({}, "", "/automation/loops");
    const user = userEvent.setup(); const navigate = vi.fn();
    render(<SidebarProvider><SidebarTrigger aria-label="Open navigation" /><OrchestrationSidebar route={{ view: "orchestration", workspaceView: "environment" }} data={sidebarData()} navigate={navigate} /></SidebarProvider>);
    await waitFor(() => expect(screen.queryByText("Ballet")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Loop Engineering" })).toHaveAttribute("aria-current", "page");
    await user.click(within(dialog).getByRole("button", { name: "Expand Actions for State Build" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Open Action action-1: Implement" }));
    expect(navigate).toHaveBeenCalledWith("/automation/loops/states/state-1/actions/action-1");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("supports keyboard drag and drop for State reorder", async () => { const user = userEvent.setup(); const reorder = vi.fn().mockResolvedValue(true); const config = orchestrationConfig(); render(<EnvironmentWorkspace environment={config.environment} issues={[]} locked={false} navigate={vi.fn()} onSave={vi.fn()} onCreate={vi.fn()} onReorder={reorder} />); const handle = screen.getByRole("button", { name: "Reorder State state-1" }); handle.focus(); await user.keyboard("{Alt>}{ArrowDown}{/Alt}"); await waitFor(() => expect(reorder).toHaveBeenCalledWith(["state-2", "state-1"])); expect(screen.getByText("State state-1 moved to position 2 of 2.")).toBeInTheDocument(); });
  it("restores canonical order when immediate persistence fails", async () => { const user = userEvent.setup(); const reorder = vi.fn().mockResolvedValue(false); const config = orchestrationConfig(); render(<EnvironmentWorkspace environment={config.environment} issues={[]} locked={false} navigate={vi.fn()} onSave={vi.fn()} onCreate={vi.fn()} onReorder={reorder} />); const handle = screen.getByRole("button", { name: "Reorder State state-1" }); handle.focus(); await user.keyboard("{Alt>}{ArrowDown}{/Alt}"); await waitFor(() => expect(reorder).toHaveBeenCalledOnce()); expect(screen.getAllByRole("button", { name: /Open State/ }).map((item) => item.textContent)).toEqual(["state-1", "state-2"]); });
  it("disables sortable handles while authoring is locked", () => { const config = orchestrationConfig(); render(<EnvironmentWorkspace environment={config.environment} issues={[]} locked navigate={vi.fn()} onSave={vi.fn()} onCreate={vi.fn()} onReorder={vi.fn()} />); expect(screen.getByRole("button", { name: "Reorder State state-1" })).toBeDisabled(); });
  it("renders only Action IDs by priority", () => { const state = orchestrationConfig().environment.states[0]!; const second = { ...state.actions[0]!, id: "action-0", priority: 2 }; render(<StateWorkspace state={{ ...state, actions: [second, state.actions[0]!] }} locked={false} navigate={vi.fn()} onSave={vi.fn()} onReorderActions={vi.fn()} onCreateAction={vi.fn()} onDelete={vi.fn()} />); const actions = screen.getByRole("list", { name: "Actions by priority" }); expect(within(actions).getAllByRole("button", { name: /Open Action/ }).map((item) => item.textContent)).toEqual(["action-1", "action-0"]); expect(screen.queryByLabelText("Unique order")).not.toBeInTheDocument(); expect(screen.queryByLabelText("Use Case refs")).not.toBeInTheDocument(); });
  it("presents Validation as main and Work as subordinate", () => { renderAction(); expect(screen.getByText("Validation Agent · main/controller")).toBeInTheDocument(); expect(screen.getByText("Work Agent · subordinate")).toBeInTheDocument(); });
  it("uses only the workspace title for Action metadata", () => { renderAction(); expect(screen.getAllByRole("heading", { name: "Implement" })).toHaveLength(1); expect(screen.queryByText("Action metadata")).not.toBeInTheDocument(); });
  it("explains the total attempts beside compact maxRetries", () => { renderAction(); expect(screen.getByText("3 total Work attempts")).toBeInTheDocument(); expect(screen.getByLabelText("maxRetries")).toHaveClass("w-20"); expect(screen.queryByLabelText("Priority")).not.toBeInTheDocument(); });
  it("reports missing instruction sections", () => { mockActionExecution(); const config = orchestrationConfig(); render(<ActionWorkspace stateId="state-1" action={config.environment.states[0]!.actions[0]} instructions={[{ ...resources()[0]!, content: "# Missing" }, resources()[1]!]} skills={[resources()[2]!]} locked={false} navigate={vi.fn()} onCanvasModeChange={vi.fn()} onSave={vi.fn()} />); expect(screen.getByText("Missing Task section")).toBeInTheDocument(); });
  it("opens and closes the Action flow with an accessible control", async () => { mockActionExecution(); const user = userEvent.setup(); const changeMode = vi.fn(); const config = orchestrationConfig(); const props = { stateId: "state-1", action: config.environment.states[0]!.actions[0], instructions: resources().filter((item) => item.kind === "instruction"), skills: resources().filter((item) => item.kind === "skill"), locked: false, navigate: vi.fn(), onCanvasModeChange: changeMode, onSave: vi.fn() }; const { rerender } = render(<ActionWorkspace {...props} />); await user.click(screen.getByRole("button", { name: "Open Action flow" })); expect(changeMode).toHaveBeenCalledWith("flow"); await user.type(screen.getByLabelText("Name"), " draft"); rerender(<ActionWorkspace {...props} canvasMode="flow" />); expect(screen.getByLabelText("Name")).toHaveValue(`${props.action.name} draft`); await user.click(screen.getByRole("button", { name: "Show space canvas" })); expect(changeMode).toHaveBeenLastCalledWith("space"); });
  it("locks authoring controls during an active Run", () => { renderAction(true); expect(screen.getByRole("button", { name: "Save Action" })).toBeDisabled(); expect(screen.getByText("Locked by active Run")).toBeInTheDocument(); });
  it("keeps a dirty resource draft when refreshed props arrive", async () => { const user = userEvent.setup(); const resource = resources()[0]!; const navigate = vi.fn(); const { rerender } = render(<ResourceWorkspace kind="instructions" resources={[resource]} references={[]} locked={false} selectedId="validation" navigate={navigate} onSave={vi.fn()} />); await user.type(screen.getByLabelText("Markdown Body"), "\nlocal draft"); rerender(<ResourceWorkspace kind="instructions" resources={[{ ...resource, content: `${resource.content}\nserver refresh` }]} references={[]} locked={false} selectedId="validation" navigate={navigate} onSave={vi.fn()} />); expect(screen.getByLabelText("Markdown Body")).toHaveValue(`${resource.content.trimEnd()}\nlocal draft`); });
  it("renders the fixed three-column Agent editor without Preview or lifecycle actions", async () => { vi.spyOn(orchestrationApi, "localRuntime").mockResolvedValue({ status: "offline", daemonVersion: "unknown", uptimeSeconds: 0, activeTaskCount: 0, lastSeenAt: new Date(0).toISOString(), refreshRequested: false, restartRequested: false, providers: [] }); render(<AgentDefinitionsWorkspace response={agentsResponse()} skills={resources().filter(({ kind }) => kind === "skill")} selectedId="ballet-critic-agent" locked={false} onSave={vi.fn()} />); expect(screen.getByRole("complementary", { name: "Agent profile" })).toHaveTextContent("Critic Agent"); expect(screen.getByRole("main", { name: "Developer instructions editor" })).toBeInTheDocument(); expect(screen.getByRole("complementary", { name: "Agent purpose guide" })).toHaveTextContent("Human approval alone creates Feedback"); expect(screen.queryByText("Preview")).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: /New Agent|Delete Agent/ })).not.toBeInTheDocument(); expect(screen.getAllByRole("toolbar")).toHaveLength(1); });
  it("shows one Codex-only local daemon and disables restart while work is active", async () => { const now = new Date().toISOString(); vi.spyOn(orchestrationApi, "localRuntime").mockResolvedValue({ status: "online", daemonVersion: "3", uptimeSeconds: 12, activeTaskCount: 1, lastSeenAt: now, refreshRequested: false, restartRequested: false, providers: [{ provider: "codex", health: "ready", authStatus: "ready", busy: true, updatedAt: now, capabilities: { models: [{ id: "gpt", label: "GPT", reasoningOptions: ["medium"] }], supportsResume: true, supportsStructuredOutput: true, policy: { workspaceWrite: true }, refreshedAt: now } }] }); render(<RuntimesWorkspace navigate={vi.fn()} />); expect(await screen.findByRole("heading", { name: "Checkout-local daemon" })).toBeInTheDocument(); expect(screen.queryByText(/pair/i)).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Restart daemon" })).toBeDisabled(); expect(screen.getByText("Codex CLI")).toBeInTheDocument(); });
  it("shows shared Skill impact warning", () => { render(<ResourceWorkspace kind="skills" resources={[resources()[2]!]} references={[{ kind: "skill", id: "shared-skill", references: [{ ownerType: "action", ownerId: "action-1", field: "validation.skillResources" }] }]} locked={false} selectedId="shared-skill" navigate={vi.fn()} onSave={vi.fn()} />); expect(screen.getByRole("alert")).toHaveTextContent("impacts 1 referencing role"); });
  it("renders Critic disabled by default", () => { const config = orchestrationConfig(); render(<CriticWorkspace critic={config.critic} statuses={[]} locked={false} onSave={vi.fn()} onManual={vi.fn()} />); expect(screen.getByText("Disabled (default)")).toBeInTheDocument(); expect(screen.getByRole("switch", { name: "Enable automatic Critic schedules" })).toHaveAttribute("aria-checked", "false"); });
  it("edits a Critic IANA timezone", async () => { const user = userEvent.setup(); const config = orchestrationConfig(); render(<CriticWorkspace critic={config.critic} statuses={[]} locked={false} onSave={vi.fn()} onManual={vi.fn()} />); const zone = screen.getByLabelText("IANA timezone"); await user.clear(zone); await user.type(zone, "UTC"); expect(zone).toHaveValue("UTC"); });
  it("keeps manual Critic creation separate from approval", async () => { const user = userEvent.setup(); const manual = vi.fn(); const config = orchestrationConfig(); render(<CriticWorkspace critic={config.critic} statuses={[]} locked={false} onSave={vi.fn()} onManual={manual} />); await user.click(screen.getByRole("button", { name: "Create critic proposal now" })); expect(manual).toHaveBeenCalledOnce(); expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument(); });
  it("renders invalid State deep links with recovery", () => { render(<StateWorkspace locked={false} navigate={vi.fn()} onSave={vi.fn()} onReorderActions={vi.fn()} onCreateAction={vi.fn()} onDelete={vi.fn()} />); expect(screen.getByRole("heading", { name: "State not found" })).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Return to Environment" })).toBeInTheDocument(); });
  it("keeps core actions in one responsive toolbar", () => { renderAction(); const save = screen.getByRole("button", { name: "Save Action" }); expect(save).toHaveAttribute("form", "action-action-1"); expect(screen.getAllByRole("toolbar")).toHaveLength(1); expect(screen.getByRole("button", { name: "Open Action flow" })).toBeInTheDocument(); });
  it("uses the canonical API prefix in orchestration data modules", () => { expect(orchestrationApiBase).toBe("/api"); });
  it("keeps Action execution Codex-only with model/reasoning role fields", () => { renderAction(); expect(screen.getByLabelText("maxRetries")).toHaveAttribute("type", "number"); const execution = screen.getByRole("group", { name: "Action execution" }); const validation = screen.getByRole("group", { name: "Validation Agent · main/controller" }); expect(execution).toHaveTextContent("Codex CLI is fixed"); expect(screen.queryByLabelText("Provider")).not.toBeInTheDocument(); expect(screen.queryByRole("switch", { name: "Network" })).not.toBeInTheDocument(); expect(screen.queryByLabelText("Read-only roots")).not.toBeInTheDocument(); expect(within(validation).getByLabelText("Model")).toBeInTheDocument(); expect(within(validation).getByLabelText("Instruction")).toBeInTheDocument(); expect(within(validation).getByLabelText("Validation Skills")).toBeInTheDocument(); });
  it("saves both Action role selections atomically", async () => {
    const user = userEvent.setup(); const save = mockReadyActionExecution(); renderActionWorkspace();
    await waitFor(() => expect(screen.getAllByLabelText("Model")).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: "Save execution" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("state-1", "action-1", {
      validation: { model: "gpt", reasoningEffort: "medium" }, work: { model: "gpt", reasoningEffort: "medium" }
    }));
  });
  it("reports one missing Action execution binding in Run readiness", async () => { renderAction(); await waitFor(() => expect(screen.getByText("Action execution binding is missing.")).toBeInTheDocument()); expect(screen.getByRole("toolbar")).toHaveTextContent("Not ready"); });
});

function renderAction(locked = false) { mockActionExecution(); renderActionWorkspace(locked); }

function renderActionWorkspace(locked = false) { const config = orchestrationConfig(); render(<ActionWorkspace stateId="state-1" action={config.environment.states[0]!.actions[0]} instructions={resources().filter((item) => item.kind === "instruction")} skills={resources().filter((item) => item.kind === "skill")} locked={locked} navigate={vi.fn()} onCanvasModeChange={vi.fn()} onSave={vi.fn()} />); }

function mockActionExecution() {
  vi.spyOn(orchestrationApi, "localRuntime").mockResolvedValue({ status: "offline", daemonVersion: "unknown", uptimeSeconds: 0, activeTaskCount: 0, lastSeenAt: new Date(0).toISOString(), refreshRequested: false, restartRequested: false, providers: [] });
  vi.spyOn(orchestrationApi, "actionBinding").mockResolvedValue(null);
}

function mockReadyActionExecution() {
  const at = "2026-08-30T10:00:00.000Z";
  vi.spyOn(orchestrationApi, "localRuntime").mockResolvedValue({ status: "online", daemonVersion: "2", uptimeSeconds: 10,
    activeTaskCount: 0, lastSeenAt: at, refreshRequested: false, restartRequested: false, providers: [
      { provider: "codex", cliVersion: "1", authStatus: "ready", health: "ready", busy: false, updatedAt: at,
        capabilities: { models: [{ id: "gpt", label: "Codex Model", reasoningOptions: ["medium"], defaultReasoning: "medium" }],
          supportsResume: true, supportsStructuredOutput: true, policy: { workspaceWrite: true }, refreshedAt: at } }
    ] });
  vi.spyOn(orchestrationApi, "actionBinding").mockResolvedValue({ version: 3, actionId: "action-1",
    validation: { model: "gpt", reasoningEffort: "medium" }, work: { model: "gpt", reasoningEffort: "medium" }, updatedAt: at });
  return vi.spyOn(orchestrationApi, "saveActionBinding").mockImplementation(async (stateId, actionId, input) => ({
    version: 3, actionId, ...input, updatedAt: at
  }));
}

function agentsResponse() { const hash = "d".repeat(64); return { configHash: "a".repeat(64), agents: (["ballet-critic-agent", "ballet-refinement-agent"] as const).map((id) => ({ id, relativePath: `.codex/agents/${id}.toml`, status: "ready" as const, contentHash: hash, skillResources: ["shared-skill"], agent: { id, name: id, description: "Read-only governance Agent.", developerInstructions: "## Task\nInspect evidence.", model: "gpt-5.6-sol", reasoningEffort: id === "ballet-critic-agent" ? "low" : "high", sandboxMode: "read-only" as const } })) }; }
function sidebarData(config = orchestrationConfig()) {
  return { project: { path: "/project", config, configHash: "a".repeat(64) }, references: { entries: [], runReferences: [], activeRunIds: [] }, instructions: resources().filter(({ kind }) => kind === "instruction"), skills: resources().filter(({ kind }) => kind === "skill"), goals: [], adrs: [], constraints: [], useCases: [], agents: agentsResponse(), schedules: [] };
}
