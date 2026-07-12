import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RootRunSummary } from "@shared/api/workspace-contracts";
import { RunOverview } from "../src/workspace/runs/RunOverview";
import type { RunDashboardState } from "../src/workspace/runs/useRunDashboard";

const activeRun: RootRunSummary = {
  rootRunId: "root-active",
  kind: "loop",
  targetId: "delivery",
  source: "manual",
  status: "running",
  current: { loopId: "delivery", stepId: "implement", agentId: "developer", taskStatus: "running" },
  createdAt: "2026-07-11T10:00:00.000Z",
  updatedAt: "2026-07-11T10:01:00.000Z"
};

const recentRun: RootRunSummary = {
  rootRunId: "root-recent",
  kind: "agent",
  targetId: "reviewer",
  source: "schedule",
  status: "completed",
  finalization: {
    status: "completed",
    success: true,
    startedAt: "2026-07-11T09:01:00.000Z",
    completedAt: "2026-07-11T09:02:00.000Z",
    report: {
      success: true,
      retained: false,
      branch: "ballet/run/root-recent",
      worktreePath: "/tmp/root-recent",
      commitSha: "a".repeat(40),
      changedFiles: ["src/review.ts"],
      snapshotHash: "b".repeat(64)
    }
  },
  createdAt: "2026-07-11T09:00:00.000Z",
  updatedAt: "2026-07-11T09:02:00.000Z",
  completedAt: "2026-07-11T09:02:00.000Z"
};

describe("Run Overview", () => {
  it("starts, monitors, and cancels root runs while exposing readiness, source, position, and finalization", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const refresh = vi.fn(async () => undefined);
    const cancel = vi.fn(async () => undefined);
    const dashboard: RunDashboardState = {
      active: [activeRun],
      recent: [recentRun],
      targets: {
        loops: [{ kind: "loop", id: "release", name: "Release", ready: true, issues: [] }],
        agents: [{ kind: "agent", id: "publisher", name: "Publisher", ready: false, issues: [{ code: "unbound", message: "No local provider is configured.", agentId: "publisher" }] }]
      },
      loading: false,
      error: "",
      streamStatus: "connected",
      refresh,
      cancel
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/runs" && init?.method === "POST") {
        return Response.json({ rootRunId: "root-new" }, { status: 201 });
      }
      return Response.json({ error: `Unhandled ${init?.method ?? "GET"} ${String(input)}` }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RunOverview dashboard={dashboard} navigate={navigate} />);

    expect(screen.getByText(/delivery · implement · developer · root-active/)).toBeInTheDocument();
    expect(screen.getByText("schedule")).toBeInTheDocument();
    expect(screen.getByText(/src\/review\.ts/)).toBeInTheDocument();
    expect(screen.getByText(/No local provider is configured/)).toBeInTheDocument();
    const startButtons = screen.getAllByRole("button", { name: "Start" });
    expect(startButtons[0]).toBeEnabled();
    expect(startButtons[1]).toBeDisabled();

    await user.click(startButtons[0]!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/runs",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ kind: "loop", targetId: "release" }) })
    ));
    expect(refresh).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/run/loops/release?run=root-new");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledWith(activeRun);

    await user.click(screen.getAllByRole("button", { name: "Monitor" })[0]!);
    expect(navigate).toHaveBeenCalledWith("/run/loops/delivery?run=root-active");
  });
});
