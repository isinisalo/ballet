import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentRunPane } from "../src/workspace/agents/execution/AgentRunPane";
import { agentRun, agentRuntimeConfiguration, runtimeDevice } from "./runtimeFixtures";

describe("direct agent run UI", () => {
  it("starts and cancels a direct agent run", async () => {
    const user = userEvent.setup();
    const device = runtimeDevice();
    let current = null as ReturnType<typeof agentRun> | null;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/runtimes/devices") return Response.json({ devices: [device] });
      if (url === "/api/agents/agent-1/runtime") return Response.json(agentRuntimeConfiguration());
      if (url === "/api/agents/agent-1/runs/latest") return Response.json(current);
      if (url === "/api/agents/agent-1/runs" && init?.method === "POST") { current = agentRun({ input: "Review the change" }); return Response.json(current); }
      if (url === "/api/runs/run-1" && current) return Response.json(rootDetail(current));
      if (url === "/api/execution-tasks/task-1/events?after=0&limit=500") return Response.json({ entries: [], lastId: 0, hasMore: false, truncated: false });
      if (url === "/api/agent-runs/run-1/cancel" && init?.method === "POST") { current = agentRun({ status: "cancelled" }); return Response.json(current); }
      return Response.json({ error: `Unhandled ${init?.method ?? "GET"} ${url}` }, { status: 404 });
    }));
    render(<AgentRunPane agentId="agent-1" />);

    const runInput = await screen.findByLabelText("Run input (optional)");
    await waitFor(() => expect(runInput).toBeEnabled());
    await user.type(runInput, "Review the change");
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByText("run-1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "New run" })).toBeInTheDocument();
  });

  it("shows immutable snapshot, outcome, branch and diff", async () => {
    const completed = agentRun({ status: "succeeded", branch: "codex/review", outcome: { outcome: "ready", summary: "Implemented and verified the change.", artifacts: { changed_files: ["frontend/src/App.tsx"], diff: "+export const ready = true;" }, checks: [{ name: "lint", status: "passed" }] } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/agents/agent-1/runs/latest") return Response.json(completed);
      if (url === "/api/runs/run-1") return Response.json(rootDetail(completed));
      if (url === "/api/execution-tasks/task-1/events?after=0&limit=500") return Response.json({ entries: [], lastId: 0, hasMore: false, truncated: false });
      return Response.json({ error: `Unhandled GET ${url}` }, { status: 404 });
    }));
    render(<AgentRunPane agentId="agent-1" disabledReason="Run already completed." />);
    expect(await screen.findByText("Immutable snapshot")).toBeInTheDocument();
    expect(screen.getByText("Follow the immutable review instructions.")).toBeInTheDocument();
    expect(screen.getByText("Implemented and verified the change.")).toBeInTheDocument();
    expect(screen.getByText("codex/review")).toBeInTheDocument();
    expect(screen.getByText("+export const ready = true;")).toBeInTheDocument();
  });

  it("links a blocked global Run view to Runtimes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(null)));
    render(<AgentRunPane agentId="agent-1" disabledReason="Runtime is offline." />);
    expect(await screen.findByText("Runtime is offline.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Runtimes" })).toHaveAttribute("href", "/runtimes");
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });
});

const rootDetail = (run: ReturnType<typeof agentRun>) => ({
  rootRunId: run.rootRunId,
  projectId: run.projectId,
  kind: "agent",
  targetId: run.agentId,
  source: run.source,
  status: run.status === "succeeded" ? "completed" : run.status,
  current: { taskId: run.taskId, agentId: run.agentId, taskStatus: run.status },
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  completedAt: run.completedAt,
  loopRuns: [],
  agentRun: run,
  tasks: [{
    id: run.taskId,
    projectId: run.projectId,
    runtimeBackendId: run.runtime.runtimeBackendId,
    deviceId: run.runtime.deviceId,
    kind: "agent_run",
    rootRunId: run.rootRunId,
    status: run.status,
    fencing: 1,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    spec: {
      version: 1,
      projectId: run.projectId,
      taskId: run.taskId,
      kind: "agent_run",
      rootRunId: run.rootRunId,
      agentRunId: run.id,
      agent: { id: run.agentId, name: "Immutable snapshot", description: "Review agent", instructions: "Follow the immutable review instructions.", skillIds: [], configHash: "a".repeat(64) },
      runtime: run.runtime,
      project: run.project,
      createdAt: run.createdAt
    }
  }]
});
