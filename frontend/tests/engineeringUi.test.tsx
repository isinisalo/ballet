import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultLoopTheme, type AppData, type InstalledLoopModuleStatus, type LoopModuleInstallPlan, type LoopModulePackageV1 } from "@shared/api/workspace-contracts";
import { AutomationView } from "../src/workspace/automation/AutomationView";
import type { LoopModuleActions } from "../src/workspace/automation/loops/LoopLibraryDialog";
import { emptyData } from "../src/workspace/types";
import { rootEvidence, routeEvidence, targetRunEvidence } from "./graphEngineeringRuntimeFixtures";
import { localRuntime } from "./runtimeFixtures";
import { projectInstruction } from "./projectInstructionFixture";
import { v11Automation, v11Loop } from "./v11Fixtures";

describe("Graph and Loop Engineering workspace", () => {
  it("shows Graph Engineering as the active default authoring view", () => {
    const navigate = vi.fn();
    const rendered = renderView({ view: "graph", navigate });

    expect(screen.getByRole("heading", { name: "Graph Engineering" })).toBeInTheDocument();
    const header = rendered.container.querySelector("[data-engineering-header]");
    expect(header).toBeInTheDocument();
    expect(header?.querySelectorAll("[data-engineering-row]")).toHaveLength(2);
    expect(header).toHaveTextContent("Compose project-global LoopNodes and route policy.");
    expect(screen.getByLabelText("Graph Engineering actions")).toContainElement(screen.getByRole("button", { name: "Add Loop" }));
    expect(screen.getByRole("button", { name: "Graph Engineering" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation", { name: "Engineering breadcrumb" })).toHaveTextContent("Graph Engineering");
    expect(screen.getByLabelText(/Graph Engineering canvas/)).toBeInTheDocument();
    expect(screen.queryByText("Execute work.")).not.toBeInTheDocument();
  });

  it("selects a Graph Engineering LoopNode with Space and opens Loop Engineering with Enter", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    renderView({ view: "graph", navigate });
    const node = screen.getByRole("button", { name: /Custom Loop source-loop/ });

    node.focus();
    await user.keyboard(" ");
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "source-loop" })).toBeInTheDocument();
    node.focus();
    await user.keyboard("{Enter}");
    expect(navigate).toHaveBeenCalledWith("/automation/loops?view=loop&id=source-loop");
    expect(screen.getByLabelText(/Graph Engineering canvas/)).toHaveAccessibleName(/route policies/);
    expect(screen.queryByText("Execute work.")).not.toBeInTheDocument();
  });

  it("opens Loop Engineering from a Graph LoopNode double-click", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    renderView({ view: "graph", navigate });

    await user.dblClick(screen.getByRole("button", { name: /Custom Loop source-loop/ }));
    expect(navigate).toHaveBeenLastCalledWith("/automation/loops?view=loop&id=source-loop");
  });

  it("shows exactly one selectable Loop Orchestrator control node and opens its canonical inspector", async () => {
    const user = userEvent.setup();
    const rendered = renderView({ view: "graph", navigate: vi.fn() });
    const controlNodes = screen.getAllByRole("button", { name: /Loop Orchestrator control node/ });
    expect(controlNodes).toHaveLength(1);
    await user.click(controlNodes[0]!);

    const rail = screen.getByLabelText("Graph Engineering Loop and Orchestrator inspector");
    const orchestratorTab = screen.getByRole("tab", { name: "Orchestrator" });
    expect(rail).toContainElement(orchestratorTab);
    expect(orchestratorTab).toHaveAttribute("aria-selected", "true");
    expect(rail).toContainElement(screen.getByRole("heading", { name: "Loop Orchestrator" }));
    expect(screen.queryByText("Orchestrator settings")).not.toBeInTheDocument();
    expect(rendered.container.querySelector("[data-loop-canvas] + details")).not.toBeInTheDocument();
  });

  it("keeps persisted route labels keyboard-focusable with exact source, target, kind, and capability semantics", async () => {
    const user = userEvent.setup();
    renderView({ view: "graph", navigate: vi.fn() });
    await user.click(screen.getByRole("button", { name: /Custom Loop source-loop/ }));
    const labels = screen.getAllByRole("button", { name: /flow route source-loop to target-loop via Loop Orchestrator, capability test:loop.transfer, persisted policy source-target-flow/ });
    expect(labels.length).toBeGreaterThanOrEqual(1);
    labels[0]!.focus();
    await user.keyboard(" ");
    expect(screen.getByRole("heading", { name: "source-loop" })).toBeInTheDocument();
    expect(screen.getByLabelText(/flow allowlist candidate source-loop to target-loop, capability test:loop.transfer/)).toBeInTheDocument();
  });

  it("opens the Graph Engineering inspector in a narrow viewport without replacing the canvas", async () => {
    const media = mockNarrowViewport();
    const user = userEvent.setup();
    renderView({ view: "graph", navigate: vi.fn() });

    await user.click(screen.getByRole("button", { name: /Custom Loop source-loop/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Graph Engineering inspector");
    expect(screen.getByRole("dialog")).toHaveClass("overflow-x-hidden");
    expect(screen.getByLabelText(/Graph Engineering canvas/)).toBeInTheDocument();
    media.mockImplementation(matchMedia(false));
  });

  it("opens the Orchestrator inspector Sheet from the narrow control node", async () => {
    const media = mockNarrowViewport();
    const user = userEvent.setup();
    renderView({ view: "graph", navigate: vi.fn() });

    await user.click(screen.getByRole("button", { name: /Loop Orchestrator control node/ }));
    const sheet = screen.getByRole("dialog");
    expect(sheet).toHaveTextContent("Loop Orchestrator");
    expect(screen.getByLabelText(/Graph Engineering canvas/)).toBeInTheDocument();
    expect(screen.getAllByRole("tab").concat(screen.getAllByRole("combobox"), [screen.getByRole("button", { name: "Close" })]).every((control) => /max-sm:(?:h-10|size-10)|data-\[size=sm\]:h-10/.test(control.className))).toBe(true);
    media.mockImplementation(matchMedia(false));
  });

  it("keeps Loop Engineering limited to the selected Loop and labels visible edges as internal", () => {
    const rendered = renderView({ view: "loop", selectedId: "source-loop", navigate: vi.fn() });
    expect(rendered.container.querySelector("[data-engineering-header]")).toHaveTextContent("source-loop");
    expect(rendered.container.querySelector("[data-engineering-header]")).toHaveTextContent("Design one selected Loop's Work Loop Nodes and internal Edges.");
    expect(screen.getByRole("button", { name: /Loop Engineering · source-loop/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Loop Engineering internal Edge canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Work Loop Node work" })).toBeInTheDocument();
    expect(screen.queryByText("target-loop")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Loop Edge" })).not.toBeInTheDocument();
  });

  it("offers an explicit first-Loop action when the project has no Loops", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const data = loopEngineerData();
    data.automation = { ...data.automation, loops: [], graph: { loopEdges: [] } };
    render(<AutomationView data={data} view="graph" saveAutomation={vi.fn(async (config) => config)} navigate={navigate} setNavigationBlocker={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add Loop" }));
    expect(navigate).toHaveBeenCalledWith("/automation/loops?view=loop&new=1");
  });

  it("offers Add first Work Loop Node for an empty selected Loop", () => {
    const emptyLoop = v11Loop("empty-loop");
    emptyLoop.nodes = [];
    emptyLoop.edges = [];
    emptyLoop.startNodeId = "";
    const data = loopEngineerData();
    data.automation = v11Automation(emptyLoop);

    render(<AutomationView data={data} view="loop" selectedId={emptyLoop.id} saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Add first Work Loop Node" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add node" })).toBeInTheDocument();
  });
});

describe("Graph Engineering canonical Run evidence", () => {
  it("marks only the immutable-snapshot-authorized active canonical Run route", () => {
    const data = loopEngineerData();
    const source = v11Loop("source-loop");
    const target = v11Loop("target-loop");
    data.automation = v11Automation(source, target);
    const edge = { id: "active-flow", source: source.id, target: target.id, kind: "flow" as const, capability: "test:loop.transfer", description: "Dispatch completed work." };
    data.automation.graph.loopEdges = [edge];
    const route = routeEvidence(edge.id, source.id, target.id);
    data.activeRootRuns = [rootEvidence(data.automation)];
    data.orchestratorRoutes = [route];
    data.loopRuns = [targetRunEvidence(target, route)];
    render(<AutomationView data={data} view="graph" saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Custom Loop target-loop.*live Run status running/ })).toHaveAttribute("data-live-run-status", "running");
    expect(screen.getByRole("button", { name: /active canonical Run route/ })).toHaveAttribute("data-graph-edge-keyboard", edge.id);
    expect(screen.getByLabelText(/Graph Engineering canvas/)).toHaveAccessibleName(/1 canonical Run routes active/);
  });

  it("shows forged out-of-allowlist route evidence as blocked in the Orchestrator inspector", async () => {
    const user = userEvent.setup();
    const data = loopEngineerData();
    const target = v11Loop("target-loop");
    data.automation = v11Automation(data.automation.loops[0]!, target);
    data.activeRootRuns = [rootEvidence(data.automation)];
    data.orchestratorRoutes = [routeEvidence("outside-route", "source-loop", target.id)];
    render(<AutomationView data={data} view="graph" saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Loop Orchestrator control node/ }));

    expect(screen.getByText(/blocked route evidence · outside-route/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /active canonical Run route/ })).not.toBeInTheDocument();
  });
});

describe("Graph and Loop Engineering module and runtime integration", () => {
  it("awaits authoritative workspace refresh before selecting an installed Loop in Graph Engineering", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const refreshWorkspace = vi.fn(async () => undefined);
    const loopModules = loopModuleActions();
    render(<AutomationView
      data={loopEngineerData()}
      view="graph"
      saveAutomation={vi.fn(async (config) => config)}
      refreshWorkspace={refreshWorkspace}
      loopModules={loopModules}
      navigate={navigate}
      setNavigationBlocker={vi.fn()}
    />);

    await user.click(screen.getByRole("button", { name: "Add Loop", exact: true }));
    await user.click(await screen.findByRole("button", { name: "Add", exact: true }));
    await user.click(await screen.findByRole("button", { name: "Install module" }));

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith("/automation/loops?view=graph", { bypassBlocker: true }));
    expect(refreshWorkspace).toHaveBeenCalledOnce();
    expect(vi.mocked(loopModules.statuses).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(refreshWorkspace.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder.at(-1)!);
  });

  it("exports an installed Loop from the Graph Engineering inspector", async () => {
    const user = userEvent.setup();
    const data = loopEngineerData();
    data.automation = v11Automation(v11Loop(installedStatus.loopId));
    const loopModules = loopModuleActions();
    vi.mocked(loopModules.exportLoop).mockResolvedValue({ canonicalJson: "{}\n", filename: "installed-loop.ballet-loop.json" });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:loop-module");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<AutomationView
      data={data}
      view="graph"
      saveAutomation={vi.fn(async (config) => config)}
      loopModules={loopModules}
      navigate={vi.fn()}
      setNavigationBlocker={vi.fn()}
    />);

    await user.click(await screen.findByRole("button", { name: /Installed module Installed Loop/ }));
    await user.click(await screen.findByRole("button", { name: `Export Loop ${installedStatus.loopId}` }));
    await vi.waitFor(() => expect(loopModules.exportLoop).toHaveBeenCalledWith({ loopId: installedStatus.loopId }));
  });

  it("keeps relevant Graph and Loop Engineering mutations locked for an active Run", async () => {
    const user = userEvent.setup();
    const data = loopEngineerData();
    const loop = data.automation.loops[0]!;
    data.loopRuns = [{
      loopRunId: "active-loop-run", loopId: loop.id, rootRunId: "active-root-run", source: "manual", status: "running",
      snapshot: structuredClone(loop), themeSnapshot: structuredClone(defaultLoopTheme), entryStateRevision: 0, nestingDepth: 0,
      createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T00:00:00.000Z", workLoopNodeRuns: [], nodeRuns: []
    }];
    const graph = render(<AutomationView data={data} view="graph" saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    const lockedNode = screen.getByRole("button", { name: /Custom Loop source-loop.*editing locked by active Run/ });
    expect(lockedNode).toBeInTheDocument();
    await user.click(lockedNode);
    expect(screen.getByRole("button", { name: "Add Loop Edge" })).toBeDisabled();
    graph.unmount();
    render(<AutomationView data={data} view="loop" selectedId={loop.id} saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Save Loop" })).toBeDisabled();
  });

  it("shows an explicit state for an unknown Loop Engineering deep link", () => {
    renderView({ view: "loop", selectedId: "missing-loop", navigate: vi.fn() });
    expect(screen.getByText("Loop not found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Graph Engineering" })).toBeInTheDocument();
  });
});

function renderView({ view, selectedId, navigate }: {
  view: "graph" | "loop";
  selectedId?: string;
  navigate: ReturnType<typeof vi.fn>;
}) {
  const source = v11Loop("source-loop");
  const target = v11Loop("target-loop");
  target.nodes[0] = { ...target.nodes[0]!, id: "target-work" };
  target.startNodeId = "target-work";
  target.edges[0] = { ...target.edges[0]!, source: "target-work" };
  const data = loopEngineerData();
  data.automation = v11Automation(source, target);
  data.automation.graph.loopEdges = [
    { id: "source-target-flow", source: source.id, target: target.id, kind: "flow", capability: "test:loop.transfer", description: "Dispatch completed work." },
    { id: "target-source-repair", source: target.id, target: source.id, kind: "repair", capability: "test:loop.transfer", description: "Escalate missing evidence." }
  ];
  return render(<AutomationView data={data} view={view} selectedId={selectedId} saveAutomation={vi.fn(async (config) => config)} navigate={navigate} setNavigationBlocker={vi.fn()} />);
}

function mockNarrowViewport() {
  return vi.spyOn(window, "matchMedia").mockImplementation(matchMedia(true));
}

const matchMedia = (matches: boolean) => (query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn()
  } as MediaQueryList);

function loopEngineerData(): AppData {
  return {
    ...emptyData,
    project: { ...emptyData.project, id: "ballet", name: "Ballet", description: "Coordinate verified Loop work." },
    executionProfiles: [{ id: "codex-test", name: "Codex test", provider: "codex", model: "gpt-test", reasoningEffort: "high", networkAccess: false }],
    instructions: [projectInstruction("project:architect"), projectInstruction("project:worker")],
    automation: v11Automation(v11Loop("source-loop")),
    automationIssues: [],
    loopTheme: structuredClone(defaultLoopTheme),
    runtime: localRuntime()
  };
}

const modulePackage: LoopModulePackageV1 = {
  format: "ballet-loop-module",
  version: 1,
  manifest: { id: "installed-loop", title: "Installed Loop", description: "Installed module.", version: "1.0.0", tags: [] },
  permissions: { network: "forbidden", externalWrites: false },
  profileSlots: [],
  stateContract: { id: "installed-state", version: "1.0.0", description: "Installed state.", initial: {}, requiredKeys: [] },
  capabilities: {
    requires: [], accepts: ["installed:task.requested"],
    provides: ["installed:task.completed"], recommendedConnections: []
  },
  resources: [],
  loop: {
    key: "loop", description: "Installed module.", state: { description: "Installed state.", initial: {} }, startNode: "work",
    nodes: [{ key: "work", description: "Work.", work: { type: "human", task: "Work.", nodeStyle: "terra", nodeSize: "medium" }, validation: { type: "human", task: "Validate.", nodeStyle: "luna", nodeSize: "small" }, maxLocalAttempts: 3 }],
    edges: [{ key: "done", source: "work", target: { terminal: "completed" } }]
  }
};

const installedStatus: InstalledLoopModuleStatus = {
  moduleId: "installed-loop", moduleVersion: "1.0.0", title: "Installed Loop", source: ".ballet/loop-library/installed.ballet-loop.json",
  packageSha256: "a".repeat(64), loopId: "installed-loop", installedAt: "2026-08-16T00:00:00.000Z", profileMappings: {},
  idRemapping: { loop: { loop: "installed-loop" }, nodes: {}, edges: {}, instructions: {}, skills: {} }, stateContract: modulePackage.stateContract,
  capabilities: modulePackage.capabilities, ownedResources: [], installedContentSha256: "b".repeat(64), status: "exact", currentContentSha256: "b".repeat(64), missingResources: []
};

function loopModuleActions(): LoopModuleActions {
  const plan: LoopModuleInstallPlan = {
    planHash: "c".repeat(64), packageSha256: installedStatus.packageSha256, source: installedStatus.source, module: modulePackage.manifest,
    loop: { id: installedStatus.loopId, description: modulePackage.loop.description, state: modulePackage.loop.state, startNodeId: "installed-loop-work", nodes: [], edges: [] },
    idRemapping: installedStatus.idRemapping, resources: [], profileMappings: [], permissions: { externalWrites: false, network: "forbidden", compatible: true },
    stateContract: { contract: modulePackage.stateContract, compatibility: "compatible", comparedWith: [] },
    capabilities: { ...modulePackage.capabilities, available: [], missingRequires: [] }, conflicts: [], issues: [],
    diff: { loopsAdded: [installedStatus.loopId], projectFilesCreated: [], provenanceFilesChanged: [".ballet/loop-modules/installed.json"], projectConfigChanged: true },
    requiresPreview: false, canInstall: true
  };
  return {
    listLibrary: vi.fn(async () => [{ source: installedStatus.source, sha256: installedStatus.packageSha256, sizeBytes: 100, valid: true, manifest: modulePackage.manifest, permissions: modulePackage.permissions, package: modulePackage, issues: [] }]),
    inspect: vi.fn(), plan: vi.fn(async () => plan), install: vi.fn(async () => installedStatus), statuses: vi.fn(async () => [installedStatus]),
    exportLoop: vi.fn(), remove: vi.fn()
  };
}
