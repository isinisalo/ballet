import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { defaultLoopTheme, loopNodeStyles, type ProjectLoopNode, type ProjectStep, type StepRun } from "@shared/api/workspace-contracts";
import { describe, expect, it, vi } from "vitest";
import type { LoopNodeContext } from "../src/workspace/automation/loops/LoopCanvasTypes";
import { LoopCompactStepNode } from "../src/workspace/automation/loops/LoopCompactStepNode";
import { LoopNodeArtwork } from "../src/workspace/automation/loops/LoopNodeArtwork";
import type { LoopStepRecord } from "../src/workspace/automation/loops/loopGraph";

const nodeCss = readFileSync(`${process.cwd()}/frontend/src/styles.css`, "utf8");

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
  onStepPointerDown: vi.fn(),
  onStepPointerMove: vi.fn(),
  onStepPointerUp: vi.fn(() => false),
  onStepPointerCancel: vi.fn(),
  onStepSelect: vi.fn(),
  onOutputHandlerSelect: vi.fn(),
  onAddFirstStep: vi.fn()
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

  it.each(["black-hole", "satellite", "meteorite"] as const)("keeps %s borderless with glow, selection, and keyboard focus", (nodeStyle) => {
    const selectedContext = context();
    selectedContext.selectedStepIndexes = [0];
    const selectedRecord = record("agent", "running");
    selectedRecord.step!.nodeStyle = nodeStyle;
    selectedRecord.step!.reasoningEffort = "high";
    render(<LoopCompactStepNode context={selectedContext} record={selectedRecord} />);

    const node = screen.getByRole("button", { name: "View step implement" });
    node.focus();
    expect(node).toHaveFocus();
    expect(nodeCss).toContain(`[data-loop-node-style="${nodeStyle}"]`);
    expect(nodeCss).toContain("border-color: transparent !important;");
    expect(node).toHaveClass("border-primary/80", "ring-2");
    expect(node).toHaveAttribute("data-loop-reasoning-glow", "4");
    expect(node.querySelector(".loop-node-reasoning-glow")).toBeInTheDocument();
  });
});

describe("terminal Loop nodes", () => {
  it("renders completed, blocked, and failed with configured artwork and no status icon", () => {
    render(<>
      <LoopCompactStepNode context={context()} record={terminalRecord("completed", "sol", "medium")} />
      <LoopCompactStepNode context={context()} record={terminalRecord("blocked", "luna", "small")} />
      <LoopCompactStepNode context={context()} record={terminalRecord("failed", "meteorite", "tiny")} />
    </>);

    expect(screen.getByRole("button", { name: "View node completed" })).toHaveAttribute("data-loop-node-size", "medium");
    expect(screen.getByRole("button", { name: "View node completed" })).toHaveAttribute("data-loop-node-style", "sol");
    expect(screen.getByRole("button", { name: "View node blocked" })).toHaveAttribute("data-loop-node-size", "small");
    expect(screen.getByRole("button", { name: "View node failed" }).querySelector(".loop-node-artwork-svg")).toBeInTheDocument();
    expect(document.querySelector(".lucide-circle-check-big, .lucide-circle-slash, .lucide-circle-x")).not.toBeInTheDocument();
  });
});

const record = (
  kind: "agent" | "human" | "scheduled",
  status: "running" | "waiting_for_human"
): LoopStepRecord => {
  const id = kind === "agent" ? "implement" : kind === "human" ? "approve" : "deploy";
  const on = { approved: "completed", rejected: "blocked" };
  const step: ProjectStep = kind === "agent"
    ? { id, type: "agent", nodeStyle: "flat", nodeSize: "medium", agentId: "developer", description: "Implement.", on }
    : kind === "human"
      ? { id, type: "human", nodeStyle: "mars", nodeSize: "small", description: "Approve.", on }
      : {
          id,
          type: "scheduled",
          nodeStyle: "luna",
          nodeSize: "tiny",
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
      terminal: false,
      scheduleLabel: kind === "scheduled" ? "Weekdays · 09:00 · Europe/Helsinki" : undefined,
      nodeStyle: step.nodeStyle,
      nodeSize: step.nodeSize,
      reasoningEffort: kind === "scheduled" ? "high" : undefined,
      step,
      stepRun
    }
  };
};

const terminalRecord = (
  status: "completed" | "blocked" | "failed",
  nodeStyle: ProjectLoopNode["nodeStyle"],
  nodeSize: ProjectLoopNode["nodeSize"]
): LoopStepRecord => {
  const step: ProjectLoopNode = { id: status, type: status, description: "", nodeStyle, nodeSize };
  return {
    stepKey: `delivery::${status}`,
    loopId: "delivery",
    index: status === "completed" ? 1 : status === "blocked" ? 2 : 3,
    outputTargets: [],
    step: {
      id: `delivery::${status}`,
      displayId: status,
      description: "",
      humanGate: false,
      scheduled: false,
      terminal: true,
      nodeStyle,
      nodeSize,
      step
    }
  };
};
