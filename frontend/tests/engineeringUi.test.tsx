import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultLoopTheme, type AppData } from "@shared/api/workspace-contracts";
import { AutomationView } from "../src/workspace/automation/AutomationView";
import { emptyData } from "../src/workspace/types";
import { rootEvidence, routeEvidence, targetRunEvidence } from "./graphEngineeringRuntimeFixtures";
import { localRuntime } from "./runtimeFixtures";
import { projectInstruction } from "./projectInstructionFixture";
import { installedStatus, loopModuleActions } from "./loopModuleUiFixtures";
import { workflowAutomation, workflowLoop } from "./workflowFixtures";

describe("Graph and Workflow Engineering workspace", () => {
  it("shows Graph Engineering as the active default authoring view", () => {
    const rendered = renderView({ view: "graph", navigate: vi.fn() });

    expect(screen.getByRole("heading", { name: "Graph Engineering" })).toBeInTheDocument();
    expect(rendered.container.querySelector("[data-engineering-header]")).toHaveTextContent(
      "Compose project-global LoopNodes and route policy."
    );
    expect(screen.getByRole("button", { name: "Graph Engineering" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText(/Graph Engineering canvas; one RunBook Orchestrator control, 2 Loops/)).toBeInTheDocument();
    expect(screen.queryByText("Execute the Job.")).not.toBeInTheDocument();
  });

  it("selects a Loop card and opens its protected Workflow view with Enter", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    renderView({ view: "graph", navigate });
    const node = screen.getByRole("button", { name: /Loop SOURCE-LOOP, ID source-loop/ });

    await user.click(node);
    expect(screen.getByRole("heading", { name: "source-loop" })).toBeInTheDocument();
    node.focus();
    await user.keyboard("{Enter}");
    expect(navigate).toHaveBeenCalledWith("/automation/loops?view=workflow&id=source-loop");
  });

  it("opens Workflow Engineering on Loop-card double click", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    renderView({ view: "graph", navigate });
    await user.dblClick(screen.getByRole("button", { name: /Loop SOURCE-LOOP, ID source-loop/ }));
    expect(navigate).toHaveBeenLastCalledWith("/automation/loops?view=workflow&id=source-loop");
  });

  it("shows one RunBook Orchestrator control and its graph inspector", async () => {
    const user = userEvent.setup();
    renderView({ view: "graph", navigate: vi.fn() });
    const controls = screen.getAllByRole("button", { name: /Loop Orchestrator for Test Graph/ });
    expect(controls).toHaveLength(1);
    await user.click(controls[0]!);

    expect(screen.getByRole("tab", { name: "Orchestrator" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "RunBook Orchestrator" })).toBeInTheDocument();
    expect(screen.getByLabelText("Graph name")).toHaveValue("Test Graph");
    expect(screen.getByLabelText("Maximum transitions")).toHaveValue(256);
  });

  it("exposes decision/outcome and repair semantics as focusable text and editable fields", async () => {
    const user = userEvent.setup();
    renderView({ view: "graph", navigate: vi.fn() });

    expect(screen.getAllByRole("button", {
      name: "PASS outcome success, source-loop to target-loop"
    }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", {
      name: "Repair capability test:loop.transfer, target-loop to source-loop"
    }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Loop SOURCE-LOOP, ID source-loop/ }));
    expect(screen.getByRole("heading", { name: "RunBook transitions" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("Named outcome").some((field) => (
      field as HTMLInputElement
    ).value === "success")).toBe(true);
    expect(screen.getByRole("button", { name: "Add transition" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add repair edge" })).toBeEnabled();
  });

  it("opens the Graph inspector as a Sheet in a narrow viewport without replacing the canvas", async () => {
    mockNarrowViewport();
    const user = userEvent.setup();
    renderView({ view: "graph", navigate: vi.fn() });

    await user.click(screen.getByRole("button", { name: /Loop SOURCE-LOOP, ID source-loop/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Graph Engineering inspector");
    expect(screen.getByLabelText(/Graph Engineering canvas/)).toBeInTheDocument();
  });

  it("keeps Workflow Engineering limited to the selected Loop", () => {
    const rendered = renderView({ view: "workflow", selectedId: "source-loop", navigate: vi.fn() });
    expect(rendered.container.querySelector("[data-engineering-header]")).toHaveTextContent("source-loop");
    expect(screen.getByLabelText("Workflow Engineering internal Edge canvas")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Edit Job Node job/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Edit Validation Node job-validation/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText("target-loop")).not.toBeInTheDocument();
  });

  it("offers an explicit first-Loop action for an empty authoring graph", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const data = loopEngineerData();
    data.automation = {
      ...data.automation,
      loops: [],
      graph: { ...data.automation.graph, startLoopId: "", transitions: [], repairEdges: [] }
    };
    renderViewData(data, "graph", navigate);

    await user.click(screen.getByRole("button", { name: "Add Loop" }));
    expect(navigate).toHaveBeenCalledWith("/automation/loops?view=workflow&new=1");
  });

  it("renders immutable repair evidence and the active target status", () => {
    const data = loopEngineerData();
    const source = workflowLoop("source-loop");
    const target = workflowLoop("target-loop");
    data.automation = workflowAutomation(source, target);
    data.automation.graph.repairEdges = [{
      id: "active-repair", source: source.id, target: target.id,
      capability: "test:loop.transfer", description: "Repair through the allowlist."
    }];
    const route = routeEvidence("active-repair", source.id, target.id);
    data.activeRootRuns = [rootEvidence(data.automation)];
    data.orchestratorRoutes = [route];
    data.loopRuns = [targetRunEvidence(target, route)];
    renderViewData(data, "graph", vi.fn());

    expect(screen.getByRole("button", { name: /Loop TARGET-LOOP, ID target-loop.*status running/ }))
      .toHaveAttribute("data-live-run-status", "running");
    expect(screen.getAllByRole("button", {
      name: "Repair capability test:loop.transfer, source-loop to target-loop"
    }).length).toBeGreaterThan(0);
  });
});

describe("Graph Engineering module and runtime integration", () => {
  it("refreshes authoritative workspace data before returning from module installation", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const refreshWorkspace = vi.fn(async () => undefined);
    const loopModules = loopModuleActions();
    render(<AutomationView
      data={loopEngineerData()} view="graph" saveAutomation={vi.fn(async (config) => config)}
      refreshWorkspace={refreshWorkspace} loopModules={loopModules} navigate={navigate}
      setNavigationBlocker={vi.fn()}
    />);

    await user.click(screen.getByRole("button", { name: "Add Loop", exact: true }));
    await user.click(await screen.findByRole("button", { name: "Add", exact: true }));
    await user.click(await screen.findByRole("button", { name: "Install module" }));

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith("/automation/loops?view=graph", { bypassBlocker: true }));
    expect(refreshWorkspace).toHaveBeenCalledOnce();
  });

  it("exports an installed V3 Loop from its Graph inspector", async () => {
    const user = userEvent.setup();
    const data = loopEngineerData();
    data.automation = workflowAutomation(workflowLoop(installedStatus.loopId));
    const loopModules = loopModuleActions();
    vi.mocked(loopModules.exportLoop).mockResolvedValue({ canonicalJson: "{}\n", filename: "installed-loop.ballet-loop.json" });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:loop-module");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<AutomationView
      data={data} view="graph" saveAutomation={vi.fn(async (config) => config)}
      loopModules={loopModules} navigate={vi.fn()} setNavigationBlocker={vi.fn()}
    />);

    await user.click(await screen.findByRole("button", { name: /Loop Installed Loop, ID installed-loop/ }));
    await user.click(await screen.findByRole("button", { name: `Export Loop ${installedStatus.loopId}` }));
    await vi.waitFor(() => expect(loopModules.exportLoop).toHaveBeenCalledWith({ loopId: installedStatus.loopId }));
  });

  it("locks Graph and Workflow mutations while their Loop has an active Run", async () => {
    const user = userEvent.setup();
    const data = loopEngineerData();
    const loop = data.automation.loops[0]!;
    data.loopRuns = [{
      loopRunId: "active-loop-run", loopId: loop.id, rootRunId: "active-root-run",
      source: "manual", status: "running", snapshot: structuredClone(loop),
      themeSnapshot: structuredClone(defaultLoopTheme), entryStateRevision: 0, nestingDepth: 0,
      createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T00:00:00.000Z",
      jobRuns: [], nodeRuns: []
    }];
    const graph = renderViewData(data, "graph", vi.fn());

    const locked = screen.getByRole("button", { name: /Loop SOURCE-LOOP, ID source-loop.*editing locked by active Run/ });
    await user.click(locked);
    expect(screen.getByRole("button", { name: "Add transition" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add repair edge" })).toBeDisabled();
    graph.unmount();

    renderViewData(data, "workflow", vi.fn(), loop.id);
    expect(screen.getByRole("button", { name: "Save Loop" })).toBeDisabled();
  });

  it("shows an explicit state for an unknown Workflow deep link", () => {
    renderView({ view: "workflow", selectedId: "missing-loop", navigate: vi.fn() });
    expect(screen.getByText("Loop not found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Graph Engineering" })).toBeInTheDocument();
  });
});

function renderView({ view, selectedId, navigate }: {
  view: "graph" | "workflow";
  selectedId?: string;
  navigate: ReturnType<typeof vi.fn>;
}) {
  const source = workflowLoop("source-loop");
  const target = workflowLoop("target-loop");
  const data = loopEngineerData();
  data.automation = workflowAutomation(source, target);
  data.automation.orchestrator = {
    ...data.automation.orchestrator,
    repairRouter: {
      executionProfileId: "codex-test", primaryInstructionId: "project:architect",
      skillIds: [], maxRepairDepth: 4, maxRepairAttempts: 3
    }
  };
  data.automation.graph.repairEdges = [{
    id: "target-source-repair", source: target.id, target: source.id,
    capability: "test:loop.transfer", description: "Escalate missing evidence."
  }];
  return renderViewData(data, view, navigate, selectedId);
}

function renderViewData(
  data: AppData,
  view: "graph" | "workflow",
  navigate: ReturnType<typeof vi.fn>,
  selectedId?: string
) {
  return render(<AutomationView
    data={data} view={view} selectedId={selectedId}
    saveAutomation={vi.fn(async (config) => config)} navigate={navigate}
    setNavigationBlocker={vi.fn()}
  />);
}

function mockNarrowViewport() {
  return vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: true, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(),
    removeListener: vi.fn(), dispatchEvent: vi.fn()
  } as MediaQueryList));
}

function loopEngineerData(): AppData {
  return {
    ...emptyData,
    project: { ...emptyData.project, id: "ballet", name: "Ballet", description: "Coordinate verified Loop work." },
    executionProfiles: [{
      id: "codex-test", name: "Codex test", provider: "codex", model: "gpt-test",
      reasoningEffort: "high", networkAccess: false
    }],
    instructions: [projectInstruction("project:architect"), projectInstruction("project:worker")],
    automation: workflowAutomation(workflowLoop("source-loop")),
    automationIssues: [], loopTheme: structuredClone(defaultLoopTheme), runtime: localRuntime()
  };
}
