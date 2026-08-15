import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stepOutcomeJsonSchema } from "../../shared/api/runtime-schemas.js";
import { defaultTerminalNodes, type ProjectLoop } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type {
  ExecutionRuntimeSnapshot,
  ExecutionSpec,
  RootExecutionSnapshot
} from "../../shared/domain/runtime.js";
import { ExecutionStore } from "../execution/ExecutionStore.js";
import { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import type { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { RootFinalizationCoordinator } from "./RootFinalizationCoordinator.js";
import { RootRunExecutionCoordinator } from "./RootRunExecutionCoordinator.js";
import { RootRunStore } from "./RootRunStore.js";

const temporaryRoots: string[] = [];
const databases: RuntimeDatabase[] = [];

afterEach(async () => {
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Root task terminalization crash recovery", () => {
  it.each([
    { terminal: "failed" as const, taskStatus: "running" as const },
    { terminal: "cancelled" as const, taskStatus: "queued" as const }
  ])("durably persists $terminal across a crash with a $taskStatus task", async ({ terminal, taskStatus }) => {
    const fixture = await createFixture();
    const active = createTaskGraph(fixture, taskStatus);
    const crash = vi.fn(async () => { throw new Error("simulated process crash"); });
    const interrupt = vi.fn(async () => undefined);
    const coordinator = createCoordinator(fixture, { finalize: crash }, { interrupt });

    const operation = terminal === "failed"
      ? coordinator.failRoot(active.root, new Error("Composition failed."))
      : coordinator.cancelRoot(active.root);
    await expect(operation).rejects.toThrow("simulated process crash");
    expect(interrupt).toHaveBeenCalledWith(active.taskId, `Root Run ${terminal}.`);
    fixture.database.close();

    const restarted = reopen(fixture.databasePath);
    const persisted = stores(restarted);
    const adapterExecute = vi.fn();
    const queue = new LocalExecutionQueue({
      store: persisted.executions,
      runtime: runtime(adapterExecute),
      worktreesRoot: fixture.root,
      onStarted: (task) => restartedCoordinator.handleStarted(task),
      onTerminal: (task) => restartedCoordinator.handleTerminal(task)
    });
    const finalize = vi.fn(async () => undefined);
    const restartedCoordinator = createCoordinator(
      { ...fixture, database: restarted, ...persisted },
      { finalize },
      queue
    );

    await restartedCoordinator.reconcile();
    expect(adapterExecute).not.toHaveBeenCalled();
    await queue.start();
    await new Promise((resolve) => setImmediate(resolve));

    expect(adapterExecute).not.toHaveBeenCalled();
    expect(persisted.roots.require(active.root.rootRunId).status).toBe(terminal);
    expect(persisted.executions.require(active.taskId)).toMatchObject({
      status: "cancelled",
      cancelRequestedAt: expect.any(String),
      completedAt: expect.any(String)
    });
    expect(restarted.listRootLoopRuns(active.root.rootRunId)[0]).toMatchObject({
      status: terminal,
      stepRuns: [expect.objectContaining({ status: terminal })]
    });
    expect(finalize).toHaveBeenCalledWith(active.root.rootRunId, terminal);

    const future = createRoot(persisted.roots, fixture.snapshot);
    expect(restarted.startLoopRun(future.rootRunId).loopId).toBe(fixture.snapshot.rootLoopId);
    await queue.shutdown(100);
  });

  it("rolls task and descendant terminalization back when the Root write fails", async () => {
    const fixture = await createFixture();
    const active = createTaskGraph(fixture, "queued");
    fixture.database.connection().exec(`
      CREATE TRIGGER reject_crash_test_root_failure
      BEFORE UPDATE OF status ON root_runs
      WHEN NEW.root_run_id = '${active.root.rootRunId}' AND NEW.status = 'failed'
      BEGIN SELECT RAISE(ABORT, 'forced root failure'); END;
    `);
    const coordinator = createCoordinator(
      fixture,
      { finalize: vi.fn(async () => undefined) },
      { interrupt: vi.fn(async () => undefined) }
    );

    await expect(coordinator.failRoot(active.root, new Error("Composition failed.")))
      .rejects.toThrow("forced root failure");

    expect(fixture.roots.require(active.root.rootRunId).status).toBe("queued");
    expect(fixture.database.getStepRun(active.stepRunId)?.status).toBe("queued");
    expect(fixture.executions.require(active.taskId)).toMatchObject({
      status: "queued",
      cancelRequestedAt: undefined,
      completedAt: undefined
    });
  });
});

const createFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-root-task-crash-"));
  temporaryRoots.push(root);
  const databasePath = path.join(root, "runtime.sqlite");
  const database = reopen(databasePath);
  return { root, databasePath, database, snapshot: executionSnapshot(), ...stores(database) };
};

const reopen = (databasePath: string): RuntimeDatabase => {
  const database = new RuntimeDatabase(databasePath);
  databases.push(database);
  database.connection();
  return database;
};

const stores = (database: RuntimeDatabase) => ({
  roots: new RootRunStore(() => database.connection()),
  executions: new ExecutionStore(() => database.connection())
});

const createTaskGraph = (
  fixture: Awaited<ReturnType<typeof createFixture>>,
  taskStatus: "queued" | "running"
) => {
  const root = createRoot(fixture.roots, fixture.snapshot);
  const run = fixture.database.startLoopRun(root.rootRunId, "Execute safely.");
  const stepRunId = run.stepRuns[0]!.stepRunId;
  const taskId = randomUUID();
  fixture.executions.create(specification(taskId, root.rootRunId, run.runId, stepRunId));
  fixture.database.bindStepExecution(stepRunId, taskId, runtimeSnapshot);
  if (taskStatus === "running") {
    fixture.executions.claim(taskId);
    fixture.database.markStepRunRunning(stepRunId);
    fixture.roots.setStatus(root.rootRunId, "running");
  }
  return { root: fixture.roots.require(root.rootRunId), taskId, stepRunId };
};

const createRoot = (roots: RootRunStore, snapshot: RootExecutionSnapshot) => roots.create({
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

const createCoordinator = (
  fixture: Awaited<ReturnType<typeof createFixture>>,
  finalizer: Pick<RootFinalizationCoordinator, "finalize">,
  queue: Pick<LocalExecutionQueue, "interrupt">,
  workspaces: LocalWorkspaceManager = workspace(vi.fn())
) => new RootRunExecutionCoordinator({
  connection: () => fixture.database.connection(),
  database: fixture.database,
  roots: fixture.roots,
  executions: fixture.executions,
  queue: queue as LocalExecutionQueue,
  finalizer: finalizer as RootFinalizationCoordinator,
  workspaces
});

const workspace = (finalize: ReturnType<typeof vi.fn>): LocalWorkspaceManager => ({
  cleanupOrphans: vi.fn(async () => undefined),
  cleanupSuccessful: vi.fn(async () => undefined),
  finalize
} as unknown as LocalWorkspaceManager);

const runtime = (execute: () => void): LocalRuntimeService => ({
  verify: vi.fn(async () => undefined),
  adapter: vi.fn(() => ({
    execute: () => ({
      async *[Symbol.asyncIterator]() {
        execute();
        yield* [];
      }
    }),
    cancel: vi.fn(async () => undefined)
  }))
} as unknown as LocalRuntimeService);

const executionSnapshot = (): RootExecutionSnapshot => ({
  version: 1,
  rootLoopId: loop.id,
  project: {
    checkoutRoot: "/tmp/project",
    headSha: "a".repeat(40),
    configHash: "config",
    snapshotHash: "snapshot"
  },
  loops: [loop],
  theme: defaultLoopTheme,
  executionProfiles: [profile],
  runtimes: [{ executionProfileId: profile.id, runtime: runtimeSnapshot }],
  resources: [],
  createdAt: "2026-07-19T00:00:00.000Z"
});

const loop: ProjectLoop = {
  id: "crash-loop",
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
};

const profile = {
  id: "test-profile",
  name: "Test profile",
  provider: "codex" as const,
  model: "test-model",
  reasoningEffort: "medium",
  networkAccess: false
};

const runtimeSnapshot: ExecutionRuntimeSnapshot = {
  hostname: "localhost",
  provider: "codex",
  cliVersion: "1",
  model: "test-model",
  reasoning: "medium",
  policy: { network: false, readOnlyRoots: [] },
  capabilityHash: "capabilities"
};

const specification = (
  taskId: string,
  rootRunId: string,
  loopRunId: string,
  stepRunId: string
): ExecutionSpec => {
  const prompt = `Run ${taskId}`;
  return {
    version: 2,
    taskId,
    kind: "loop_step",
    rootRunId,
    loopRunId,
    stepRunId,
    evidence: {
      compositionVersion: 1,
      loopId: loop.id,
      stepId: "work",
      executionProfile: profile,
      resources: [],
      prompt,
      promptSha256: sha256(prompt),
      outputSchemaVersion: 1,
      outputSchemaSha256: sha256(JSON.stringify(stepOutcomeJsonSchema))
    },
    runtime: runtimeSnapshot,
    project: {
      checkoutRoot: "/tmp/project",
      headSha: "a".repeat(40),
      configHash: "config",
      snapshotHash: "snapshot"
    },
    createdAt: new Date().toISOString()
  };
};

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
