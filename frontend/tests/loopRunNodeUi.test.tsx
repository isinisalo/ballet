import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultLoopTheme, loopNodeStyles, type ProjectStep, type StepRun } from "@shared/api/workspace-contracts";
import { describe, expect, it, vi } from "vitest";
import type { LoopNodeContext } from "../src/workspace/automation/loops/LoopCanvasTypes";
import { LoopCompactStepNode } from "../src/workspace/automation/loops/LoopCompactStepNode";
import { LoopNodeArtwork } from "../src/workspace/automation/loops/LoopNodeArtwork";
import { LoopTerminalNode } from "../src/workspace/automation/loops/LoopTerminalNode";
import type { LoopStepRecord } from "../src/workspace/automation/loops/loopGraph";

const context = (): LoopNodeContext => ({
  selectedLoopId: "delivery",
  theme: defaultLoopTheme,
  stepByKey: new Map(),
  draggedStepIndex: null,
  dragOverStepIndex: null,
  selectedStepIndexes: [],
  readOnly: true,
  staticPreview: false,
  canAddFirstStep: false,
  canAddStepForEvent: () => false,
  onStepPointerDown: vi.fn(),
  onStepPointerMove: vi.fn(),
  onStepPointerUp: vi.fn(() => false),
  onStepPointerCancel: vi.fn(),
  onStepSelect: vi.fn(),
  onOutputHandlerSelect: vi.fn(),
  onAddStep: vi.fn()
});

describe("Ballet Run node state", () => {
  it("marks a running agent with Emerald pulse and a human wait with Amber pulse", () => {
    const running = record("agent", "running");
    const view = render(<LoopCompactStepNode context={context()} record={running} />);
    const agent = screen.getByRole("button", { name: "View step implement" });
    expect(agent).toHaveClass("loop-run-node-pulse--running");
    expect(agent).toHaveAttribute("data-loop-run-status", "running");

    view.rerender(<LoopCompactStepNode context={context()} record={record("human", "waiting_for_human")} />);
    const human = screen.getByRole("button", { name: "View step approve" });
    expect(human).toHaveClass("loop-run-node-pulse--waiting");
    expect(human).toHaveAttribute("data-loop-run-status", "waiting_for_human");
  });

  it("keeps the scheduled mark while applying its selected agent reasoning glow", () => {
    const scheduled = record("scheduled", "running");
    render(<LoopCompactStepNode context={context()} record={scheduled} />);

    const node = screen.getByRole("button", { name: "View step deploy" });
    expect(node).toHaveAttribute("data-loop-node-kind", "scheduled");
    expect(node).toHaveAttribute("data-loop-node-style", "luna");
    expect(node).toHaveAttribute("data-loop-node-size", "tiny");
    expect(node).toHaveAttribute("data-loop-reasoning-effort", "high");
    expect(node).toHaveAttribute("data-loop-reasoning-glow", "4");
    expect(node.querySelector(".lucide-calendar-clock")).toBeInTheDocument();
    expect(node.querySelector(".loop-agent-avatar")).not.toBeInTheDocument();
    expect(screen.getByText("Weekdays · 09:00 · Europe/Helsinki")).toBeInTheDocument();
  });
});

describe("Loop node artwork", () => {
  it("renders every fixed code-native node style", () => {
    const { container } = render(<>{loopNodeStyles.map((nodeStyle) => <LoopNodeArtwork key={nodeStyle} nodeStyle={nodeStyle} />)}</>);

    loopNodeStyles.forEach((nodeStyle) => {
      expect(container.querySelector(`[data-loop-node-artwork='${nodeStyle}']`)).toBeInTheDocument();
    });
    expect(container.querySelectorAll("svg.loop-node-artwork-svg")).toHaveLength(4);
  });
});

describe("semantic terminal nodes", () => {
  it("renders completed, blocked, and failed as exact accessible statuses", () => {
    render(<>
      <LoopTerminalNode status="completed" />
      <LoopTerminalNode status="blocked" />
      <LoopTerminalNode status="failed" />
    </>);

    expect(screen.getByRole("img", { name: "Terminal target: completed" })).toHaveAttribute("data-loop-terminal-status", "completed");
    expect(screen.getByRole("img", { name: "Terminal target: blocked" })).toHaveClass("text-tertiary");
    expect(screen.getByRole("img", { name: "Terminal target: failed" })).toHaveClass("text-destructive");
  });

  it("keeps a configured terminal clickable as an insertion point", async () => {
    const onClick = vi.fn();
    render(<LoopTerminalNode status="blocked" interactive onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Add step before blocked" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

const record = (
  kind: "agent" | "human" | "scheduled",
  status: "running" | "waiting_for_human"
): LoopStepRecord => {
  const id = kind === "agent" ? "implement" : kind === "human" ? "approve" : "deploy";
  const on = { approved: { end: "completed" as const }, rejected: { end: "blocked" as const } };
  const step: ProjectStep = kind === "agent"
    ? { id, type: "agent", nodeStyle: "flat", agentId: "developer", description: "Implement.", on }
    : kind === "human"
      ? { id, type: "human", nodeStyle: "mars", description: "Approve.", on }
      : {
          id,
          type: "scheduled",
          nodeStyle: "luna",
          agentId: "developer",
          description: "Deploy.",
          schedule: { kind: "recurring", cadence: "weekdays", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki" },
          on
        };
  const stepRun: StepRun = {
    stepRunId: `step-${id}`,
    runId: "root-1",
    loopId: "delivery",
    stepId: id,
    type: kind === "human" ? "human" : "agent",
    agentId: kind === "human" ? undefined : "developer",
    status,
    attempt: 1,
    createdAt: "2026-07-11T10:00:00.000Z",
    updatedAt: "2026-07-11T10:00:00.000Z"
  };

  return {
    stepKey: `delivery::${id}`,
    loopId: "delivery",
    index: 0,
    step: {
      id: `delivery::${id}`,
      displayId: id,
      description: step.description,
      agentId: kind === "human" ? undefined : "developer",
      humanGate: kind === "human",
      scheduled: kind === "scheduled",
      scheduleLabel: kind === "scheduled" ? "Weekdays · 09:00 · Europe/Helsinki" : undefined,
      nodeStyle: step.nodeStyle,
      reasoningEffort: kind === "scheduled" ? "high" : undefined,
      step,
      stepRun
    }
  };
};
