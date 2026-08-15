import { describe, expect, it, vi } from "vitest";
import type { RootFinalizationReport } from "../../shared/domain/runtime.js";
import {
  createFixture,
  specification,
  waitFor
} from "../execution/LocalExecutionQueue.test-fixture.js";
import type { LocalWorkspaceManager } from "../execution/git/LocalWorkspaceManager.js";
import { RootFinalizationCoordinator } from "./RootFinalizationCoordinator.js";
import { RootRunExecutionCoordinator } from "./RootRunExecutionCoordinator.js";
import { RootRunStore, type StoredRootRun } from "./RootRunStore.js";

describe("Root Run cancellation drain barrier", () => {
  it("finalizes exactly once only after a running provider iterable exits", async () => {
    const fixture = await createFixture({
      onStarted: (task) => coordinator.handleStarted(task),
      onTerminal: (task) => coordinator.handleTerminal(task)
    });
    const rootRunId = "held-root";
    const taskId = "held-task";
    fixture.insertRoot(rootRunId, [taskId]);
    fixture.store.create(specification(taskId, rootRunId));
    fixture.codex.holdThroughCancellation(taskId);
    const roots = new RootRunStore(() => fixture.connection());
    const finalizeWorkspace = vi.fn(async (root: StoredRootRun): Promise<RootFinalizationReport> => ({
      success: false,
      retained: true,
      branch: root.branch,
      worktreePath: root.worktreePath,
      changedFiles: [],
      snapshotHash: root.snapshotHash
    }));
    const workspaces = {
      finalize: finalizeWorkspace,
      cleanupSuccessful: vi.fn(async () => undefined)
    } as unknown as LocalWorkspaceManager;
    const finalizer = new RootFinalizationCoordinator(
      roots,
      fixture.store,
      workspaces,
      () => undefined
    );
    const coordinator = new RootRunExecutionCoordinator({
      connection: () => fixture.connection(),
      database: fixture.database,
      roots,
      executions: fixture.store,
      queue: fixture.queue,
      finalizer,
      workspaces
    });

    await fixture.queue.start();
    await waitFor(() => fixture.store.require(taskId).status === "running");
    await coordinator.cancelRoot(roots.require(rootRunId));

    expect(fixture.codex.cancelled).toEqual([taskId]);
    expect(fixture.codex.exited).toEqual([]);
    expect(fixture.store.require(taskId)).toMatchObject({
      status: "running",
      cancelRequestedAt: expect.any(String),
      completedAt: undefined
    });
    expect(roots.require(rootRunId)).toMatchObject({
      status: "cancelled",
      finalization: undefined
    });
    expect(finalizeWorkspace).not.toHaveBeenCalled();

    fixture.codex.release(taskId);
    await waitFor(() => roots.require(rootRunId).finalization?.status === "completed");

    expect(fixture.codex.exited).toEqual([taskId]);
    expect(fixture.store.require(taskId).status).toBe("cancelled");
    expect(finalizeWorkspace).toHaveBeenCalledOnce();
    await fixture.close();
  });

  it("does not swallow same-tick handleTerminal when the worker drains at the barrier", async () => {
    const fixture = await createFixture();
    const rootRunId = "same-tick-root";
    const taskId = "same-tick-task";
    fixture.insertRoot(rootRunId, [taskId]);
    fixture.store.create(specification(taskId, rootRunId));
    expect(fixture.store.claim(taskId)?.status).toBe("running");
    fixture.store.requestCancel(taskId);
    const roots = new RootRunStore(() => fixture.connection());
    roots.setStatus(rootRunId, "cancelled");
    const finalizeWorkspace = vi.fn(async (root: StoredRootRun): Promise<RootFinalizationReport> => ({
      success: false,
      retained: true,
      branch: root.branch,
      worktreePath: root.worktreePath,
      changedFiles: [],
      snapshotHash: root.snapshotHash
    }));
    const workspaces = {
      finalize: finalizeWorkspace,
      cleanupSuccessful: vi.fn(async () => undefined)
    } as unknown as LocalWorkspaceManager;
    const finalizer = new RootFinalizationCoordinator(
      roots,
      fixture.store,
      workspaces,
      () => undefined
    );
    const listByRoot = fixture.store.listByRoot.bind(fixture.store);
    let scheduledDrain = false;
    let handleTerminal!: Promise<void>;
    vi.spyOn(fixture.store, "listByRoot").mockImplementation((candidateRootRunId) => {
      const tasks = listByRoot(candidateRootRunId);
      if (!scheduledDrain) {
        scheduledDrain = true;
        queueMicrotask(() => {
          fixture.store.finish(taskId, "cancelled");
          handleTerminal = finalizer.finalize(rootRunId, "cancelled");
        });
      }
      return tasks;
    });

    await finalizer.finalize(rootRunId, "cancelled");
    await new Promise((resolve) => setImmediate(resolve));
    await handleTerminal;

    expect(fixture.store.require(taskId).status).toBe("cancelled");
    expect(finalizeWorkspace).toHaveBeenCalledOnce();
    expect(roots.require(rootRunId).finalization?.status).toBe("completed");
    await fixture.close();
  });
});
