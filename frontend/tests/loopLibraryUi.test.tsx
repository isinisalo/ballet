import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  InstalledLoopModuleStatus,
  LoopModuleInstallPlan,
  LoopModuleLibraryEntry,
  LoopModulePackageV1
} from "@shared/api/workspace-contracts";
import { LoopLibraryDialog, type LoopModuleActions } from "../src/workspace/automation/loops/LoopLibraryDialog";

describe("Loop Library dialog", () => {
  it("keeps the module as one searchable box and shows trust facts before one install confirmation", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onInstalled = vi.fn();
    const actions = actionFixture(safePlan());
    render(<LoopLibraryDialog open actions={actions} onOpenChange={onOpenChange} onCreateBlank={vi.fn()} onInstalled={onInstalled} />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("w-[min(80rem,calc(100vw-1rem))]", "max-h-[min(52rem,calc(100dvh-1rem))]");
    expect(screen.getByRole("list", { name: "Available Loop modules" })).toHaveClass(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]",
      "gap-4"
    );
    expect(screen.getByLabelText("Search Loop Library")).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Sample module" })).toBeInTheDocument();
    expect(screen.queryByText("Internal Work Loop Node")).not.toBeInTheDocument();
    expect(screen.getAllByText("arc42")).toHaveLength(2);

    await user.type(screen.getByLabelText("Search Loop Library"), "missing");
    expect(screen.getByText("No matching Loop modules.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search Loop Library"));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("heading", { name: /Confirm install/ })).toBeInTheDocument();
    expect(screen.getByText(/source: \.ballet\/loop-library\/sample/)).toHaveTextContent("sha256:");
    expect(screen.getByText("external writes off")).toBeInTheDocument();
    expect(screen.getByText("Update .ballet/loop-modules/installed.json")).toBeInTheDocument();
    expect(actions.install).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Install module" }));
    await waitFor(() => expect(actions.install).toHaveBeenCalledTimes(1));
    expect(onInstalled).toHaveBeenCalledWith(expect.objectContaining({ loopId: "sample-loop", status: "exact" }));
    expect(onOpenChange.mock.calls.some(([value]) => value === false)).toBe(true);
  });

  it("progressively reveals profile mapping and advanced metadata, supports file import, and closes with Escape", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const initial = mappingPlan(false);
    const mapped = mappingPlan(true);
    const actions = actionFixture(initial);
    vi.mocked(actions.plan).mockImplementation(async (input) => input.profileMappings?.worker ? mapped : initial);
    render(<LoopLibraryDialog open actions={actions} onOpenChange={onOpenChange} onCreateBlank={vi.fn()} onInstalled={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Add" }));
    expect(await screen.findByRole("heading", { name: /Install preview/ })).toBeInTheDocument();
    expect(screen.getByText("Advanced metadata")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install module" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Worker" }));
    await user.click(await screen.findByRole("option", { name: /Codex off/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Install module" })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "Back" }));
    const file = new File([JSON.stringify(pkg)], "sample.ballet-loop.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Import Loop module file"), file);
    await waitFor(() => expect(actions.inspect).toHaveBeenCalledWith(expect.objectContaining({ source: "local-file:sample.ballet-loop.json" })));
    await user.keyboard("{Escape}");
    expect(onOpenChange.mock.calls.some(([value]) => value === false)).toBe(true);
  });
});

const pkg: LoopModulePackageV1 = {
  format: "ballet-loop-module", version: 1,
  manifest: { id: "sample-loop", title: "Sample module", description: "One portable sample Loop.", version: "1.0.0", category: "arc42", tags: ["sample"] },
  permissions: { network: "forbidden", externalWrites: false },
  profileSlots: [{ key: "worker", title: "Worker", description: "Worker profile.", providers: ["codex"], network: "forbidden" }],
  stateContract: { id: "sample-state", version: "1.0.0", description: "Sample state.", initial: {}, requiredKeys: [] },
  capabilities: { requires: [], provides: ["sample.complete"], recommendedConnections: [] },
  resources: [],
  loop: {
    key: "loop", description: "One portable sample Loop.", state: { description: "Sample state.", initial: {} }, startNode: "work",
    nodes: [{ key: "work", description: "Internal Work Loop Node", work: { type: "human", task: "Work.", nodeStyle: "terra", nodeSize: "medium" }, validation: { type: "human", task: "Validate.", nodeStyle: "luna", nodeSize: "small" }, maxLocalAttempts: 3 }],
    edges: [{ key: "done", source: "work", target: { terminal: "completed" } }]
  }
};

const entry: LoopModuleLibraryEntry = {
  source: ".ballet/loop-library/sample.ballet-loop.json", sha256: "b".repeat(64), sizeBytes: 100,
  valid: true, manifest: pkg.manifest, permissions: pkg.permissions, package: pkg, issues: []
};

const installed: InstalledLoopModuleStatus = {
  moduleId: "sample-loop", moduleVersion: "1.0.0", title: "Sample module", source: entry.source,
  packageSha256: "b".repeat(64), loopId: "sample-loop", installedAt: "2026-08-16T00:00:00.000Z",
  profileMappings: {}, idRemapping: { loop: { loop: "sample-loop" }, nodes: {}, edges: {}, instructions: {}, skills: {} },
  stateContract: pkg.stateContract, capabilities: pkg.capabilities, ownedResources: [], installedContentSha256: "c".repeat(64),
  status: "exact", currentContentSha256: "c".repeat(64), missingResources: []
};

const safePlan = (): LoopModuleInstallPlan => planBase({ canInstall: true, requiresPreview: false, profileMappings: [] });
const mappingPlan = (selected: boolean): LoopModuleInstallPlan => planBase({
  canInstall: selected, requiresPreview: true,
  profileMappings: [{
    slot: pkg.profileSlots[0]!, selectedProfileId: selected ? "codex-off" : undefined,
    candidates: [{ id: "codex-off", name: "Codex off", provider: "codex", networkAccess: false }],
    compatible: selected,
    ...(selected ? {} : { issue: { code: "PROFILE_MAPPING_REQUIRED", path: "profileMappings.worker", message: "Select a compatible profile." } })
  }],
  issues: selected ? [] : [{ code: "PROFILE_MAPPING_REQUIRED", path: "profileMappings.worker", message: "Select a compatible profile." }]
});

const planBase = (overrides: Partial<LoopModuleInstallPlan>): LoopModuleInstallPlan => ({
  planHash: "a".repeat(64), packageSha256: "b".repeat(64), source: entry.source, module: pkg.manifest,
  loop: { id: "sample-loop", description: pkg.loop.description, state: pkg.loop.state, startNodeId: "sample-loop-work", nodes: [], edges: [] },
  idRemapping: { loop: { loop: "sample-loop" }, nodes: {}, edges: {}, instructions: {}, skills: {} },
  resources: [], profileMappings: [], permissions: { externalWrites: false, network: "forbidden", compatible: true },
  stateContract: { contract: pkg.stateContract, compatibility: "compatible", comparedWith: [] },
  capabilities: { ...pkg.capabilities, available: [], missingRequires: [] },
  conflicts: [], issues: [], diff: { loopsAdded: ["sample-loop"], projectFilesCreated: [], provenanceFilesChanged: [".ballet/loop-modules/installed.json"], projectConfigChanged: true },
  requiresPreview: false, canInstall: true, ...overrides
});

const actionFixture = (plan: LoopModuleInstallPlan): LoopModuleActions => ({
  listLibrary: vi.fn(async () => [entry]),
  inspect: vi.fn(async () => ({ valid: true, package: pkg, sha256: "b".repeat(64), canonicalJson: JSON.stringify(pkg), source: "local-import", sizeBytes: 100, issues: [] })),
  plan: vi.fn(async () => plan),
  install: vi.fn(async () => installed),
  statuses: vi.fn(async () => []),
  exportLoop: vi.fn(async () => ({ canonicalJson: JSON.stringify(pkg), filename: "sample.ballet-loop.json" })),
  remove: vi.fn(async () => undefined)
});
