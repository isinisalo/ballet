import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentExecutionModeSwitch } from "../src/workspace/agents/execution/AgentExecutionModeSwitch";
import { AgentRunPane } from "../src/workspace/agents/execution/AgentRunPane";
import { agentRun, now, runtimeDevice } from "./runtimeFixtures";

describe("direct agent run UI", () => {
  it("starts and cancels a direct agent run", async () => {
    const user = userEvent.setup();
    const device = runtimeDevice();
    let current = null as ReturnType<typeof agentRun> | null;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/runtimes/devices") return Response.json({ devices: [device] });
      if (url === "/api/agents/agent-1/execution-binding") return Response.json({ id: "binding-1", projectId: "project-1", agentId: "agent-1", runtimeBackendId: "backend-codex", deviceId: "device-1", provider: "codex", model: "gpt-test", reasoning: "high", policy: { network: false, readOnlyRoots: [] }, createdAt: now, updatedAt: now });
      if (url === "/api/agents/agent-1/runs/latest") return Response.json(current);
      if (url === "/api/agents/agent-1/runs" && init?.method === "POST") { current = agentRun({ input: "Review the change" }); return Response.json(current); }
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
      if (url === "/api/execution-tasks/task-1/events?after=0&limit=500") return Response.json({ entries: [], lastId: 0, hasMore: false, truncated: false });
      return Response.json({ error: `Unhandled GET ${url}` }, { status: 404 });
    }));
    render(<AgentRunPane agentId="agent-1" disabledReason="Run already completed." />);
    expect(await screen.findByText("Immutable snapshot")).toBeInTheDocument();
    expect(screen.getByText("Implemented and verified the change.")).toBeInTheDocument();
    expect(screen.getByText("codex/review")).toBeInTheDocument();
    expect(screen.getByText("+export const ready = true;")).toBeInTheDocument();
  });

  it("keeps Run mode accessible and links a blocked run to Runtimes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const mode = render(<AgentExecutionModeSwitch mode="edit" runDisabledReason="Runtime is offline." onChange={onChange} />);
    const runTab = screen.getByRole("button", { name: "Run" });
    expect(runTab).toBeEnabled();
    await user.click(runTab);
    expect(onChange).toHaveBeenCalledWith("run");
    mode.unmount();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(null)));
    render(<AgentRunPane agentId="agent-1" disabledReason="Runtime is offline." />);
    expect(await screen.findByText("Runtime is offline.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Runtimes" })).toHaveAttribute("href", "/runtimes");
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });
});
