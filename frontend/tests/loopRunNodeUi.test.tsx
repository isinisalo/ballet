import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LoopNodeContext } from "../src/workspace/automation/loops/LoopCanvasTypes";
import { LoopCompactStepNode } from "../src/workspace/automation/loops/LoopCompactStepNode";
import type { LoopStepRecord } from "../src/workspace/automation/loops/loopGraph";
import { loopThemes } from "../src/workspace/automation/loops/loopTheme";

const context = (): LoopNodeContext => ({
  selectedLoopId: "delivery",
  theme: loopThemes["open-ai"],
  stepByKey: new Map(),
  draggedStepIndex: null,
  dragOverStepIndex: null,
  selectedStepIndexes: [],
  readOnly: true,
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
});

const record = (kind: "agent" | "human", status: "running" | "waiting_for_human"): LoopStepRecord => {
  const id = kind === "agent" ? "implement" : "approve";
  const step = kind === "agent"
    ? { id, type: "agent" as const, nodeSize: "medium" as const, agentId: "developer", description: "Implement.", on: { approved: { end: "completed" as const }, rejected: { end: "failed" as const } } }
    : { id, type: "human" as const, nodeSize: "small" as const, description: "Approve.", on: { approved: { end: "completed" as const }, rejected: { end: "failed" as const } } };
  return {
    stepKey: `delivery::${id}`,
    loopId: "delivery",
    index: 0,
    step: {
      id: `delivery::${id}`,
      displayId: id,
      description: step.description,
      agentId: kind === "agent" ? "developer" : undefined,
      humanGate: kind === "human",
      nodeSize: kind === "agent" ? "medium" : "small",
      step,
      stepRun: {
        stepRunId: `step-${id}`,
        runId: "root-1",
        loopId: "delivery",
        stepId: id,
        type: kind,
        agentId: kind === "agent" ? "developer" : undefined,
        status,
        attempt: 1,
        createdAt: "2026-07-11T10:00:00.000Z",
        updatedAt: "2026-07-11T10:00:00.000Z"
      }
    }
  };
};
