import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppData, LoopRunDetails, ProjectLoop } from "@shared/api/workspace-contracts";
import { WorkspaceApp } from "../src/WorkspaceApp";

const now = "2026-07-10T10:00:00.000Z";
const loop: ProjectLoop = {
  id: "delivery",
  start: "approval",
  steps: [{ id: "approval", type: "human", description: "Approve delivery", on: { approved: { end: "completed" }, rejected: { end: "failed" } } }]
};

const run = (status: LoopRunDetails["status"]): LoopRunDetails => ({
  runId: "run-1", loopId: loop.id, rootRunId: "run-1", source: "manual", status, snapshot: loop,
  transitionCount: 0, createdAt: now, updatedAt: now,
  stepRuns: status === "waiting_for_human" ? [{
    stepRunId: "step-run-1", runId: "run-1", loopId: loop.id, stepId: "approval", type: "human",
    status: "waiting_for_human", attempt: 1, createdAt: now, updatedAt: now
  }] : []
});

const data = (): AppData => ({
  projects: [], goals: [], adrs: [], agents: [], skills: [], policies: [], eventDefinitions: [], events: [], loopRuns: [],
  automation: { version: 3, loops: [loop] }, automationIssues: [], projectDocumentTree: []
});

function installApi(latest: LoopRunDetails | null) {
  const workspace = data();
  let current = latest;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/admin/status") {
      return Response.json({ bootstrapped: true, authenticated: true, csrfToken: "test-csrf-token" });
    }
    if (url === "/api/data") return Response.json(workspace);
    if (url === "/api/loops/delivery/preflight") {
      return Response.json({ ok: true, issues: [], snapshots: [] });
    }
    if (url.endsWith("/runs/latest")) return Response.json(current);
    if (url.endsWith("/runs") && method === "POST") {
      current = run("running");
      return Response.json(current);
    }
    if (url.endsWith("/respond") && method === "POST") {
      current = run("completed");
      return Response.json(current);
    }
    if (url.endsWith("/cancel") && method === "POST") {
      current = run("cancelled");
      return Response.json(current);
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
  window.history.pushState({}, "", "/automation/loops?id=delivery&mode=run");
  render(<WorkspaceApp />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/loops/delivery/runs/latest", expect.anything()));
  return fetchMock;
}

describe("automation v3 UI", () => {
  it("persists Edit and Run mode in the URL and manually starts a saved loop", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderRun(null);
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    const manualInput = screen.getByLabelText("Manual input (optional)");
    await waitFor(() => expect(manualInput).toBeEnabled());
    await user.type(manualInput, "Ship release");
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/loops/delivery/runs", expect.objectContaining({ method: "POST", body: JSON.stringify({ input: "Ship release" }) })));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(window.location.search).toBe("?id=delivery");
  });

  it("requires human input, responds directly to a step run, and locks editing while active", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderRun(run("waiting_for_human"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByText(/Editing is locked/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save loop" })).toBeDisabled();
    expect(screen.getByLabelText("Edit loop canvas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run" }));
    const approved = await screen.findByRole("button", { name: "Approved" });
    expect(approved).toBeDisabled();
    await user.type(screen.getByLabelText("Response"), "Looks good");
    await user.click(approved);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/loop-runs/run-1/steps/step-run-1/respond", expect.objectContaining({ method: "POST" })));
  });

  it("offers a new run after the latest run has finished", async () => {
    const user = userEvent.setup();
    await renderRun(run("completed"));
    await user.click(await screen.findByRole("button", { name: "New run" }));
    expect(screen.getByLabelText("Manual input (optional)")).toBeEnabled();
  });

  it("cancels the active loop run from Run mode", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderRun(run("running"));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/loop-runs/run-1/cancel",
      expect.objectContaining({ method: "POST" })
    ));
  });
});
