import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultTerminalNodes,
  type ProjectExecutableStep,
  type ProjectLoop
} from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
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

describe("RootRunExecutionCoordinator failure persistence", () => {
  it("releases a queued execution Loop across a persistence restart", async () => {
    const fixture = await createFixture(agentLoop());
    const root = createRoot(fixture.roots, fixture.snapshot);
    const active = fixture.database.startLoopRun(root.rootRunId, "Original request.");
    fixture.roots.setStatus(root.rootRunId, "queued");
    const finalize = vi.fn(async (rootRunId: string, status: string) => {
      expect(status).toBe("failed");
      expect(fixture.roots.require(rootRunId)).toMatchObject({
        status: "failed",
        outcome: failedOutcome("Composition failed."),
        errorCode: "orchestration_failed",
        errorMessage: "Composition failed.",
        completedAt: expect.any(String)
      });
      expect(fixture.database.listRootLoopRuns(rootRunId)).toEqual([expect.objectContaining({
        status: "failed",
        transitionCount: 0,
        completedAt: expect.any(String),
        stepRuns: [expect.objectContaining({
          status: "failed",
          result: undefined,
          outcome: failedOutcome("Composition failed."),
          error: "Composition failed.",
          completedAt: expect.any(String)
        })]
      })]);
    });

    await coordinator(fixture, finalize).failRoot(
      fixture.roots.require(root.rootRunId),
      new Error("Composition failed.")
    );

    expect(finalize).toHaveBeenCalledOnce();
    fixture.database.close();
    const restarted = openDatabase(fixture.databasePath);
    const restartedRoots = new RootRunStore(() => restarted.connection());
    expect(restartedRoots.require(root.rootRunId).status).toBe("failed");
    expect(restarted.listRootLoopRuns(root.rootRunId)[0]).toMatchObject({
      runId: active.runId,
      status: "failed",
      stepRuns: [expect.objectContaining({ status: "failed" })]
    });

    const futureRoot = createRoot(restartedRoots, fixture.snapshot);
    expect(restarted.startLoopRun(futureRoot.rootRunId)).toMatchObject({
      loopId: fixture.snapshot.rootLoopId,
      status: "running",
      stepRuns: [expect.objectContaining({ status: "queued" })]
    });
  });

  it("preserves a completed decision while releasing a waiting Human Loop across restart", async () => {
    const fixture = await createFixture(humanLoop());
    const root = createRoot(fixture.roots, fixture.snapshot);
    const started = fixture.database.startLoopRun(root.rootRunId, "Original request.");
    const waiting = fixture.database.respondToStepRun(
      started.runId,
      started.stepRuns[0]!.stepRunId,
      "approved",
      "Proceed."
    );
    fixture.roots.setStatus(root.rootRunId, "waiting_for_human");
    expect(waiting.stepRuns).toEqual([
      expect.objectContaining({ status: "completed", result: "approved" }),
      expect.objectContaining({ status: "waiting_for_human" })
    ]);

    const finalize = vi.fn(async () => undefined);
    await coordinator(fixture, finalize).failRoot(
      fixture.roots.require(root.rootRunId),
      new Error("Reconciliation failed.")
    );

    fixture.database.close();
    const restarted = openDatabase(fixture.databasePath);
    const restartedRoots = new RootRunStore(() => restarted.connection());
    const persisted = restarted.listRootLoopRuns(root.rootRunId)[0]!;
    expect(restartedRoots.require(root.rootRunId)).toMatchObject({
      status: "failed",
      outcome: failedOutcome("Reconciliation failed.")
    });
    expect(persisted).toMatchObject({
      status: "failed",
      transitionCount: 1,
      completedAt: expect.any(String)
    });
    expect(persisted.stepRuns).toEqual([
      expect.objectContaining({
        status: "completed",
        result: "approved",
        responseInput: "Proceed."
      }),
      expect.objectContaining({
        status: "failed",
        result: undefined,
        outcome: failedOutcome("Reconciliation failed."),
        error: "Reconciliation failed.",
        completedAt: expect.any(String)
      })
    ]);

    const futureRoot = createRoot(restartedRoots, fixture.snapshot);
    expect(restarted.startLoopRun(futureRoot.rootRunId)).toMatchObject({
      loopId: fixture.snapshot.rootLoopId,
      status: "waiting_for_human",
      stepRuns: [expect.objectContaining({ status: "waiting_for_human" })]
    });
  });
});

describe("RootRunExecutionCoordinator failure transaction", () => {
  it("rolls descendant failures back when the Root failure cannot be persisted", async () => {
    const fixture = await createFixture(agentLoop());
    const root = createRoot(fixture.roots, fixture.snapshot);
    fixture.database.startLoopRun(root.rootRunId);
    fixture.database.connection().exec(`
      CREATE TRIGGER reject_test_root_failure
      BEFORE UPDATE OF status ON root_runs
      WHEN NEW.root_run_id = '${root.rootRunId}' AND NEW.status = 'failed'
      BEGIN SELECT RAISE(ABORT, 'forced root failure'); END;
    `);
    const finalize = vi.fn(async () => undefined);

    await expect(coordinator(fixture, finalize).failRoot(
      fixture.roots.require(root.rootRunId),
      new Error("Composition failed.")
    )).rejects.toThrow("forced root failure");

    expect(fixture.roots.require(root.rootRunId).status).toBe("queued");
    expect(fixture.database.listRootLoopRuns(root.rootRunId)).toEqual([expect.objectContaining({
      status: "running",
      stepRuns: [expect.objectContaining({ status: "queued", outcome: undefined })]
    })]);
    expect(finalize).not.toHaveBeenCalled();
  });
});

const createFixture = async (loop: ProjectLoop) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-root-failure-"));
  temporaryRoots.push(root);
  const databasePath = path.join(root, "runtime.sqlite");
  const database = openDatabase(databasePath);
  const roots = new RootRunStore(() => database.connection());
  return { databasePath, database, roots, snapshot: snapshot(loop) };
};

const openDatabase = (databasePath: string): RuntimeDatabase => {
  const database = new RuntimeDatabase(databasePath);
  databases.push(database);
  database.connection();
  return database;
};

const createRoot = (
  roots: RootRunStore,
  executionSnapshot: RootExecutionSnapshot
) => roots.create({
  rootRunId: randomUUID(),
  kind: "loop",
  targetId: executionSnapshot.rootLoopId,
  source: "manual",
  worktreePath: `/tmp/${randomUUID()}`,
  branch: `ballet/run/${randomUUID()}`,
  headSha: "a".repeat(40),
  configHash: "config",
  snapshotHash: "snapshot",
  executionSnapshot,
  createdAt: new Date().toISOString()
});

const coordinator = (
  fixture: Awaited<ReturnType<typeof createFixture>>,
  finalize: (rootRunId: string, status: string) => Promise<void>
): RootRunExecutionCoordinator => new RootRunExecutionCoordinator({
  connection: () => fixture.database.connection(),
  database: fixture.database,
  roots: fixture.roots,
  executions: new ExecutionStore(() => fixture.database.connection()),
  queue: { cancel: vi.fn() } as unknown as LocalExecutionQueue,
  finalizer: { finalize } as unknown as RootFinalizationCoordinator,
  workspaces: {} as LocalWorkspaceManager
});

const snapshot = (loop: ProjectLoop): RootExecutionSnapshot => ({
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
  executionProfiles: [],
  runtimes: [],
  resources: [],
  createdAt: "2026-07-19T00:00:00.000Z"
});

const agentLoop = (): ProjectLoop => ({
  id: "queued-loop",
  start: "work",
  nodes: [agentStep("work", { approved: "completed", rejected: "blocked" }), ...defaultTerminalNodes()]
});

const humanLoop = (): ProjectLoop => ({
  id: "human-loop",
  start: "first-gate",
  nodes: [
    humanStep("first-gate", { approved: "second-gate", rejected: "blocked" }),
    humanStep("second-gate", { approved: "completed", rejected: "blocked" }),
    ...defaultTerminalNodes()
  ]
});

const agentStep = (id: string, on: ProjectExecutableStep["on"]): ProjectExecutableStep => ({
  id,
  type: "agent",
  executionProfileId: "test-profile",
  primaryInstructionId: "project:test",
  skillIds: [],
  description: `Execute ${id}.`,
  nodeStyle: "flat",
  nodeSize: "medium",
  on
});

const humanStep = (id: string, on: ProjectExecutableStep["on"]): ProjectExecutableStep => ({
  id,
  type: "human",
  description: `Decide ${id}.`,
  nodeStyle: "luna",
  nodeSize: "tiny",
  on
});

const failedOutcome = (summary: string) => ({ state: "failed", summary, checks: [] });
