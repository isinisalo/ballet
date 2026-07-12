import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentRunPane } from "../src/workspace/agents/execution/AgentRunPane";
import { agentRootRun, executionTask, now } from "./runtimeFixtures";

describe("direct agent Run UI", () => {
  it("starts and cancels through the unified root Run API", async () => {
    const user = userEvent.setup();
    let current = agentRootRun();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/runs" && init?.method === "POST") return Response.json(current);
      if (url === "/api/execution-tasks/task-1/events?after=0&limit=500") return Response.json({ entries: [], lastId: 0, hasMore: false, truncated: false });
      if (url === "/api/runs/run-1/cancel" && init?.method === "POST") {
        current = agentRootRun({ status: "cancelled", completedAt: now, tasks: [executionTask({ status: "cancelled", completedAt: now })] });
        return Response.json(current);
      }
      return Response.json({ error: `Unhandled ${init?.method ?? "GET"} ${url}` }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentRunPane agentId="agent-1" />);

    const runInput = screen.getByLabelText("Run input (optional)");
    await user.type(runInput, "Review the change");
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/runs", expect.objectContaining({ method: "POST", body: JSON.stringify({ kind: "agent", targetId: "agent-1", input: "Review the change" }) })));
    expect(await screen.findByText("run-1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "New run" })).toBeInTheDocument();
  });

  it("shows immutable snapshot, outcome, branch and diff", () => {
    const outcome = { outcome: "ready" as const, summary: "Implemented and verified the change.", artifacts: { changed_files: ["frontend/src/App.tsx"], diff: "+export const ready = true;" }, checks: [{ name: "lint", status: "passed" as const }] };
    const completed = agentRootRun({
      status: "completed",
      outcome,
      completedAt: now,
      tasks: [executionTask({ status: "succeeded", outcome, completedAt: now })],
      finalization: { status: "completed", success: true, startedAt: now, completedAt: now, report: { success: true, retained: false, branch: "codex/review", worktreePath: "/workspace/ballet/.git/ballet/worktrees/run-1", changedFiles: ["frontend/src/App.tsx"], snapshotHash: "s".repeat(64) } }
    });
    render(<AgentRunPane agentId="agent-1" rootDetail={completed} disabledReason="Run already completed." />);

    expect(screen.getAllByText("Immutable snapshot")).toHaveLength(2);
    expect(screen.getByText("Follow the immutable review instructions.")).toBeInTheDocument();
    expect(screen.getByText("Implemented and verified the change.")).toBeInTheDocument();
    expect(screen.getByText("codex/review")).toBeInTheDocument();
    expect(screen.getByText("+export const ready = true;")).toBeInTheDocument();
  });

  it("links a blocked Run to Runtimes", () => {
    render(<AgentRunPane agentId="agent-1" disabledReason="Codex CLI is offline." />);
    expect(screen.getByText("Codex CLI is offline.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Runtimes" })).toHaveAttribute("href", "/runtimes");
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });
});
