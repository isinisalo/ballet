import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  defaultTerminalNodes,
  type AppData,
  type LoopRunDetails,
  type LoopTheme,
  type ProjectLoop,
  type RootRunDetail,
  type RunTarget
} from "@shared/api/workspace-contracts";
import { RunWorkspace } from "../src/workspace/runs/RunWorkspace";
import type { RunDashboardState } from "../src/workspace/runs/useRunDashboard";
import { routeFromPath } from "../src/workspace/routing";
import { emptyData } from "../src/workspace/types";

const now = "2026-07-19T10:00:00.000Z";
const historicalLoopId = "archived-loop";
const unavailableReason = "This Loop is no longer configured. Historical Run evidence remains available, but starting a new Run requires a configured Loop.";

describe("historical Run workspace", () => {
  it.each([
    { state: "deleted", liveLoops: [], targets: [] },
    {
      state: "renamed",
      liveLoops: [loop("renamed-loop")],
      targets: [{ kind: "loop", id: "renamed-loop", name: "renamed-loop", ready: true, issues: [] } satisfies RunTarget]
    }
  ])("renders immutable evidence when the live Loop was $state", async ({ liveLoops, targets }) => {
    const root = rootRun();
    render(
      <RunWorkspace
        route={routeFromPath(`/run/loops/${historicalLoopId}?run=${root.rootRunId}`)}
        data={appData(liveLoops)}
        appStreamStatus="connected"
        dashboard={dashboard(root, targets)}
        navigate={vi.fn()}
      />
    );

    const canvas = await screen.findByLabelText("Run loop canvas");
    expect(await screen.findByRole("button", { name: "View step approval" })).toBeInTheDocument();
    await waitFor(() => expect(canvas.style.getPropertyValue("--loop-theme-edge-color")).toBe("#abcdef"));
    expect(screen.getByText(unavailableReason)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New run" })).toBeDisabled();
    expect(screen.queryByText("Loop not found.")).not.toBeInTheDocument();
  });

  it("disables Start when a historical Root Run has no LoopRun", async () => {
    const root = rootRun(false);
    render(
      <RunWorkspace
        route={routeFromPath(`/run/loops/${historicalLoopId}?run=${root.rootRunId}`)}
        data={appData([])}
        appStreamStatus="connected"
        dashboard={dashboard(root)}
        navigate={vi.fn()}
      />
    );

    expect(await screen.findByRole("form", { name: "Start loop run" })).toBeInTheDocument();
    expect(screen.getByText(unavailableReason)).toBeInTheDocument();
    expect(screen.getByLabelText("Manual input (optional)")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("renders the current reached Loop from a valid Root Loop route", async () => {
    const root = crossLoopRootRun();
    render(
      <RunWorkspace
        route={routeFromPath(`/run/loops/${historicalLoopId}?run=${root.rootRunId}`)}
        data={appData([])}
        appStreamStatus="connected"
        dashboard={dashboard(root)}
        navigate={vi.fn()}
      />
    );

    expect(await screen.findByRole("button", { name: "View step reached-approval" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View step approval" })).not.toBeInTheDocument();
  });

  it("uses snapshot fallback only for an explicitly selected Root Run", () => {
    render(
      <RunWorkspace
        route={routeFromPath(`/run/loops/${historicalLoopId}`)}
        data={appData([])}
        appStreamStatus="connected"
        dashboard={dashboard(rootRun())}
        navigate={vi.fn()}
      />
    );

    expect(screen.getByText("Loop not found.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Run loop canvas")).not.toBeInTheDocument();
  });

  it("rejects a pre-supplied Root Run associated with another Loop", () => {
    const requestedLoopId = "configured-loop";
    const root = rootRun();
    render(
      <RunWorkspace
        route={routeFromPath(`/run/loops/${requestedLoopId}?run=${root.rootRunId}`)}
        data={appData([loop(requestedLoopId)])}
        appStreamStatus="connected"
        dashboard={dashboard(root, [{ kind: "loop", id: requestedLoopId, name: requestedLoopId, ready: true, issues: [] }])}
        navigate={vi.fn()}
      />
    );

    expect(screen.getByText("Run not found.")).toBeInTheDocument();
    expect(screen.getByText(`Root Run "${root.rootRunId}" does not belong to Loop "${requestedLoopId}".`)).toBeInTheDocument();
    expect(screen.queryByLabelText("Run loop canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New run" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
  });

  it("waits for the selected snapshot instead of transiently rendering a live Loop", () => {
    const prior = { ...rootRun(), rootRunId: "root-prior" };
    render(
      <RunWorkspace
        route={routeFromPath(`/run/loops/${historicalLoopId}?run=root-history`)}
        data={appData([loop()])}
        appStreamStatus="connected"
        dashboard={dashboard(prior, [], true)}
        navigate={vi.fn()}
      />
    );

    expect(screen.getByText("Loading historical Run…")).toBeInTheDocument();
    expect(screen.queryByText("Loop not found.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Run loop canvas")).not.toBeInTheDocument();
  });

});

function loop(id = historicalLoopId): ProjectLoop {
  return {
    id,
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
}

function theme(edgeColor: string): LoopTheme {
  return {
    ...structuredClone(defaultLoopTheme),
    edge: { ...defaultLoopTheme.edge, color: edgeColor }
  };
}

function loopRun(snapshot: ProjectLoop): LoopRunDetails {
  return {
    runId: "loop-run-history",
    loopId: snapshot.id,
    rootRunId: "root-history",
    source: "manual",
    status: "completed",
    snapshot,
    themeSnapshot: theme("#654321"),
    transitionCount: 1,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    stepRuns: [{
      stepRunId: "step-run-history",
      runId: "loop-run-history",
      loopId: snapshot.id,
      stepId: "approval",
      type: "human",
      status: "completed",
      result: "approved",
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      completedAt: now
    }]
  };
}

function rootRun(withLoopRun = true): RootRunDetail {
  const snapshot = loop();
  const run = loopRun(snapshot);
  return {
    rootRunId: "root-history",
    kind: "loop",
    targetId: snapshot.id,
    source: "manual",
    status: withLoopRun ? "completed" : "failed",
    current: withLoopRun ? { loopRunId: run.runId, loopId: snapshot.id } : undefined,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    executionSnapshot: {
      version: 1,
      rootLoopId: snapshot.id,
      project: {
        checkoutRoot: "/workspace/ballet",
        headSha: "a".repeat(40),
        configHash: "b".repeat(64),
        snapshotHash: "c".repeat(64)
      },
      loops: [snapshot],
      theme: theme("#abcdef"),
      executionProfiles: [],
      runtimes: [],
      resources: [],
      createdAt: now
    },
    loopRuns: withLoopRun ? [run] : [],
    tasks: []
  };
}

function crossLoopRootRun(): RootRunDetail {
  const root = rootRun();
  const reachedLoop: ProjectLoop = {
    ...loop("reached-loop"),
    start: "reached-approval",
    nodes: [{
      ...loop("reached-loop").nodes[0],
      id: "reached-approval",
      description: "Approve the reached Loop."
    }, ...defaultTerminalNodes()]
  };
  const reachedRun: LoopRunDetails = {
    ...loopRun(reachedLoop),
    runId: "loop-run-reached",
    loopId: reachedLoop.id,
    rootRunId: root.rootRunId,
    snapshot: reachedLoop,
    stepRuns: [{
      ...loopRun(reachedLoop).stepRuns[0],
      runId: "loop-run-reached",
      loopId: reachedLoop.id,
      stepId: reachedLoop.start
    }]
  };
  return {
    ...root,
    current: {
      loopRunId: reachedRun.runId,
      loopId: reachedLoop.id,
      stepRunId: reachedRun.stepRuns[0].stepRunId,
      stepId: reachedLoop.start
    },
    executionSnapshot: {
      ...root.executionSnapshot,
      loops: [...root.executionSnapshot.loops, reachedLoop]
    },
    loopRuns: [...root.loopRuns, reachedRun]
  };
}

function appData(liveLoops: ProjectLoop[]): AppData {
  return {
    ...emptyData,
    automation: { version: 9, loops: liveLoops },
    loopTheme: theme("#123456")
  };
}

function dashboard(detail?: RootRunDetail, targets: RunTarget[] = [], loading = false): RunDashboardState {
  return {
    active: [],
    recent: [],
    targets: { loops: targets },
    detail,
    loading,
    error: "",
    streamStatus: "connected",
    refresh: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined)
  };
}
