import { describe, expect, it } from "vitest";
import { defaultTerminalNodes, type ProjectAutomationConfig, type ProjectLoop, type ProjectStep, type StepTransitionTarget } from "@shared/api/workspace-contracts";
import {
  addFirstStep,
  canChangeStepToScheduled,
  changeStepType,
  createLoopDraft,
  removeLoopAtIndex,
  removeStep,
  reorderLoopSteps,
  replaceNode,
  transitionTargetFromSelectValue,
  transitionTargetSelectValue,
  updateLoopAtIndex
} from "../src/workspace/automation/loops/loopEditorState";

const agentStep = (id: string, approved: StepTransitionTarget): ProjectStep => ({
  id,
  type: "agent",
  nodeStyle: "terra",
  nodeSize: "medium",
  executionProfileId: "primary",
  primaryInstructionId: "project:primary",
  skillIds: ["project:checks"],
  description: `Execute ${id}.`,
  on: { approved, rejected: "failed" }
});

const loop = (): ProjectLoop => ({
  id: "first-loop",
  start: "start",
  nodes: [agentStep("start", "review"), agentStep("review", "completed"), ...defaultTerminalNodes()]
});

describe("loop editor state", () => {
  it("encodes Node and Loop targets without losing their target kind", () => {
    expect(transitionTargetSelectValue("shared-target")).toBe("node:shared-target");
    expect(transitionTargetSelectValue({ loop: "shared-target" })).toBe("loop:shared-target");
    expect(transitionTargetFromSelectValue("node:completed")).toBe("completed");
    expect(transitionTargetFromSelectValue("loop:next-loop")).toEqual({ loop: "next-loop" });
    expect(() => transitionTargetFromSelectValue("next-loop")).toThrow("Unsupported transition target select value.");
  });

  it("starts with a serverless empty draft and creates a Flat first Step on demand", () => {
    const draft = createLoopDraft();
    expect(draft).toEqual({ id: "", start: "", nodes: defaultTerminalNodes() });

    const withAgent = addFirstStep(draft);
    expect(withAgent.start).toBe("new-step");
    expect(withAgent.nodes[0]).toMatchObject({
      id: "new-step",
      type: "agent",
      executionProfileId: "",
      primaryInstructionId: "",
      skillIds: [],
      nodeStyle: "flat",
      nodeSize: "medium",
      on: { approved: "completed", rejected: "blocked" }
    });
    expect(withAgent.nodes.slice(1)).toEqual(defaultTerminalNodes());
  });

  it("renames a Step and every local transition that points to it", () => {
    const current = loop();
    const review = current.nodes[1]!;
    const next = replaceNode(current, "review", { ...review, id: "final-review" } as ProjectStep);
    expect((next.nodes[0] as ProjectStep).on.approved).toBe("final-review");
  });

  it("redirects removed Step and Loop references to output-specific terminals", () => {
    const withoutReview = removeStep(loop(), "review");
    expect((withoutReview.nodes[0] as ProjectStep).on.approved).toBe("completed");

    const referencingLoop: ProjectLoop = {
      id: "next-loop",
      start: "gate",
      nodes: [{
        id: "gate",
        type: "human",
        nodeStyle: "luna",
        nodeSize: "tiny",
        description: "Review the first Loop.",
        on: { approved: { loop: "first-loop" }, rejected: { loop: "first-loop" } }
      }, ...defaultTerminalNodes()]
    };
    const config: ProjectAutomationConfig = { version: 9, loops: [loop(), referencingLoop] };
    const remaining = removeLoopAtIndex(config, 0).loops[0]!.nodes[0] as ProjectStep;
    expect(remaining.on.approved).toBe("completed");
    expect(remaining.on.rejected).toBe("blocked");
  });

  it("updates cross-Loop references when a Loop is renamed", () => {
    const second: ProjectLoop = {
      id: "second-loop",
      start: "gate",
      nodes: [{
        id: "gate",
        type: "human",
        nodeStyle: "luna",
        nodeSize: "tiny",
        description: "Review the renamed Loop.",
        on: { approved: { loop: "first-loop" }, rejected: "failed" }
      }, ...defaultTerminalNodes()]
    };
    const config: ProjectAutomationConfig = { version: 9, loops: [loop(), second] };
    const next = updateLoopAtIndex(config, 0, { ...config.loops[0]!, id: "renamed-loop" });
    expect((next.loops[1]!.nodes[0] as ProjectStep).on.approved).toEqual({ loop: "renamed-loop" });
  });

  it("preserves cross-Loop transitions and starts blank composition when changing Human to Agent", () => {
    const step: ProjectStep = {
      id: "gate",
      type: "human",
      nodeStyle: "sol",
      nodeSize: "large",
      description: "Gate the next Step.",
      on: { approved: { loop: "other" }, rejected: { loop: "other" } }
    };
    const changed = changeStepType(step, "agent", {
      loop: { id: "current", start: step.id, nodes: [step, ...defaultTerminalNodes()] }
    });
    expect(changed).toMatchObject({
      type: "agent",
      executionProfileId: "",
      primaryInstructionId: "",
      skillIds: [],
      nodeStyle: "sol",
      nodeSize: "large",
      on: { approved: { loop: "other" }, rejected: { loop: "other" } }
    });
  });

  it("updates start when a Step is reordered to the first position", () => {
    const next = reorderLoopSteps(loop(), 1, 0);
    expect(next.nodes.slice(0, 2).map((node) => node.id)).toEqual(["review", "start"]);
    expect(next.start).toBe("review");
  });
});

describe("scheduled loop editor state", () => {
  it("converts only an eligible start Step to a scheduled agent while preserving outputs", () => {
    const current = loop();
    expect(canChangeStepToScheduled(current, "start")).toBe(true);
    expect(canChangeStepToScheduled(current, "review")).toBe(false);

    const next = changeStepType(current.nodes[0] as ProjectStep, "scheduled", {
      loop: current,
      now: new Date(2026, 6, 12, 10, 20)
    });
    expect(next).toMatchObject({
      id: "start",
      type: "scheduled",
      executionProfileId: "primary",
      primaryInstructionId: "project:primary",
      skillIds: ["project:checks"],
      nodeStyle: "terra",
      nodeSize: "medium",
      on: { approved: "review", rejected: "failed" },
      schedule: { kind: "once", date: "2026-07-12", time: "11:00" }
    });
  });

  it("offers Scheduled when incoming transitions form a cycle to the start Step", () => {
    const incoming = loop();
    incoming.nodes[1] = { ...incoming.nodes[1]!, on: { approved: "start", rejected: "start" } } as ProjectStep;

    expect(canChangeStepToScheduled(incoming, "start")).toBe(true);
    const scheduledStart = changeStepType(incoming.nodes[0] as ProjectStep, "scheduled", { loop: incoming });
    const authored = replaceNode(incoming, "start", scheduledStart);
    expect(authored.nodes[0]).toMatchObject({ id: "start", type: "scheduled" });
    expect((authored.nodes[1] as ProjectStep).on).toEqual({ approved: "start", rejected: "start" });
  });

  it("preserves Human cross-Loop outputs with blank composition when changing to Scheduled", () => {
    const gate: ProjectStep = {
      id: "gate",
      type: "human",
      nodeStyle: "mars",
      nodeSize: "small",
      description: "Start scheduled work.",
      on: { approved: { loop: "next-loop" }, rejected: { loop: "retry-loop" } }
    };

    expect(changeStepType(gate, "scheduled", {
      loop: { id: "current-loop", start: gate.id, nodes: [gate, ...defaultTerminalNodes()] }
    })).toMatchObject({
      type: "scheduled",
      executionProfileId: "",
      primaryInstructionId: "",
      skillIds: [],
      nodeStyle: "mars",
      nodeSize: "small",
      on: { approved: { loop: "next-loop" }, rejected: { loop: "retry-loop" } }
    });
  });

  it("keeps a scheduled start first and allows it to become the only Step", () => {
    const scheduled: ProjectLoop = {
      id: "scheduled",
      start: "timer",
      nodes: [{
        id: "timer",
        type: "scheduled",
        nodeStyle: "luna",
        nodeSize: "tiny",
        executionProfileId: "primary",
        primaryInstructionId: "project:primary",
        skillIds: ["project:checks"],
        description: "Run scheduled work.",
        schedule: { kind: "once", date: "2026-07-12", time: "11:00", timeZone: "Europe/Helsinki" },
        on: { approved: "run", rejected: "blocked" }
      }, agentStep("run", "completed"), ...defaultTerminalNodes()]
    };

    expect(reorderLoopSteps(scheduled, 0, 1)).toBe(scheduled);
    expect(reorderLoopSteps(scheduled, 1, 0)).toBe(scheduled);
    const withoutRun = removeStep(scheduled, "run");
    expect(withoutRun.start).toBe("timer");
    expect(withoutRun.nodes[0]).toMatchObject({ id: "timer", on: { approved: "completed", rejected: "blocked" } });
    expect(withoutRun.nodes.slice(1)).toEqual(defaultTerminalNodes());
    const withoutTimer = removeStep(scheduled, "timer");
    expect(withoutTimer.start).toBe("run");
    expect(withoutTimer.nodes[0]).toMatchObject({ id: "run" });
    expect(withoutTimer.nodes.slice(1)).toEqual(defaultTerminalNodes());
  });
});
