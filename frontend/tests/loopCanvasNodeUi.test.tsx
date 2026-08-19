import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultLoopTheme } from "@shared/api/workspace-contracts";
import { LoopNodeVisual, runCharacterMood } from "../src/workspace/automation/loops/LoopNodeVisual";
import type { LoopNodeContext } from "../src/workspace/automation/loops/LoopCanvasTypes";
import type { LoopNodeRecord } from "../src/workspace/automation/loops/loopGraph";
import { v11Loop } from "./v11Fixtures";

describe("single Loop canvas node visual", () => {
  it("renders one selectable Work-owned artwork without phase cards", () => {
    const onNodeSelect = vi.fn();
    const { container } = render(
      <LoopNodeVisual context={nodeContext({ selectedNodeIndexes: [0], onNodeSelect })} record={nodeRecord()} />
    );

    const node = screen.getByRole("button", { name: "Edit Work Loop Node work" });
    expect(node).toHaveAttribute("data-loop-node-kind", "work-loop-node");
    expect(node).toHaveAttribute("data-loop-node-style", "terra");
    expect(node).toHaveAttribute("data-loop-node-size", "medium");
    expect(node).toHaveAttribute("data-loop-reasoning-glow", "4");
    expect(node).toHaveAttribute("title", "work");
    expect(node).toHaveClass("border-primary/80");
    expect(container.querySelectorAll("[data-loop-node-kind='work-loop-node']")).toHaveLength(1);
    expect(container.querySelector("[data-active-node-role]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-loop-node-label='work']")).toHaveAttribute("title", "work");

    fireEvent.click(node);
    expect(onNodeSelect).toHaveBeenCalledOnce();
  });

  it("keeps Work appearance while showing active Validation and its reasoning glow", () => {
    const { container } = render(
      <LoopNodeVisual context={nodeContext({ readOnly: true })} record={nodeRecord("validation", "waiting_for_input")} />
    );

    const node = screen.getByRole("button", { name: "View Work Loop Node work, active validation" });
    expect(node).toHaveAttribute("data-loop-node-style", "terra");
    expect(node).toHaveAttribute("data-loop-node-size", "medium");
    expect(node).toHaveAttribute("data-loop-reasoning-glow", "2");
    expect(node).toHaveAttribute("data-loop-run-status", "waiting_for_input");
    expect(node).toHaveClass("loop-run-node-pulse--waiting");
    expect(screen.getByRole("img", { name: "Active Validation" })).toHaveAttribute("data-active-node-role", "validation");
    expect(container.querySelectorAll("[data-loop-node-artwork]")).toHaveLength(1);
    expect(container.querySelector("[data-run-character-mood='waiting']")).toBeInTheDocument();
  });

  it("derives character mood only from canonical Run status", () => {
    expect(runCharacterMood("running")).toBe("focused");
    expect(runCharacterMood("waiting_for_input")).toBe("waiting");
    expect(runCharacterMood("completed")).toBe("happy");
    expect(runCharacterMood("failed")).toBe("sad");
    expect(runCharacterMood()).toBe("quiet");
  });
});

function nodeContext(overrides: Partial<LoopNodeContext> = {}): LoopNodeContext {
  return {
    selectedLoopId: "main-loop",
    theme: structuredClone(defaultLoopTheme),
    nodeByKey: new Map(),
    draggedNodeIndex: null,
    dragOverNodeIndex: null,
    selectedNodeIndexes: [],
    readOnly: false,
    staticPreview: false,
    canAddFirstNode: false,
    onNodePointerDown: vi.fn(),
    onNodePointerMove: vi.fn(),
    onNodePointerUp: vi.fn(() => false),
    onNodePointerCancel: vi.fn(),
    onNodeSelect: vi.fn(),
    onOutputHandlerSelect: vi.fn(),
    onAddFirstNode: vi.fn(),
    ...overrides
  };
}

function nodeRecord(activeRole?: "work" | "validation", status?: "running" | "waiting_for_input"): LoopNodeRecord {
  const loop = v11Loop();
  const definition = loop.nodes[0]!;
  return {
    nodeKey: `${loop.id}::${definition.id}`,
    index: 0,
    loopId: loop.id,
    outputTargets: [],
    node: {
      id: `${loop.id}::${definition.id}`,
      displayId: definition.id,
      description: definition.description,
      terminal: false,
      nodeStyle: definition.work.nodeStyle,
      nodeSize: definition.work.nodeSize,
      workReasoningEffort: "high",
      validationReasoningEffort: "low",
      activeRole,
      definition,
      workLoopNodeRun: status ? {
        workLoopNodeRunId: "node-run",
        rootRunId: "root-run",
        loopRunId: "loop-run",
        loopId: loop.id,
        workLoopNodeId: definition.id,
        attempt: 1,
        status,
        stateRevisionBefore: 0,
        createdAt: "2026-08-16T09:00:00.000Z",
        updatedAt: "2026-08-16T09:00:01.000Z"
      } : undefined
    }
  };
}
