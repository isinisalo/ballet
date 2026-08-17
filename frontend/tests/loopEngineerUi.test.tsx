import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  type AppData,
  type InstalledLoopModuleStatus,
  type LoopModuleInstallPlan,
  type LoopModulePackageV1,
  type ProjectInstruction
} from "@shared/api/workspace-contracts";
import { AutomationView } from "../src/workspace/automation/AutomationView";
import type { LoopModuleActions } from "../src/workspace/automation/loops/LoopLibraryDialog";
import { emptyData } from "../src/workspace/types";
import { localRuntime } from "./runtimeFixtures";
import { v10Automation, v10Loop } from "./v10Fixtures";

describe("Loop Engineer workspace", () => {
  it("shows the active Context level in navigation and breadcrumb and opens Level 1", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const view = renderView({ level: "context", navigate });

    expect(screen.getByRole("heading", { name: "Loop Engineer" })).toBeInTheDocument();
    const header = view.container.querySelector("[data-loop-engineer-header]");
    expect(header).toBeInTheDocument();
    expect(header?.querySelectorAll("[data-loop-engineer-row]")).toHaveLength(2);
    expect(header).toHaveTextContent("Read-only project intent, Loop system summary, and declared outcomes.");
    expect(screen.getByLabelText("Loop Engineer actions")).toContainElement(screen.getByRole("button", { name: "Open Level 1" }));
    expect(screen.getByRole("button", { name: "Context" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation", { name: "Loop Engineer breadcrumb" })).toHaveTextContent("Context");
    expect(screen.getByLabelText("Context level read-only Loop system planet canvas")).toBeInTheDocument();
    expect(view.container.querySelectorAll("[data-context-planet]")).toHaveLength(3);
    expect(view.container.querySelector("[data-context-planet='Ballet Loop system'] [data-loop-node-artwork='terra']")).toBeInTheDocument();
    expect(screen.queryByText("Execute work.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Level 1" }));
    expect(navigate).toHaveBeenCalledWith("/automation/loops?level=1");
  });

  it("selects a Level 1 Loop with Space and opens Level 2 with Enter", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    renderView({ level: "composition", navigate });
    const node = screen.getByRole("button", { name: /Custom Loop source-loop/ });

    node.focus();
    await user.keyboard(" ");
    expect(navigate).toHaveBeenLastCalledWith("/automation/loops?level=1&id=source-loop", { bypassBlocker: true });
    navigate.mockClear();
    node.focus();
    await user.keyboard("{Enter}");
    expect(navigate).toHaveBeenCalledWith("/automation/loops?level=2&id=source-loop");
    expect(screen.getByLabelText(/Level 1 · Loops composition canvas/)).toHaveAccessibleName(/Loop Edges/);
    expect(screen.queryByText("Execute work.")).not.toBeInTheDocument();
  });

  it("keeps the Loop Orchestrator in the Level 1 inspector instead of below the canvas", async () => {
    const user = userEvent.setup();
    const view = renderView({ level: "composition", selectedId: "source-loop", navigate: vi.fn() });

    const rail = screen.getByLabelText("Level 1 Loop and Orchestrator inspector");
    const orchestratorTab = screen.getByRole("tab", { name: "Orchestrator" });
    expect(rail).toContainElement(orchestratorTab);
    await user.click(orchestratorTab);
    expect(orchestratorTab).toHaveAttribute("aria-selected", "true");
    expect(rail).toContainElement(screen.getByRole("heading", { name: "Loop Orchestrator" }));
    expect(screen.queryByText("Orchestrator settings")).not.toBeInTheDocument();
    expect(view.container.querySelector("[data-loop-canvas] + details")).not.toBeInTheDocument();
  });

  it("keeps Level 2 limited to the selected Loop and labels visible edges as internal", () => {
    const view = renderView({ level: "detail", selectedId: "source-loop", navigate: vi.fn() });
    expect(view.container.querySelector("[data-loop-engineer-header]")).toHaveTextContent("source-loop");
    expect(view.container.querySelector("[data-loop-engineer-header]")).toHaveTextContent("Design one selected Loop's Work Loop Nodes and internal Edges.");
    expect(screen.getByRole("button", { name: /Level 2 · Detail · source-loop/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Level 2 · Detail internal Edge canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Work Loop Node work" })).toBeInTheDocument();
    expect(screen.queryByText("target-loop")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Loop Edge" })).not.toBeInTheDocument();
  });

  it("offers an explicit first-Loop action when the project has no Loops", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const data = loopEngineerData();
    data.automation = { ...data.automation, loops: [], loopEdges: [] };
    render(<AutomationView data={data} level="context" saveAutomation={vi.fn(async (config) => config)} navigate={navigate} setNavigationBlocker={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add first Loop" }));
    expect(navigate).toHaveBeenCalledWith("/automation/loops?level=2&new=1");
  });

  it("offers Add first Work Loop Node for an empty selected Loop", () => {
    const emptyLoop = v10Loop("empty-loop");
    emptyLoop.nodes = [];
    emptyLoop.edges = [];
    emptyLoop.startNodeId = "";
    const data = loopEngineerData();
    data.automation = v10Automation(emptyLoop);

    render(<AutomationView data={data} level="detail" selectedId={emptyLoop.id} saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Add first Work Loop Node" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add node" })).toBeInTheDocument();
  });
});

describe("Loop Engineer module and runtime integration", () => {
  it("awaits authoritative workspace refresh before selecting an installed Loop on Level 1", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const refreshWorkspace = vi.fn(async () => undefined);
    const loopModules = loopModuleActions();
    render(<AutomationView
      data={loopEngineerData()}
      level="composition"
      saveAutomation={vi.fn(async (config) => config)}
      refreshWorkspace={refreshWorkspace}
      loopModules={loopModules}
      navigate={navigate}
      setNavigationBlocker={vi.fn()}
    />);

    await user.click(screen.getByRole("button", { name: "Add Loop", exact: true }));
    await user.click(await screen.findByRole("button", { name: "Add", exact: true }));
    await user.click(await screen.findByRole("button", { name: "Install module" }));

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith("/automation/loops?level=1&id=installed-loop", { bypassBlocker: true }));
    expect(refreshWorkspace).toHaveBeenCalledOnce();
    expect(vi.mocked(loopModules.statuses).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(refreshWorkspace.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder.at(-1)!);
  });

  it("exports an installed Loop from the Level 1 inspector", async () => {
    const user = userEvent.setup();
    const data = loopEngineerData();
    data.automation = v10Automation(v10Loop(installedStatus.loopId));
    const loopModules = loopModuleActions();
    vi.mocked(loopModules.exportLoop).mockResolvedValue({ canonicalJson: "{}\n", filename: "installed-loop.ballet-loop.json" });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:loop-module");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<AutomationView
      data={data}
      level="composition"
      selectedId={installedStatus.loopId}
      saveAutomation={vi.fn(async (config) => config)}
      loopModules={loopModules}
      navigate={vi.fn()}
      setNavigationBlocker={vi.fn()}
    />);

    await user.click(await screen.findByRole("button", { name: `Export Loop ${installedStatus.loopId}` }));
    await vi.waitFor(() => expect(loopModules.exportLoop).toHaveBeenCalledWith({ loopId: installedStatus.loopId }));
  });

  it("keeps relevant Level 1 and Level 2 mutations locked for an active Run", () => {
    const data = loopEngineerData();
    const loop = data.automation.loops[0]!;
    data.loopRuns = [{
      loopRunId: "active-loop-run", loopId: loop.id, rootRunId: "active-root-run", source: "manual", status: "running",
      snapshot: structuredClone(loop), themeSnapshot: structuredClone(defaultLoopTheme), entryStateRevision: 0, nestingDepth: 0,
      createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T00:00:00.000Z", workLoopNodeRuns: [], nodeRuns: []
    }];
    const composition = render(<AutomationView data={data} level="composition" selectedId={loop.id} saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Custom Loop source-loop.*editing locked by active Run/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Loop Edge" })).toBeDisabled();
    composition.unmount();
    render(<AutomationView data={data} level="detail" selectedId={loop.id} saveAutomation={vi.fn(async (config) => config)} navigate={vi.fn()} setNavigationBlocker={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Save Loop" })).toBeDisabled();
  });

  it("shows an explicit state for an unknown Level 2 deep link", () => {
    renderView({ level: "detail", selectedId: "missing-loop", navigate: vi.fn() });
    expect(screen.getByText("Loop not found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Level 1" })).toBeInTheDocument();
  });
});

function renderView({ level, selectedId, navigate }: {
  level: "context" | "composition" | "detail";
  selectedId?: string;
  navigate: ReturnType<typeof vi.fn>;
}) {
  const source = v10Loop("source-loop");
  const target = v10Loop("target-loop");
  target.nodes[0] = { ...target.nodes[0]!, id: "target-work" };
  target.startNodeId = "target-work";
  target.edges[0] = { ...target.edges[0]!, source: "target-work" };
  const data = loopEngineerData();
  data.automation = v10Automation(source, target);
  return render(<AutomationView data={data} level={level} selectedId={selectedId} saveAutomation={vi.fn(async (config) => config)} navigate={navigate} setNavigationBlocker={vi.fn()} />);
}

function loopEngineerData(): AppData {
  return {
    ...emptyData,
    project: { ...emptyData.project, id: "ballet", name: "Ballet", description: "Coordinate verified Loop work." },
    executionProfiles: [{ id: "codex-test", name: "Codex test", provider: "codex", model: "gpt-test", reasoningEffort: "high", networkAccess: false }],
    instructions: [instruction("project:architect"), instruction("project:worker")],
    automation: v10Automation(v10Loop("source-loop")),
    automationIssues: [],
    loopTheme: structuredClone(defaultLoopTheme),
    runtime: localRuntime()
  };
}

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

const modulePackage: LoopModulePackageV1 = {
  format: "ballet-loop-module",
  version: 1,
  manifest: { id: "installed-loop", title: "Installed Loop", description: "Installed module.", version: "1.0.0", tags: [] },
  permissions: { network: "forbidden", externalWrites: false },
  profileSlots: [],
  stateContract: { id: "installed-state", version: "1.0.0", description: "Installed state.", initial: {}, requiredKeys: [] },
  capabilities: { requires: [], provides: ["installed.complete"], recommendedConnections: [] },
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
