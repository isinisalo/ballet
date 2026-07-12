import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  builtInLoopThemes,
  resolveLoopTheme,
  type AppData,
  type LoopRunDetails,
  type LoopTheme,
  type ProjectLoop
} from "@shared/api/workspace-contracts";
import { WorkspaceApp } from "../src/WorkspaceApp";
import { emptyData } from "../src/workspace/types";

const now = "2026-07-10T10:00:00.000Z";
const loop: ProjectLoop = {
  id: "delivery",
  theme: "open-ai",
  start: "approval",
  steps: [{ id: "approval", type: "human", nodeSize: "small", description: "Approve delivery", on: { approved: { end: "completed" }, rejected: { end: "failed" } } }]
};

const run = (
  status: LoopRunDetails["status"],
  themeSnapshot: LoopTheme = resolveLoopTheme(builtInLoopThemes, loop.theme)
): LoopRunDetails => ({
  runId: "run-1", loopId: loop.id, rootRunId: "run-1", source: "manual", status, snapshot: loop,
  themeSnapshot,
  transitionCount: 0, createdAt: now, updatedAt: now,
  stepRuns: status === "waiting_for_human" ? [{
    stepRunId: "step-run-1", runId: "run-1", loopId: loop.id, stepId: "approval", type: "human",
    status: "waiting_for_human", attempt: 1, createdAt: now, updatedAt: now
  }] : []
});

const data = (latest: LoopRunDetails | null): AppData => ({
  ...emptyData,
  loopRuns: latest ? [latest] : [],
  automation: { version: 6, loops: [loop] }, automationIssues: [], scheduleStates: [],
  loopThemes: [...builtInLoopThemes], loopThemeIssues: [], projectDocumentTree: [],
  runTargets: {
    loops: [{ kind: "loop", id: "delivery", name: "delivery", ready: true, issues: [], ...latest ? { latestRootRunId: latest.rootRunId, ...["running", "waiting_for_human"].includes(latest.status) ? { activeRootRunId: latest.rootRunId } : {} } : {} }],
    agents: []
  }
});

function installApi(latest: LoopRunDetails | null) {
  const workspace = data(latest);
  let current = latest;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/data") return Response.json(workspace);
    if (url.startsWith("/api/runs?state=active")) return Response.json({ items: [] });
    if (url.startsWith("/api/runs?state=recent")) return Response.json({ items: [] });
    if (url === "/api/runs/run-1" && current) return Response.json({
      rootRunId: current.rootRunId,
      kind: "loop",
      targetId: current.loopId,
      source: current.source,
      status: current.status,
      current: current.stepRuns[0] ? { loopRunId: current.runId, loopId: current.loopId, stepRunId: current.stepRuns[0].stepRunId, stepId: current.stepRuns[0].stepId } : undefined,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
      completedAt: current.completedAt,
      loopRuns: [current],
      tasks: []
    });
    if (url === "/api/runs" && method === "POST") {
      current = run("running");
      return Response.json(rootDetail(current));
    }
    if (url === "/api/runs/run-1/steps/step-run-1/respond" && method === "POST") {
      current = run("completed");
      return Response.json(rootDetail(current));
    }
    if (url === "/api/runs/run-1/cancel" && method === "POST") {
      current = run("cancelled");
      return Response.json(rootDetail(current));
    }
    if (url.includes("/console?")) {
      return Response.json({ entries: [], lastId: 0, hasMore: false, truncated: false });
    }
    if (url === "/api/automation" && method === "PUT") {
      workspace.automation = JSON.parse(String(init?.body));
      return Response.json(workspace.automation);
    }
    return Response.json({ error: `Unhandled ${method} ${url}` }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderRun(latest: LoopRunDetails | null) {
  const fetchMock = installApi(latest);
  window.history.pushState({}, "", "/run/loops/delivery");
  render(<WorkspaceApp />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/data", expect.anything()));
  return fetchMock;
}

describe("automation v6 UI", () => {
  it("starts a saved Loop from global Ballet Run without local mode controls", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderRun(null);
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    const manualInput = screen.getByLabelText("Manual input (optional)");
    await waitFor(() => expect(manualInput).toBeEnabled());
    await user.type(manualInput, "Ship release");
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/runs", expect.objectContaining({ method: "POST", body: JSON.stringify({ kind: "loop", targetId: "delivery", input: "Ship release" }) })));
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/run/loops/delivery");
  });

  it("requires human input and responds directly to a StepRun", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderRun(run("waiting_for_human"));
    const approved = await screen.findByRole("button", { name: "Approved" });
    expect(approved).toBeDisabled();
    await user.type(screen.getByLabelText("Response"), "Looks good");
    await user.click(approved);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/runs/run-1/steps/step-run-1/respond", expect.objectContaining({ method: "POST" })));
  });

  it("offers a new run after the latest run has finished", async () => {
    const user = userEvent.setup();
    await renderRun(run("completed"));
    await user.click(await screen.findByRole("button", { name: "New run" }));
    expect(screen.getByLabelText("Manual input (optional)")).toBeEnabled();
  });

  it("renders an existing Run with its immutable theme snapshot", async () => {
    const liveTheme = resolveLoopTheme(builtInLoopThemes, loop.theme);
    const archivedTheme: LoopTheme = { ...liveTheme, id: "archived-theme", label: "Archived theme" };

    await renderRun(run("completed", archivedTheme));

    await waitFor(() => expect(document.querySelector("[data-loop-canvas]"))
      .toHaveAttribute("data-loop-theme", "archived-theme"));
  });

  it("cancels the active loop run from Run mode", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderRun(run("running"));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/runs/run-1/cancel",
      expect.objectContaining({ method: "POST" })
    ));
  });
});

const rootDetail = (current: LoopRunDetails) => ({
  rootRunId: current.rootRunId,
  kind: "loop",
  targetId: current.loopId,
  source: current.source === "schedule" ? "schedule" : "manual",
  status: current.status,
  current: current.stepRuns[0] ? { loopRunId: current.runId, loopId: current.loopId, stepRunId: current.stepRuns[0].stepRunId, stepId: current.stepRuns[0].stepId } : undefined,
  createdAt: current.createdAt,
  updatedAt: current.updatedAt,
  completedAt: current.completedAt,
  loopRuns: [current],
  tasks: []
});
