import type Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import { defaultTerminalNodes } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { ExecutionTask, RootExecutionSnapshot, StepRun } from "../../shared/domain/runtime.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import type { PreparedRootWorkspace } from "../execution/git/LocalWorkspaceManager.js";
import type { ProjectContext } from "../project/ProjectContext.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import { LoopRunStateError } from "../runtime/LoopRunErrors.js";
import type { ExecutionStore } from "../execution/ExecutionStore.js";
import { LocalRunService, type LocalRunServiceOptions } from "./LocalRunService.js";
import type { RootRunStore, StoredRootRun } from "./RootRunStore.js";

const executionSnapshot: RootExecutionSnapshot = {
  version: 1,
  rootLoopId: "delivery",
  project: {
    checkoutRoot: "/tmp/worktrees/root",
    headSha: "a".repeat(40),
    configHash: "config",
    snapshotHash: "snapshot"
  },
  loops: [{
    id: "delivery",
    start: "gate",
    nodes: [{
      id: "gate",
      type: "human",
      description: "Approve.",
      nodeStyle: "luna",
      nodeSize: "tiny",
      on: { approved: "completed", rejected: "failed" }
    }, ...defaultTerminalNodes()]
  }],
  theme: defaultLoopTheme,
  executionProfiles: [],
  runtimes: [],
  resources: [],
  createdAt: "2026-01-01T00:00:00.000Z"
};

const workspace: PreparedRootWorkspace = {
  path: executionSnapshot.project.checkoutRoot,
  branch: "ballet/run/root",
  headSha: executionSnapshot.project.headSha,
  configHash: executionSnapshot.project.configHash,
  snapshotHash: executionSnapshot.project.snapshotHash
};

describe("LocalRunService failure boundaries", () => {
  it("rejects a stale started callback without reviving a terminal Root", () => {
    const setStatus = vi.fn();
    const requestCancel = vi.fn();
    const transaction = vi.fn((operation: () => unknown) => operation);
    const service = createService({
      connection: () => ({ transaction } as unknown as Database.Database),
      roots: { setStatus } as unknown as RootRunStore,
      database: { isExecutionStepRunnable: vi.fn(() => false) } as unknown as RuntimeDatabase,
      executions: {
        get: vi.fn(() => ({ status: "running" })),
        requestCancel
      } as unknown as ExecutionStore
    });
    const task = {
      id: "task",
      rootRunId: "root",
      spec: { stepRunId: "step" }
    } as unknown as ExecutionTask;

    expect(service.handleStarted(task)).toBe(false);
    expect(requestCancel).toHaveBeenCalledWith("task");
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("rejects a loop whose reachable theme is invalid before creating a root", async () => {
    const roots = { create: vi.fn() } as unknown as RootRunStore;
    const service = createService({ roots });
    const internals = service as unknown as {
      workspaces: {
        prepare(rootRunId: string): Promise<PreparedRootWorkspace>;
        discard(prepared: PreparedRootWorkspace): Promise<void>;
      };
      planner: { create(prepared: PreparedRootWorkspace, loopId: string): Promise<RootExecutionSnapshot> };
    };
    vi.spyOn(internals.workspaces, "prepare").mockResolvedValue(workspace);
    const discard = vi.spyOn(internals.workspaces, "discard").mockResolvedValue();
    vi.spyOn(internals.planner, "create").mockRejectedValue(
      new LoopRunStateError("Loop theme is invalid at .ballet/theme.json: Invalid theme.")
    );

    await expect(service.start({ kind: "loop", targetId: "delivery" })).rejects.toBeInstanceOf(LoopRunStateError);
    expect(roots.create).not.toHaveBeenCalled();
    expect(discard).toHaveBeenCalledWith(workspace);
  });

  it("fails and finalizes an active root when reconciliation cannot read its loop state", async () => {
    const root: StoredRootRun = {
      rootRunId: "root", kind: "loop", targetId: "delivery", source: "manual", status: "running",
      worktreePath: "/tmp/worktrees/root", branch: "ballet/run/root", headSha: "a".repeat(40),
      configHash: "config", snapshotHash: "snapshot", executionSnapshot,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const setStatus = vi.fn(() => ({
      ...root,
      status: "failed" as const,
      outcome: { state: "failed" as const, summary: "Broken persisted loop state.", checks: [] }
    }));
    const roots = {
      list: vi.fn(() => [root]),
      require: vi.fn(() => root),
      setStatus
    } as unknown as RootRunStore;
    const database = ({
      listRootLoopRuns: vi.fn(() => { throw new Error("Broken persisted loop state."); }),
      terminalizeActiveRootRuns: vi.fn()
    } as unknown) as RuntimeDatabase;
    const transaction = vi.fn((operation: () => unknown) => operation);
    const service = createService({
      roots,
      database,
      connection: () => ({ transaction } as unknown as Database.Database)
    });
    const internals = service as unknown as {
      workspaces: { cleanupOrphans(ids: ReadonlySet<string>): Promise<void> };
      finalizer: { finalize(rootRunId: string, status: "failed"): Promise<void> };
    };
    vi.spyOn(internals.workspaces, "cleanupOrphans").mockResolvedValue();
    const finalize = vi.spyOn(internals.finalizer, "finalize").mockResolvedValue();

    await service.reconcile();

    expect(setStatus).toHaveBeenCalledWith("root", "failed", expect.objectContaining({
      outcome: {
        state: "failed", summary: "Broken persisted loop state.", checks: []
      },
      errorCode: "orchestration_failed", errorMessage: "Broken persisted loop state."
    }));
    expect(database.terminalizeActiveRootRuns).toHaveBeenCalledWith(
      "root",
      {
        status: "failed",
        outcome: { state: "failed", summary: "Broken persisted loop state.", checks: [] },
        error: "Broken persisted loop state."
      },
      expect.any(String)
    );
    expect(transaction).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledWith("root", "failed");
  });
});

describe("LocalRunService cancellation boundary", () => {
  it("delegates active Root cancellation to the atomic coordinator path", async () => {
    const root: StoredRootRun = {
      rootRunId: "root", kind: "loop", targetId: "delivery", source: "manual", status: "running",
      worktreePath: "/tmp/worktrees/root", branch: "ballet/run/root", headSha: "a".repeat(40),
      configHash: "config", snapshotHash: "snapshot", executionSnapshot,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const service = createService({
      roots: { get: vi.fn(() => root), require: vi.fn(() => root) } as unknown as RootRunStore,
      database: { listRootLoopRuns: vi.fn(() => []) } as unknown as RuntimeDatabase
    });
    const internals = service as unknown as {
      coordinator: { cancelRoot(candidate: StoredRootRun): Promise<void> };
    };
    const cancelRoot = vi.spyOn(internals.coordinator, "cancelRoot").mockResolvedValue();

    await service.cancel(root.rootRunId);

    expect(cancelRoot).toHaveBeenCalledWith(root);
  });
});

describe("LocalRunService response failure boundary", () => {
  it.each([
    {
      label: "a needs_input resume",
      request: { kind: "resume", input: "Use SQLite." } as const,
      stepType: "agent" as const,
      stepStatus: "needs_input" as const,
      mutation: "resumeStepRun" as const
    },
    {
      label: "a Human response",
      request: { kind: "human", result: "approved", input: "Approved." } as const,
      stepType: "human" as const,
      stepStatus: "waiting_for_human" as const,
      mutation: "respondToStepRun" as const
    }
  ])("fails the Root when prompt composition after $label fails", async ({ request, stepType, stepStatus, mutation }) => {
    const root = storedRoot("waiting_for_human");
    const step: StepRun = {
      stepRunId: "step",
      runId: "loop-run",
      loopId: "delivery",
      stepId: "gate",
      type: stepType,
      status: stepStatus,
      attempt: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const resumeStepRun = vi.fn();
    const respondToStepRun = vi.fn();
    const database = {
      getStepRun: vi.fn(() => step),
      listRootLoopRuns: vi.fn(() => [{ runId: step.runId }]),
      resumeStepRun,
      respondToStepRun
    } as unknown as RuntimeDatabase;
    const roots = { require: vi.fn(() => root) } as unknown as RootRunStore;
    const transaction = vi.fn((operation: () => unknown) => operation);
    const service = createService({
      roots,
      database,
      connection: () => ({ transaction } as unknown as Database.Database)
    });
    const internals = service as unknown as {
      coordinator: {
        preflightPending(rootRunId: string): void;
        enqueuePending(rootRunId: string): Promise<void>;
        sync(rootRunId: string): Promise<void>;
        failRoot(candidate: StoredRootRun, error: unknown): Promise<void>;
      };
    };
    const compositionError = new Error("Execution prompt exceeds 512 KiB after the response.");
    const preflightPending = vi.spyOn(internals.coordinator, "preflightPending").mockReturnValue();
    const enqueuePending = vi.spyOn(internals.coordinator, "enqueuePending").mockRejectedValue(compositionError);
    const sync = vi.spyOn(internals.coordinator, "sync").mockResolvedValue();
    const failRoot = vi.spyOn(internals.coordinator, "failRoot").mockResolvedValue();

    await expect(service.respond(root.rootRunId, step.stepRunId, request)).rejects.toBe(compositionError);

    expect(mutation === "resumeStepRun" ? resumeStepRun : respondToStepRun).toHaveBeenCalledOnce();
    expect(transaction).toHaveBeenCalledOnce();
    expect(preflightPending).toHaveBeenCalledWith(root.rootRunId);
    expect(enqueuePending).toHaveBeenCalledWith(root.rootRunId);
    expect(sync).not.toHaveBeenCalled();
    expect(failRoot).toHaveBeenCalledWith(root, compositionError);
  });
});

const createService = (overrides: Partial<LocalRunServiceOptions>): LocalRunService => new LocalRunService({
  context: { root: "/tmp", worktreesRoot: "/tmp/worktrees" } as ProjectContext,
  connection: () => { throw new Error("Unexpected database connection."); },
  database: {} as RuntimeDatabase,
  roots: {} as RootRunStore,
  executions: {
    listByRoot: vi.fn(() => []),
    cancelActiveByRoot: vi.fn(() => [])
  } as unknown as ExecutionStore,
  runtime: {} as LocalRuntimeService,
  configurations: {} as RuntimeConfigurationService,
  queue: { interrupt: vi.fn() } as unknown as LocalExecutionQueue,
  ...overrides
});

const storedRoot = (status: StoredRootRun["status"]): StoredRootRun => ({
  rootRunId: "root",
  kind: "loop",
  targetId: "delivery",
  source: "manual",
  status,
  worktreePath: "/tmp/worktrees/root",
  branch: "ballet/run/root",
  headSha: "a".repeat(40),
  configHash: "config",
  snapshotHash: "snapshot",
  executionSnapshot,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});
