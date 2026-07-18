import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  defaultTerminalNodes,
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
  start: "approval",
  nodes: [{ id: "approval", type: "human", nodeStyle: "luna", nodeSize: "tiny", description: "Approve delivery", on: { approved: "completed", rejected: "failed" } }, ...defaultTerminalNodes()]
};

const run = (
  status: LoopRunDetails["status"],
  themeSnapshot: LoopTheme = structuredClone(defaultLoopTheme)
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
  automation: { version: 8, loops: [loop] }, automationIssues: [], scheduleStates: [],
  loopTheme: structuredClone(defaultLoopTheme), loopThemeIssues: [], projectDocumentTree: [],
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

describe("automation v8 UI", () => {
  it("starts a saved Loop from global Ballet Run without local mode controls", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderRun(null);
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Start loop run" })).toBeInTheDocument();
    const manualInput = screen.getByLabelText("Manual input (optional)");
    await waitFor(() => expect(manualInput).toBeEnabled());
    await user.type(manualInput, "Ship release{Enter}");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/runs", expect.objectContaining({ method: "POST", body: JSON.stringify({ kind: "loop", targetId: "delivery", input: "Ship release" }) })));
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/run/loops/delivery");
  });

  it("requires human input and responds directly to a StepRun", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderRun(run("waiting_for_human"));
    const approved = await screen.findByRole("button", { name: "Approved" });
    expect(approved).toBeEnabled();
    await user.click(approved);
    expect(screen.getByText("Response is required.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Response"), "Looks good");
    expect(screen.queryByText("Response is required.")).not.toBeInTheDocument();
    await user.click(approved);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/runs/run-1/steps/step-run-1/respond", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ kind: "human", result: "approved", input: "Looks good" })
    })));
  });

  it("keeps the rejected Human Gate submit intent", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderRun(run("waiting_for_human"));
    await user.type(await screen.findByLabelText("Response"), "Needs another pass");
    await user.click(screen.getByRole("button", { name: "Rejected" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/runs/run-1/steps/step-run-1/respond", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ kind: "human", result: "rejected", input: "Needs another pass" })
    })));
  });

  it("offers a new run after the latest run has finished", async () => {
    const user = userEvent.setup();
    await renderRun(run("completed"));
    await user.click(await screen.findByRole("button", { name: "New run" }));
    expect(await screen.findByLabelText("Manual input (optional)", {}, { timeout: 3_000 })).toBeEnabled();
  });

  it("renders an existing Run with its immutable theme snapshot", async () => {
    const archivedTheme: LoopTheme = {
      ...structuredClone(defaultLoopTheme),
      edge: { ...defaultLoopTheme.edge, color: "#abcdef" }
    };

    await renderRun(run("completed", archivedTheme));

    await waitFor(() => expect((document.querySelector("[data-loop-canvas]") as HTMLElement).style
      .getPropertyValue("--loop-theme-edge-color")).toBe("#abcdef"));
  });

  it("creates a Loop only after ghost activation, a valid Loop ID, and explicit Save", async () => {
    const user = userEvent.setup();
    const fetchMock = installApi(null);
    window.history.replaceState({}, "", "/automation/loops?view=all");
    render(<WorkspaceApp />);

    await user.click(await screen.findByRole("button", { name: "+ Add loop" }));
    expect(await screen.findByRole("button", { name: "Add first step" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input, init]) => String(input) === "/api/automation" && init?.method === "PUT")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Add first step" }));
    const firstStep = await screen.findByRole("button", { name: "Edit step new-step" });
    expect(firstStep).toHaveAttribute("data-loop-node-style", "flat");
    expect(firstStep).toHaveAttribute("data-loop-node-size", "medium");
    expect(screen.getByRole("region", { name: "Loop canvas workspace" })).toHaveClass("md:grid-cols-2");
    expect(screen.getByRole("dialog", { name: "Loop definition" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save loop" })).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([input, init]) => String(input) === "/api/automation" && init?.method === "PUT")).toHaveLength(0);

    await user.type(screen.getByLabelText("Loop ID"), "new-loop");
    expect(screen.getByRole("button", { name: "Save loop" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save loop" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/automation",
      expect.objectContaining({ method: "PUT", body: expect.any(String) })
    ));
    const saveCall = fetchMock.mock.calls.find(([input, init]) => String(input) === "/api/automation" && init?.method === "PUT");
    const saved = JSON.parse(String(saveCall?.[1]?.body));
    expect(saved.version).toBe(8);
    expect(saved.loops.find((candidate: ProjectLoop) => candidate.id === "new-loop")).toMatchObject({
      id: "new-loop",
      start: "new-step",
      nodes: expect.arrayContaining([expect.objectContaining({
        id: "new-step",
        type: "human",
        nodeStyle: "flat",
        nodeSize: "medium",
        on: { approved: "completed", rejected: "blocked" }
      }), ...defaultTerminalNodes()])
    });
  });

  it("cancels the active loop run from Run mode", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderRun(run("running"));
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toBeEnabled());
    await user.click(cancel);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/runs/run-1/cancel",
      expect.objectContaining({ method: "POST" })
    ), { timeout: 3_000 });
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
