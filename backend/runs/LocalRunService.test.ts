import { describe, expect, it, vi } from "vitest";
import type { AppData } from "../../shared/api/workspace-contracts.js";
import type { ExecutionRuntimeSnapshot } from "../../shared/domain/runtime.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { ProjectContext } from "../project/ProjectContext.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import { LoopRunStateError } from "../runtime/LoopRunErrors.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import { LocalRunService, type LocalRunServiceOptions } from "./LocalRunService.js";
import type { RootRunStore, StoredRootRun } from "./RootRunStore.js";

const runtime: ExecutionRuntimeSnapshot = {
  hostname: "localhost", provider: "codex", cliVersion: "1", model: "model", reasoning: "medium",
  policy: { network: false, readOnlyRoots: [] }, capabilityHash: "hash"
};

describe("LocalRunService failure boundaries", () => {
  it("rejects a loop whose reachable theme is invalid before creating a root", async () => {
    const roots = { create: vi.fn() } as unknown as RootRunStore;
    const service = createService({
      roots,
      readData: async () => ({
        automation: { version: 7, loops: [{
          id: "delivery", start: "gate",
          steps: [{
            id: "gate", type: "human", description: "Approve.", nodeStyle: "luna",
            on: { approved: { end: "completed" }, rejected: { end: "failed" } }
          }]
        }] },
        automationIssues: [],
        loopThemeIssues: [{ path: ".ballet/theme.json", message: "Invalid theme." }]
      } as unknown as AppData)
    });

    await expect(service.start({ kind: "loop", targetId: "delivery" })).rejects.toBeInstanceOf(LoopRunStateError);
    expect(roots.create).not.toHaveBeenCalled();
  });

  it("fails and finalizes an active root when reconciliation cannot read its loop state", async () => {
    const root: StoredRootRun = {
      rootRunId: "root", kind: "loop", targetId: "delivery", source: "manual", status: "running",
      worktreePath: "/tmp/worktrees/root", branch: "ballet/run/root", headSha: "a".repeat(40),
      configHash: "config", snapshotHash: "snapshot", runtimeSnapshot: runtime,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const setStatus = vi.fn();
    const roots = { list: vi.fn(() => [root]), setStatus } as unknown as RootRunStore;
    const database = ({
      listRootLoopRuns: vi.fn(() => { throw new Error("Broken persisted loop state."); })
    } as unknown) as RuntimeDatabase;
    const service = createService({ roots, database });
    const internals = service as unknown as {
      workspaces: { cleanupOrphans(ids: ReadonlySet<string>): Promise<void> };
      finalizer: { finalize(rootRunId: string, status: "failed"): Promise<void> };
    };
    vi.spyOn(internals.workspaces, "cleanupOrphans").mockResolvedValue();
    const finalize = vi.spyOn(internals.finalizer, "finalize").mockResolvedValue();

    await service.reconcile();

    expect(setStatus).toHaveBeenCalledWith("root", "failed", expect.objectContaining({
      errorCode: "orchestration_failed", errorMessage: "Broken persisted loop state."
    }));
    expect(finalize).toHaveBeenCalledWith("root", "failed");
  });
});

const createService = (overrides: Partial<LocalRunServiceOptions>): LocalRunService => new LocalRunService({
  context: { root: "/tmp", worktreesRoot: "/tmp/worktrees" } as ProjectContext,
  connection: () => { throw new Error("Unexpected database connection."); },
  database: {} as RuntimeDatabase,
  roots: {} as RootRunStore,
  executions: { listByRoot: vi.fn(() => []) } as unknown as ExecutionStore,
  runtime: {} as LocalRuntimeService,
  configurations: {} as RuntimeConfigurationService,
  queue: {} as LocalExecutionQueue,
  readData: async () => { throw new Error("Unexpected workspace read."); },
  ...overrides
});
