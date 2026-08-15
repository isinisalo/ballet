import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  type ExecutionProfile,
  type ExecutionProjectSnapshot,
  type ExecutionRuntimeSnapshot,
  type ExecutionTask,
  type ProjectStep,
  type RootRunDetail,
  type StepRun
} from "@shared/api/workspace-contracts";
import { LoopRunStepComposition, LoopRunStepOutput } from "../src/workspace/automation/loops/LoopRunStepSheet";

type ExecutionResourceSnapshot = RootRunDetail["executionSnapshot"]["resources"][number];

const executionProfile: ExecutionProfile = {
  id: "codex-test-high",
  name: "Codex test · High",
  provider: "codex",
  model: "gpt-5",
  reasoningEffort: "high",
  networkAccess: false
};

const agentStep: ProjectStep = {
  id: "implement",
  type: "agent",
  executionProfileId: executionProfile.id,
  primaryInstructionId: "project:developer",
  skillIds: ["project:review"],
  nodeStyle: "terra",
  nodeSize: "medium",
  description: "Implement.",
  on: { approved: "completed", rejected: "failed" }
};

describe("Loop Run composition", () => {
  it("renders task evidence using immutable Root Run resource content", () => {
    const task = taskSnapshot();
    const capturedProfile = {
      ...executionProfile,
      name: "Attempt-captured profile",
      model: "gpt-5-task-snapshot",
      reasoningEffort: "max",
      networkAccess: true
    };
    task.spec.evidence.executionProfile = capturedProfile;
    render(<LoopRunStepComposition step={agentStep} rootDetail={rootDetailSnapshot()} task={task} />);

    expect(screen.getByText("Immutable composition")).toBeInTheDocument();
    expect(screen.getByText("Immutable instructions")).toBeInTheDocument();
    expect(screen.getByText("Review workflow")).toBeInTheDocument();
    expect(screen.getByText(`profile · ${executionProfile.id}`)).toBeInTheDocument();
    expect(screen.getByText(`Prompt SHA-256 · ${"e".repeat(64)}`)).toBeInTheDocument();
    expect(screen.getByText("Output schema version · 1")).toBeInTheDocument();
    expect(screen.getByText(`Output schema SHA-256 · ${"f".repeat(64)}`)).toBeInTheDocument();
    const profileSnapshot = screen.getByRole("region", { name: "Captured ExecutionProfile" });
    for (const value of [
      capturedProfile.id,
      capturedProfile.name,
      capturedProfile.provider,
      capturedProfile.model,
      capturedProfile.reasoningEffort,
      "Enabled"
    ]) expect(within(profileSnapshot).getByText(value)).toBeInTheDocument();
    expect(within(profileSnapshot).queryByText(executionProfile.name)).not.toBeInTheDocument();
    expect(screen.queryByText(task.spec.evidence.prompt)).not.toBeInTheDocument();
  });

  it("uses the immutable Root Run snapshot before a Step task has been attached", () => {
    render(<LoopRunStepComposition step={agentStep} rootDetail={rootDetailSnapshot()} />);

    expect(screen.getByText("Immutable instructions")).toBeInTheDocument();
    expect(screen.getByText("Review workflow")).toBeInTheDocument();
    const profileSnapshot = screen.getByRole("region", { name: "Captured ExecutionProfile" });
    expect(within(profileSnapshot).getByText(executionProfile.name)).toBeInTheDocument();
    expect(within(profileSnapshot).getByText(executionProfile.model)).toBeInTheDocument();
    expect(screen.getByText("Prompt SHA-256 · Unavailable until an execution attempt is created")).toBeInTheDocument();
    expect(screen.getByText("Output schema version · Unavailable until an execution attempt is created")).toBeInTheDocument();
    expect(screen.getByText("Output schema SHA-256 · Unavailable until an execution attempt is created")).toBeInTheDocument();
  });
});

describe("Loop Run sheet", () => {
  it("shows structured agent output and requires an explicit human transition choice", async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn(async () => true);
    const agentRun: StepRun = {
      stepRunId: "step-agent",
      runId: "root-1",
      loopId: "delivery",
      stepId: "implement",
      type: "agent",
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

const runtimeSnapshot: ExecutionRuntimeSnapshot = {
  hostname: "Studio Mac",
  provider: "codex",
  cliVersion: "1.0.0",
  model: "gpt-5",
  reasoning: "high",
  policy: { network: false, readOnlyRoots: [] },
  capabilityHash: "b".repeat(64)
};
const projectSnapshot: ExecutionProjectSnapshot = {
  checkoutRoot: "/workspace/ballet",
  headSha: "c".repeat(40),
  configHash: "d".repeat(64),
  snapshotHash: "d".repeat(64)
};
const resourceSnapshots: ExecutionResourceSnapshot[] = [{
  kind: "system",
  origin: "system",
  id: "system:execution-contract-v1",
  sourceSha256: "1".repeat(64),
  content: "# System baseline"
}, {
  kind: "primary",
  origin: "project",
  id: agentStep.primaryInstructionId,
  relativePath: ".ballet/instructions/developer.md",
  sourceSha256: "2".repeat(64),
  content: "# Immutable instructions"
}, {
  kind: "skill",
  origin: "project",
  id: agentStep.skillIds[0]!,
  relativePath: ".agents/skills/review/SKILL.md",
  sourceSha256: "3".repeat(64),
  content: "# Review workflow"
}];

const taskSnapshot = (): ExecutionTask => ({
  id: "task-1",
  kind: "loop_step",
  rootRunId: "root-1",
  status: "running",
  createdAt: "2026-07-11T10:00:00.000Z",
  updatedAt: "2026-07-11T10:00:00.000Z",
  spec: {
    version: 2,
    taskId: "task-1",
    kind: "loop_step",
    rootRunId: "root-1",
    loopRunId: "root-1",
    stepRunId: "step-agent",
    evidence: {
      compositionVersion: 1,
      loopId: "delivery",
      stepId: agentStep.id,
      executionProfile,
      resources: resourceSnapshots.map(({ kind, origin, id, relativePath, sourceSha256 }) => ({
        kind,
        origin,
        id,
        relativePath,
        sourceSha256
      })),
      prompt: "# System\n\n# Primary\n\n# Skill\n\n# Task",
      promptSha256: "e".repeat(64),
      outputSchemaVersion: 1,
      outputSchemaSha256: "f".repeat(64)
    },
    runtime: runtimeSnapshot,
    project: projectSnapshot,
    createdAt: "2026-07-11T10:00:00.000Z"
  }
});

const rootDetailSnapshot = (): RootRunDetail => ({
  rootRunId: "root-1",
  kind: "loop",
  targetId: "delivery",
  source: "manual",
  status: "running",
  createdAt: "2026-07-11T10:00:00.000Z",
  updatedAt: "2026-07-11T10:00:00.000Z",
  executionSnapshot: {
    version: 1,
    rootLoopId: "delivery",
    project: projectSnapshot,
    loops: [{ id: "delivery", start: agentStep.id, nodes: [agentStep] }],
    theme: defaultLoopTheme,
    executionProfiles: [executionProfile],
    runtimes: [{ executionProfileId: executionProfile.id, runtime: runtimeSnapshot }],
    resources: resourceSnapshots,
    createdAt: "2026-07-11T10:00:00.000Z"
  },
  loopRuns: [],
  tasks: []
});
