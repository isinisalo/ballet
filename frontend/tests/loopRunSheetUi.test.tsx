import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultAgentStepTransitions, type Agent, type ExecutionTask, type ProjectStep, type StepRun } from "@shared/api/workspace-contracts";
import { LoopRunStepInstructions, LoopRunStepOutput } from "../src/workspace/automation/loops/LoopRunStepSheet";

const agentStep: ProjectStep = {
  id: "implement",
  type: "agent",
  nodeStyle: "terra",
  nodeSize: "medium",
  agentId: "developer",
  description: "Implement.",
  on: defaultAgentStepTransitions()
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

  it("shows structured agent output and replaces the console with human response controls", () => {
    const agentRun: StepRun = {
      stepRunId: "step-agent",
      runId: "root-1",
      loopId: "delivery",
      stepId: "implement",
      type: "agent",
      agentId: "developer",
      status: "completed",
      outcome: { outcome: "ready", summary: "Implementation verified.", checks: [{ name: "lint", status: "passed" }] },
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
      on: { approved: { action: "goto", target: "completed", input: "append-signal" }, rejected: { action: "goto", target: "failed", input: "append-signal" } }
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
    view.rerender(<LoopRunStepOutput step={humanStep} stepRun={humanRun} pending={false} onTerminal={vi.fn()} onRespond={vi.fn()} />);
    expect(screen.getByLabelText("Response")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approved" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejected" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/CLI console/)).not.toBeInTheDocument();
  });

  it("uses the same resume control when a human decision resolves to wait", async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn().mockResolvedValue(true);
    const humanStep: ProjectStep = {
      id: "approve",
      type: "human",
      nodeStyle: "luna",
      nodeSize: "tiny",
      description: "Approve.",
      on: {
        approved: { action: "wait", resume: { target: "implement" }, input: "append-signal" },
        rejected: { action: "terminate", status: "blocked" }
      }
    };
    const humanWait: StepRun = {
      stepRunId: "step-human-wait",
      runId: "root-1",
      loopId: "delivery",
      stepId: "approve",
      type: "human",
      status: "waiting_for_human",
      responseInput: "Approved pending confirmation.",
      result: { kind: "human", decision: "approved" },
      transition: {
        version: 1,
        signal: { kind: "human", decision: "approved" },
        action: "wait",
        resume: { target: "implement" },
        input: "append-signal"
      },
      attempt: 1,
      createdAt: "2026-07-11T10:01:00.000Z",
      updatedAt: "2026-07-11T10:01:00.000Z"
    };
    render(<LoopRunStepOutput
      step={humanStep}
      stepRun={humanWait}
      pending={false}
      onTerminal={vi.fn()}
      onRespond={onRespond}
    />);

    expect(screen.queryByRole("button", { name: "Approved" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Resume input"), "Confirmation received.");
    await user.click(screen.getByRole("button", { name: "Resume step" }));
    expect(onRespond).toHaveBeenCalledWith("step-human-wait", {
      kind: "resume",
      input: "Confirmation received."
    });
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
