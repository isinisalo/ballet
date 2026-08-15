import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultTerminalNodes } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { ExecutionStore } from "../execution/ExecutionStore.js";
import type { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import type { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { RootFinalizationCoordinator } from "./RootFinalizationCoordinator.js";
import { RootRunExecutionCoordinator } from "./RootRunExecutionCoordinator.js";
import { RootRunStore, type StoredRootRun } from "./RootRunStore.js";

const temporaryRoots: string[] = [];
const databases: RuntimeDatabase[] = [];

afterEach(async () => {
  databases.splice(0).forEach((database) => database.close());
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("terminal Root finalization recovery", () => {
  it.each(["completed", "failed", "cancelled"] as const)(
    "resumes missing %s finalization exactly once after restart",
    async (terminal) => {
      const fixture = await createFixture();
      const root = createRoot(fixture.roots);
      fixture.roots.setStatus(root.rootRunId, terminal);
      fixture.database.close();
      const finalizeWorkspace = vi.fn(async (_root: StoredRootRun, success: boolean) => ({
        success,
        retained: !success,
        branch: root.branch,
        worktreePath: root.worktreePath,
        changedFiles: [],
        snapshotHash: root.snapshotHash
      }));
      const workspaces = workspace(finalizeWorkspace);

      const first = reopen(fixture.databasePath);
      await coordinator(first, workspaces).reconcile();
      expect(new RootRunStore(() => first.connection()).require(root.rootRunId)).toMatchObject({
        status: terminal,
        finalization: { status: "completed" }
      });
      first.close();

      const second = reopen(fixture.databasePath);
      await coordinator(second, workspaces).reconcile();

      expect(finalizeWorkspace).toHaveBeenCalledOnce();
    }
  );
});

const createFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-finalization-recovery-"));
  temporaryRoots.push(root);
  const databasePath = path.join(root, "runtime.sqlite");
  const database = reopen(databasePath);
  return { databasePath, database, roots: new RootRunStore(() => database.connection()) };
};

const reopen = (databasePath: string): RuntimeDatabase => {
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

const coordinator = (database: RuntimeDatabase, workspaces: LocalWorkspaceManager) => {
  const roots = new RootRunStore(() => database.connection());
  const executions = new ExecutionStore(() => database.connection());
  const finalizer = new RootFinalizationCoordinator(roots, executions, workspaces, () => undefined);
  return new RootRunExecutionCoordinator({
    connection: () => database.connection(),
    database,
    roots,
    executions,
    queue: { interrupt: vi.fn(async () => undefined) } as unknown as LocalExecutionQueue,
    finalizer,
    workspaces
  });
};

const workspace = (finalize: ReturnType<typeof vi.fn>): LocalWorkspaceManager => ({
  cleanupOrphans: vi.fn(async () => undefined),
  cleanupSuccessful: vi.fn(async () => undefined),
  finalize
} as unknown as LocalWorkspaceManager);

const snapshot: RootExecutionSnapshot = {
  version: 1,
  rootLoopId: "finalization-loop",
  project: {
    checkoutRoot: "/tmp/project",
    headSha: "a".repeat(40),
    configHash: "config",
    snapshotHash: "snapshot"
  },
  loops: [{
    id: "finalization-loop",
    start: "gate",
    nodes: [{
      id: "gate",
      type: "human",
      description: "Approve.",
      nodeStyle: "luna",
      nodeSize: "tiny",
      on: { approved: "completed", rejected: "blocked" }
    }, ...defaultTerminalNodes()]
  }],
  theme: defaultLoopTheme,
  executionProfiles: [],
  runtimes: [],
  resources: [],
  createdAt: "2026-07-19T00:00:00.000Z"
};
