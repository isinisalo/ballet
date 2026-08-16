import { describe, expect, it, vi } from "vitest";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import { createRuntimeStoreFixture } from "../runtime/RuntimeStore.test-fixture.js";
import { RootFinalizationCoordinator } from "./RootFinalizationCoordinator.js";

describe("RootFinalizationCoordinator terminal integration", () => {
  it.each([
    { terminal: "completed" as const, success: true, retained: false },
    { terminal: "blocked" as const, success: false, retained: true },
    { terminal: "failed" as const, success: false, retained: true }
  ])("persists $terminal finalization and cleanup policy", async ({ terminal, success, retained }) => {
    const fixture = await createRuntimeStoreFixture({ stable: true });
    const cleanupSuccessful = vi.fn(async () => undefined);
    const workspaces = {
      finalize: vi.fn(async () => ({
        success, retained, branch: "ballet/run/root-run", worktreePath: "/workspace/run",
        changedFiles: [], snapshotHash: "c".repeat(64)
      })),
      cleanupSuccessful
    } as unknown as LocalWorkspaceManager;
    const executions = { listByRoot: vi.fn(() => []) } as unknown as ExecutionStore;
    const changed = vi.fn();
    const finalizer = new RootFinalizationCoordinator(fixture.roots, executions, workspaces, changed);

    await finalizer.finalize("root-run", terminal);

    expect(fixture.roots.require("root-run")).toMatchObject({
      status: terminal,
      finalization: { status: "completed", success, report: { success, retained } }
    });
    expect(cleanupSuccessful).toHaveBeenCalledTimes(success ? 1 : 0);
    expect(changed).toHaveBeenCalledWith("root-run");
    await fixture.close();
  });

  it("fails closed and retains evidence when workspace finalization fails", async () => {
    const fixture = await createRuntimeStoreFixture({ stable: true });
    const workspaces = {
      finalize: vi.fn(async () => { throw new Error("Git finalization failed."); }),
      cleanupSuccessful: vi.fn()
    } as unknown as LocalWorkspaceManager;
    const executions = { listByRoot: vi.fn(() => []) } as unknown as ExecutionStore;
    const finalizer = new RootFinalizationCoordinator(fixture.roots, executions, workspaces, vi.fn());

    await finalizer.finalize("root-run", "completed");

    expect(fixture.roots.require("root-run")).toMatchObject({
      status: "failed", errorCode: "finalization_failed", errorMessage: "Git finalization failed.",
      finalization: { status: "failed" }
    });
    await fixture.close();
  });
});
