import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  defaultTerminalNodes,
  type LoopRunDetails,
  type ProjectLoop,
  type RootRunDetail,
  type RunTarget
} from "@shared/api/workspace-contracts";
import { useLoopRun } from "../src/workspace/automation/loops/useLoopRun";

const now = "2026-07-19T10:00:00.000Z";
const loopId = "archived-loop";

describe("Loop Run association", () => {
  it("rejects a mismatched Root Run returned by the detail API", async () => {
    const requestedLoopId = "configured-loop";
    const fetched = rootRun("root-history");
    const fetchMock = vi.fn(async () => Response.json(fetched));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLoopRun(requestedLoopId, "stable", "connected", fetched.rootRunId));

    await waitFor(() => expect(result.current.pendingOperation).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(`/api/runs/${fetched.rootRunId}`, expect.anything());
    expect(result.current.rootDetail).toBeUndefined();
    expect(result.current.details).toBeNull();
    expect(result.current.error).toBe(`Root Run "${fetched.rootRunId}" does not belong to Loop "${requestedLoopId}".`);
  });

  it("hides the previous implicit Root before effects run when the selected target changes", async () => {
    const first = rootRun("root-history");
    const pending = new Promise<Response>(() => undefined);
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) =>
      String(input) === `/api/runs/${first.rootRunId}` ? Promise.resolve(Response.json(first)) : pending));
    const renderedRootIds: Array<string | undefined> = [];
    const { result, rerender } = renderHook(({ target }: { target: RunTarget }) => {
      const controller = useLoopRun(loopId, "stable", "connected", undefined, target);
      renderedRootIds.push(controller.rootDetail?.rootRunId);
      return controller;
    }, { initialProps: { target: runTarget(first.rootRunId) } });
    await waitFor(() => expect(result.current.rootDetail?.rootRunId).toBe(first.rootRunId));

    renderedRootIds.length = 0;
    rerender({ target: runTarget("root-next") });

    expect(renderedRootIds[0]).toBeUndefined();
    expect(result.current.rootDetail).toBeUndefined();
    expect(result.current.details).toBeNull();
  });
});

function rootRun(rootRunId: string): RootRunDetail {
  const snapshot: ProjectLoop = {
    id: loopId,
    start: "approval",
    nodes: [{
      id: "approval",
      type: "human",
      nodeStyle: "luna",
      nodeSize: "tiny",
      description: "Approve the captured Run.",
      on: { approved: "completed", rejected: "failed" }
    }, ...defaultTerminalNodes()]
  };
  const run: LoopRunDetails = {
    runId: `loop-${rootRunId}`,
    loopId,
    rootRunId,
    source: "manual",
    status: "completed",
    snapshot,
    themeSnapshot: structuredClone(defaultLoopTheme),
    transitionCount: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    stepRuns: []
  };
  return {
    rootRunId,
    kind: "loop",
    targetId: loopId,
    source: "manual",
    status: "completed",
    current: { loopRunId: run.runId, loopId },
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    executionSnapshot: {
      version: 1,
      rootLoopId: loopId,
      project: {
        checkoutRoot: "/workspace/ballet",
        headSha: "a".repeat(40),
        configHash: "b".repeat(64),
        snapshotHash: "c".repeat(64)
      },
      loops: [snapshot],
      theme: structuredClone(defaultLoopTheme),
      executionProfiles: [],
      runtimes: [],
      resources: [],
      createdAt: now
    },
    loopRuns: [run],
    tasks: []
  };
}

function runTarget(rootRunId: string): RunTarget {
  return {
    kind: "loop",
    id: loopId,
    name: loopId,
    ready: true,
    issues: [],
    activeRootRunId: rootRunId,
    latestRootRunId: rootRunId
  };
}
