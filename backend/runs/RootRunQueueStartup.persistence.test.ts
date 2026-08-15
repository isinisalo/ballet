import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultTerminalNodes } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { ExecutionStore } from "../execution/ExecutionStore.js";
import { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import { SYSTEM_EXECUTION_INSTRUCTION_ID } from "../execution/SystemExecutionContract.js";
import type { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import { RuntimeDatabase } from "../runtime-db.js";
import type { RootFinalizationCoordinator } from "./RootFinalizationCoordinator.js";
import { RootRunExecutionCoordinator } from "./RootRunExecutionCoordinator.js";
import { RootRunStore } from "./RootRunStore.js";

const temporaryRoots: string[] = [];
const databases: RuntimeDatabase[] = [];

afterEach(async () => {
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Root reconciliation queue startup boundary", () => {
  it("can enqueue after SQLite reopen without invoking the adapter before queue.start", async () => {
    const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "ballet-queue-startup-"));
    temporaryRoots.push(rootDirectory);
    const databasePath = path.join(rootDirectory, "runtime.sqlite");
    const initial = open(databasePath);
    const initialRoots = new RootRunStore(() => initial.connection());
    const root = createRoot(initialRoots);
    initial.startLoopRun(root.rootRunId, "Execute safely.");
    initial.close();

    const database = open(databasePath);
    const roots = new RootRunStore(() => database.connection());
    const executions = new ExecutionStore(() => database.connection());
    const execute = vi.fn();
    const queue = new LocalExecutionQueue({
      store: executions,
      runtime: runtime(execute),
      worktreesRoot: rootDirectory,
      onStarted: (task) => coordinator.handleStarted(task),
      onTerminal: (task) => coordinator.handleTerminal(task)
    });
    const finalize = vi.fn(async () => undefined);
    const coordinator = new RootRunExecutionCoordinator({
      connection: () => database.connection(),
      database,
      roots,
      executions,
      queue,
      finalizer: { finalize } as unknown as RootFinalizationCoordinator,
      workspaces: {
        cleanupOrphans: vi.fn(async () => undefined)
      } as unknown as LocalWorkspaceManager
    });

    await coordinator.reconcile();

    expect(execute).not.toHaveBeenCalled();
    expect(executions.listByRoot(root.rootRunId)).toEqual([expect.objectContaining({ status: "queued" })]);
    expect(database.listRootLoopRuns(root.rootRunId)[0]?.stepRuns[0]).toMatchObject({
      status: "queued",
      executionTaskId: executions.listByRoot(root.rootRunId)[0]?.id
    });
    expect(roots.require(root.rootRunId).status).toBe("queued");

    await queue.start();
    await waitFor(() => executions.listByRoot(root.rootRunId)[0]?.status === "succeeded");

    expect(execute).toHaveBeenCalledOnce();
    expect(roots.require(root.rootRunId).status).toBe("completed");
    expect(finalize).toHaveBeenCalledWith(root.rootRunId, "completed");
    await queue.shutdown(100);
  });
});

const open = (databasePath: string): RuntimeDatabase => {
  const database = new RuntimeDatabase(databasePath);
  databases.push(database);
  database.connection();
  return database;
};

const createRoot = (roots: RootRunStore) => roots.create({
  rootRunId: randomUUID(),
  kind: "loop",
  targetId: snapshot.rootLoopId,
  source: "manual",
  worktreePath: `/tmp/${randomUUID()}`,
  branch: `ballet/run/${randomUUID()}`,
  headSha: "a".repeat(40),
  configHash: "config",
  snapshotHash: "snapshot",
  executionSnapshot: snapshot,
  createdAt: new Date().toISOString()
});

const runtime = (execute: () => void): LocalRuntimeService => ({
  verify: vi.fn(async () => undefined),
  adapter: vi.fn(() => ({
    execute: async function* () {
      execute();
      yield {
        type: "execution.completed",
        output: "done",
        structuredOutput: { state: "completed", result: "approved", summary: "Done.", checks: [] }
      };
    },
    cancel: vi.fn(async () => undefined)
  }))
} as unknown as LocalRuntimeService);

const waitFor = async (predicate: () => boolean): Promise<void> => {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for queued execution.");
};

const systemContent = "System contract.";
const primaryContent = "Primary instruction.";
const snapshot: RootExecutionSnapshot = {
  version: 1,
  rootLoopId: "startup-loop",
  project: {
    checkoutRoot: "/tmp/project",
    headSha: "a".repeat(40),
    configHash: "config",
    snapshotHash: "snapshot"
  },
  loops: [{
    id: "startup-loop",
    start: "work",
    nodes: [{
      id: "work",
      type: "agent",
      executionProfileId: "test-profile",
      primaryInstructionId: "project:test",
      skillIds: [],
      description: "Execute safely.",
      nodeStyle: "flat",
      nodeSize: "medium",
      on: { approved: "completed", rejected: "blocked" }
    }, ...defaultTerminalNodes()]
  }],
  theme: defaultLoopTheme,
  executionProfiles: [{
    id: "test-profile",
    name: "Test profile",
    provider: "codex",
    model: "test-model",
    reasoningEffort: "medium",
    networkAccess: false
  }],
  runtimes: [{
    executionProfileId: "test-profile",
    runtime: {
      hostname: "localhost",
      provider: "codex",
      cliVersion: "1",
      model: "test-model",
      reasoning: "medium",
      policy: { network: false, readOnlyRoots: [] },
      capabilityHash: "capabilities"
    }
  }],
  resources: [{
    kind: "system",
    origin: "system",
    id: SYSTEM_EXECUTION_INSTRUCTION_ID,
    sourceSha256: sha256(systemContent),
    content: systemContent
  }, {
    kind: "primary",
    origin: "project",
    id: "project:test",
    relativePath: ".ballet/instructions/test.md",
    sourceSha256: sha256(primaryContent),
    content: primaryContent
  }],
  createdAt: "2026-07-19T00:00:00.000Z"
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
