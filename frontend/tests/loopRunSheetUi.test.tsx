import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Agent, ExecutionTask, ProjectStep, StepRun } from "@shared/api/workspace-contracts";
import { LoopRunStepInstructions, LoopRunStepOutput } from "../src/workspace/automation/loops/LoopRunStepSheet";

const agentStep: ProjectStep = {
  id: "implement",
  type: "agent",
  nodeStyle: "terra",
  nodeSize: "medium",
  agentId: "developer",
  description: "Implement.",
  on: { approved: "completed", rejected: "failed" }
};

describe("Loop Run sheet", () => {
  it("renders immutable task instructions instead of the mutable agent definition", () => {
    const agents = [{ id: "developer", name: "Live developer", instructions: "Mutable instructions", enabled: true }] as Agent[];
    render(<LoopRunStepInstructions step={agentStep} agents={agents} task={taskSnapshot()} />);

    expect(screen.getByText("Immutable Run snapshot")).toBeInTheDocument();
    expect(screen.getByText("Immutable instructions")).toBeInTheDocument();
    expect(screen.queryByText("Mutable instructions")).not.toBeInTheDocument();
  });

  it("uses the immutable Loop execution plan before a Step task has been attached", () => {
    const agents = [{ id: "developer", name: "Live developer", instructions: "Mutable instructions", enabled: true }] as Agent[];
    render(<LoopRunStepInstructions step={agentStep} agents={agents} snapshot={taskSnapshot().spec.agent} />);

    expect(screen.getByText("Immutable instructions")).toBeInTheDocument();
    expect(screen.queryByText("Mutable instructions")).not.toBeInTheDocument();
  });

  it("shows structured agent output and requires an explicit human transition choice", async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn(async () => true);
    const agentRun: StepRun = {
      stepRunId: "step-agent",
      runId: "root-1",
      loopId: "delivery",
      stepId: "implement",
      type: "agent",
      agentId: "developer",
      status: "completed",
      result: "approved",
      outcome: { state: "completed", result: "approved", summary: "Implementation verified.", checks: [{ name: "lint", status: "passed" }] },
      attempt: 1,
      createdAt: "2026-07-11T10:00:00.000Z",
      updatedAt: "2026-07-11T10:01:00.000Z",
      completedAt: "2026-07-11T10:01:00.000Z"
    };
    const view = render(<LoopRunStepOutput step={agentStep} stepRun={agentRun} pending={false} onTerminal={vi.fn()} onRespond={vi.fn()} />);
    expect(screen.getByText("Structured outcome")).toBeInTheDocument();
    expect(screen.getByText("Implementation verified.")).toBeInTheDocument();

    const humanStep: ProjectStep = {
      id: "approve",
      type: "human",
      nodeStyle: "luna",
      nodeSize: "tiny",
      description: "Approve.",
      on: { approved: "completed", rejected: "failed" }
    };
    const humanRun: StepRun = {
      stepRunId: "step-human",
      runId: "root-1",
      loopId: "delivery",
      stepId: "approve",
      type: "human",
      status: "waiting_for_human",
      attempt: 1,
      createdAt: "2026-07-11T10:01:00.000Z",
      updatedAt: "2026-07-11T10:01:00.000Z"
    };
    view.rerender(<LoopRunStepOutput step={humanStep} stepRun={humanRun} pending={false} onTerminal={vi.fn()} onRespond={onRespond} />);
    expect(screen.getByLabelText("Response")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approved" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejected" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/CLI console/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Response"), "Approved by the operator.{enter}");
    expect(onRespond).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Approved" }));
    expect(onRespond).toHaveBeenCalledWith("step-human", { kind: "human", result: "approved", input: "Approved by the operator.\n" });
  });

  it("shows a durable agent question and resumes the same Step without a transition result", async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn(async () => true);
    const needsInput: StepRun = {
      stepRunId: "step-agent",
      runId: "root-1",
      loopId: "delivery",
      stepId: "implement",
      type: "agent",
      agentId: "developer",
      status: "needs_input",
      outcome: {
        state: "needs_input",
        question: "Which database should I use?",
        context: "The repository supports SQLite and Postgres.",
        summary: "A storage decision is required.",
        checks: []
      },
      attempt: 1,
      createdAt: "2026-07-11T10:00:00.000Z",
      updatedAt: "2026-07-11T10:01:00.000Z"
    };

    render(<LoopRunStepOutput step={agentStep} stepRun={needsInput} pending={false} onTerminal={vi.fn()} onRespond={onRespond} />);

    expect(screen.getByText("Which database should I use?")).toBeInTheDocument();
    expect(screen.getByText("The repository supports SQLite and Postgres.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approved" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Response"), "Use SQLite.");
    await user.click(screen.getByRole("button", { name: "Continue step" }));
    expect(onRespond).toHaveBeenCalledWith("step-agent", { kind: "resume", input: "Use SQLite." });
  });

  it("shows the blocker reason without fabricating a rejected transition", () => {
    const blocked: StepRun = {
      stepRunId: "step-agent",
      runId: "root-1",
      loopId: "delivery",
      stepId: "implement",
      type: "agent",
      agentId: "developer",
      status: "blocked",
      outcome: { state: "blocked", summary: "Access to the signing key is unavailable.", checks: [] },
      attempt: 1,
      createdAt: "2026-07-11T10:00:00.000Z",
      updatedAt: "2026-07-11T10:01:00.000Z",
      completedAt: "2026-07-11T10:01:00.000Z"
    };

    render(<LoopRunStepOutput step={agentStep} stepRun={blocked} pending={false} onTerminal={vi.fn()} onRespond={vi.fn()} />);

    expect(screen.getByText("Access to the signing key is unavailable.")).toBeInTheDocument();
    expect(screen.getByText("blocked")).toBeInTheDocument();
    expect(screen.getByText("Transition").nextElementSibling).toHaveTextContent("—");
  });
});

const taskSnapshot = () => ({
  id: "task-1",
  kind: "loop_step",
  rootRunId: "root-1",
  status: "running",
  createdAt: "2026-07-11T10:00:00.000Z",
  updatedAt: "2026-07-11T10:00:00.000Z",
  spec: {
    version: 1,
    taskId: "task-1",
    kind: "loop_step",
    rootRunId: "root-1",
    loopRunId: "root-1",
    stepRunId: "step-agent",
    agent: { id: "developer", name: "Snapshotted developer", description: "Snapshot.", instructions: "# Immutable instructions", skillIds: [], configHash: "a".repeat(64) },
    runtime: { hostname: "Studio Mac", provider: "codex", cliVersion: "1.0.0", model: "gpt-5", reasoning: "high", policy: { network: false, readOnlyRoots: [] }, capabilityHash: "b".repeat(64) },
    project: { checkoutRoot: "/workspace/ballet", headSha: "c".repeat(40), configHash: "d".repeat(64), snapshotHash: "d".repeat(64) },
    createdAt: "2026-07-11T10:00:00.000Z"
  }
}) as ExecutionTask;
