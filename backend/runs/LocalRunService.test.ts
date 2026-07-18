import { describe, expect, it, vi } from "vitest";
import type { AppData } from "../../shared/api/workspace-contracts.js";
import { defaultTerminalNodes } from "../../shared/domain/automation.js";
import type { ExecutionRuntimeSnapshot, ExecutionTask } from "../../shared/domain/runtime.js";
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
        automation: { version: 8, loops: [{
          id: "delivery", start: "gate",
          nodes: [{
            id: "gate", type: "human", description: "Approve.", nodeStyle: "luna", nodeSize: "tiny",
            on: { approved: "completed", rejected: "failed" }
          }, ...defaultTerminalNodes()]
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

  it("propagates the decisive Loop termination and exact agent outcome to root finalization", async () => {
    const termination = {
      status: "blocked" as const,
      code: "agent_blocked" as const,
      message: "A product decision is missing.",
      stepRunId: "step-run",
      stepId: "review",
      signal: { kind: "agent" as const, outcome: "blocked" as const }
    };
    const outcome = { outcome: "blocked" as const, summary: termination.message, checks: [] };
    const setStatus = vi.fn();
    const roots = { setStatus } as unknown as RootRunStore;
    const database = {
      listRootLoopRuns: vi.fn(() => [{
        runId: "loop-run", loopId: "delivery", rootRunId: "root", source: "manual", status: "blocked",
        snapshot: { id: "delivery", start: "review", nodes: [] }, themeSnapshot: {}, transitionCount: 1,
        termination, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:01:00.000Z",
        stepRuns: [{ stepRunId: "step-run", runId: "loop-run", loopId: "delivery", stepId: "review", type: "agent", status: "blocked", outcome, attempt: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:01:00.000Z" }]
      }])
    } as unknown as RuntimeDatabase;
    const service = createService({ roots, database });
    const internals = service as unknown as {
      syncLoopRoot(rootRunId: string): Promise<void>;
      finalizer: { finalize(rootRunId: string, status: "blocked"): Promise<void> };
    };
    const finalize = vi.spyOn(internals.finalizer, "finalize").mockResolvedValue();

    await internals.syncLoopRoot("root");

    expect(setStatus).toHaveBeenCalledWith("root", "blocked", { termination, outcome });
    expect(finalize).toHaveBeenCalledWith("root", "blocked");
  });

  it("routes an interrupted Loop task through the configured failed action", async () => {
    const root: StoredRootRun = {
      rootRunId: "root", kind: "loop", targetId: "delivery", source: "manual", status: "running",
      worktreePath: "/tmp/worktrees/root", branch: "ballet/run/root", headSha: "a".repeat(40),
      configHash: "config", snapshotHash: "snapshot", runtimeSnapshot: runtime,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const completeAgentStep = vi.fn();
    const roots = { require: vi.fn(() => root) } as unknown as RootRunStore;
    const service = createService({ roots, database: { completeAgentStep } as unknown as RuntimeDatabase });
    const internals = service as unknown as {
      runConfiguration(rootRun: StoredRootRun): Promise<{ automation: AppData["automation"]; loopTheme: AppData["loopTheme"] }>;
      enqueuePending(rootRunId: string): Promise<void>;
      syncLoopRoot(rootRunId: string): Promise<void>;
    };
    const automation: AppData["automation"] = { version: 8, loops: [] };
    const loopTheme = {} as AppData["loopTheme"];
    vi.spyOn(internals, "runConfiguration").mockResolvedValue({ automation, loopTheme });
    vi.spyOn(internals, "enqueuePending").mockResolvedValue();
    const sync = vi.spyOn(internals, "syncLoopRoot").mockResolvedValue();
    const task = {
      rootRunId: "root",
      kind: "loop_step",
      status: "failed",
      errorCode: "interrupted",
      errorMessage: "Runtime exited during execution.",
      spec: { stepRunId: "step", loopRunId: "loop", runtime }
    } as unknown as ExecutionTask;

    await service.handleTerminal(task);

    expect(completeAgentStep).toHaveBeenCalledWith(automation, loopTheme, {
      stepRunId: "step",
      outcome: undefined,
      error: "Runtime exited during execution."
    });
    expect(sync).toHaveBeenCalledWith("root");
  });
});

describe("LocalRunService change notifications", () => {
  it("publishes a post-transition invalidation after an agent Loop task completes", async () => {
    const root = {
      rootRunId: "root", kind: "loop", targetId: "delivery", source: "manual", status: "running",
      worktreePath: "/tmp/worktrees/root", branch: "ballet/run/root", headSha: "a".repeat(40),
      configHash: "config", snapshotHash: "snapshot", runtimeSnapshot: runtime,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    } satisfies StoredRootRun;
    const onChanged = vi.fn();
    const completeAgentStep = vi.fn();
    const service = createService({
      roots: { require: vi.fn(() => root) } as unknown as RootRunStore,
      database: { completeAgentStep } as unknown as RuntimeDatabase,
      onChanged
    });
    const internals = service as unknown as {
      runConfiguration(rootRun: StoredRootRun): Promise<{ automation: AppData["automation"]; loopTheme: AppData["loopTheme"] }>;
      enqueuePending(rootRunId: string): Promise<void>;
      syncLoopRoot(rootRunId: string): Promise<void>;
    };
    vi.spyOn(internals, "runConfiguration").mockResolvedValue({ automation: { version: 8, loops: [] }, loopTheme: {} as AppData["loopTheme"] });
    vi.spyOn(internals, "enqueuePending").mockResolvedValue();
    vi.spyOn(internals, "syncLoopRoot").mockResolvedValue();

    await service.handleTerminal({
      rootRunId: "root", kind: "loop_step", status: "succeeded",
      outcome: { outcome: "ready", summary: "Continue.", checks: [] },
      spec: { stepRunId: "step", runtime }
    } as unknown as ExecutionTask);

    expect(completeAgentStep).toHaveBeenCalledWith(
      { version: 8, loops: [] }, expect.anything(),
      { stepRunId: "step", outcome: { outcome: "ready", summary: "Continue.", checks: [] }, error: undefined }
    );
    expect(onChanged).toHaveBeenCalledWith("root");
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
