import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LoopRunDetails, StepRun } from "@shared/api/workspace-contracts";
import { CodexRunConsole } from "../src/workspace/automation/loops/CodexRunConsole";

const now = "2026-07-10T10:00:00.000Z";
const stepRun: StepRun = {
  stepRunId: "step-run-1",
  runId: "run-1",
  loopId: "delivery",
  stepId: "implement",
  type: "agent",
  agentId: "developer-agent",
  status: "completed",
  result: "approved",
  attempt: 1,
  createdAt: now,
  updatedAt: now,
  completedAt: now
};
const run: LoopRunDetails = {
  runId: "run-1",
  loopId: "delivery",
  rootRunId: "run-1",
  source: "manual",
  status: "completed",
  snapshot: {
    id: "delivery",
    start: "implement",
    steps: [{ id: "implement", type: "agent", agentId: "developer-agent", description: "Implement", on: { approved: { end: "completed" }, rejected: { end: "failed" } } }]
  },
  transitionCount: 1,
  createdAt: now,
  updatedAt: now,
  completedAt: now,
  stepRuns: [stepRun]
};

describe("Codex Run Console", () => {
  it("renders persisted structured command output", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      entries: [{
        id: 1,
        stepRunId: stepRun.stepRunId,
        source: "codex",
        kind: "command",
        level: "info",
        phase: "started",
        itemId: "cmd-1",
        message: "npm test",
        contentBytes: 8,
        terminal: false,
        createdAt: now
      }],
      lastId: 1,
      hasMore: false,
      truncated: false
    })));
    render(<CodexRunConsole run={run} stepRun={stepRun} onRun={() => undefined} />);
    expect(await screen.findByText("npm test")).toBeInTheDocument();
    expect(screen.getByText("CMD")).toBeInTheDocument();
    expect(screen.getByText("CODEX RUNTIME CONSOLE")).toBeInTheDocument();
  });

  it("merges adjacent deltas and pauses auto-follow when the operator scrolls up", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      entries: ["npm ", "test"].map((message, index) => ({
        id: index + 1,
        stepRunId: stepRun.stepRunId,
        source: "codex",
        kind: "output",
        level: "info",
        phase: "delta",
        itemId: "cmd-1",
        message,
        contentBytes: message.length,
        terminal: false,
        createdAt: now
      })),
      lastId: 2,
      hasMore: false,
      truncated: false
    })));
    render(<CodexRunConsole run={run} stepRun={stepRun} onRun={() => undefined} />);
    expect(await screen.findByText("npm test")).toBeInTheDocument();

    const viewport = screen.getByLabelText("Codex runtime console").querySelector(".overflow-auto") as HTMLDivElement;
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, writable: true, value: 100 }
    });
    fireEvent.scroll(viewport);
    const follow = screen.getByRole("button", { name: "Follow latest output" });
    expect(follow).toBeInTheDocument();
    await user.click(follow);
    expect(screen.queryByRole("button", { name: "Follow latest output" })).not.toBeInTheDocument();
  });
});
