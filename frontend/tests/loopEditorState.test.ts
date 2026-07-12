import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig, ProjectLoop, ProjectStep, StepTransitionTarget } from "@shared/api/workspace-contracts";
import { canChangeStepToScheduled, changeStepType, createLoopDraft, insertStepForTransition, removeLoopAtIndex, removeStep, reorderLoopSteps, replaceStep, updateLoopAtIndex } from "../src/workspace/automation/loops/loopEditorState";

const agentStep = (id: string, approved: StepTransitionTarget): ProjectStep => ({
  id,
  type: "agent",
  nodeSize: "medium",
  agentId: "agent",
  description: "",
  on: { approved, rejected: { end: "failed" } }
});

const loop = (): ProjectLoop => ({
  id: "first-loop",
  theme: "open-ai",
  start: "start",
  steps: [agentStep("start", "review"), agentStep("review", { end: "completed" })]
});

describe("loop editor state", () => {
  it("creates open-ai Loops with type-appropriate Step size defaults", () => {
    expect(createLoopDraft([{ id: "builder" } as never])).toMatchObject({
      theme: "open-ai",
      steps: [{ type: "agent", nodeSize: "medium" }]
    });
    expect(createLoopDraft([])).toMatchObject({
      theme: "open-ai",
      steps: [{ type: "human", nodeSize: "small" }]
    });
  });

  it("renames a step and every local transition that points to it", () => {
    const current = loop();
    const review = current.steps[1];
    const next = replaceStep(current, "review", { ...review, id: "final-review" } as ProjectStep);
    expect(next.steps[0].on.approved).toBe("final-review");
  });

  it("redirects removed step and loop references to blocked terminals", () => {
    const withoutReview = removeStep(loop(), "review");
    expect(withoutReview.steps[0].on.approved).toEqual({ end: "blocked" });

    const config: ProjectAutomationConfig = {
      version: 5,
      loops: [loop(), {
        id: "next-loop",
        theme: "open-ai",
        start: "gate",
        steps: [{ id: "gate", type: "human", nodeSize: "small", description: "", on: { approved: { loop: "first-loop" }, rejected: { end: "failed" } } }]
      }]
    };
    expect(removeLoopAtIndex(config, 0).loops[0].steps[0].on.approved).toEqual({ end: "blocked" });
  });

  it("updates cross-loop references when a loop is renamed", () => {
    const second: ProjectLoop = {
      id: "second-loop",
      theme: "open-ai",
      start: "gate",
      steps: [{ id: "gate", type: "human", nodeSize: "small", description: "", on: { approved: { loop: "first-loop" }, rejected: { end: "failed" } } }]
    };
    const config: ProjectAutomationConfig = { version: 5, loops: [loop(), second] };
    const next = updateLoopAtIndex(config, 0, { ...config.loops[0], id: "renamed-loop" });
    expect(next.loops[1].steps[0].on.approved).toEqual({ loop: "renamed-loop" });
  });

  it("removes cross-loop transitions when changing a human gate to agent", () => {
    const step: ProjectStep = { id: "gate", type: "human", nodeSize: "large", description: "", on: { approved: { loop: "other" }, rejected: "gate" } };
    const changed = changeStepType(step, "agent", { loop: { id: "current", theme: "open-ai", start: step.id, steps: [step] }, firstAgentId: "agent" });
    expect(changed.type === "agent" ? changed.on.approved : undefined).toEqual({ end: "blocked" });
    expect(changed.nodeSize).toBe("large");
  });

  it("inserts a new Step through a terminal ghost and preserves the previous terminal", () => {
    const current = loop();
    const next = insertStepForTransition(current, "review", "approved", []);
    const inserted = next.steps.find((step) => step.id === "new-step")!;
    expect(next.steps.find((step) => step.id === "review")!.on.approved).toBe("new-step");
    expect(inserted.on.approved).toEqual({ end: "completed" });
  });

  it("updates start when a Step is reordered to the first position", () => {
    const next = reorderLoopSteps(loop(), 1, 0);
    expect(next.steps.map((step) => step.id)).toEqual(["review", "start"]);
    expect(next.start).toBe("review");
  });

  it("converts only an eligible start Step to a scheduled start with the approved local target", () => {
    const current = loop();
    expect(canChangeStepToScheduled(current, "start")).toBe(true);
    expect(canChangeStepToScheduled(current, "review")).toBe(false);
    const next = changeStepType(current.steps[0]!, "scheduled", { loop: current, now: new Date(2026, 6, 12, 10, 20) });
    expect(next).toMatchObject({
      id: "start",
      type: "scheduled",
      description: "",
      on: { triggered: "review" },
      schedule: { kind: "once", date: "2026-07-12", time: "11:00" }
    });
    expect("agentId" in next).toBe(false);
  });

  it("keeps a scheduled start first and retains its only executable target", () => {
    const scheduled: ProjectLoop = {
      id: "scheduled",
      theme: "open-ai",
      start: "timer",
      steps: [{
        id: "timer",
        type: "scheduled",
        nodeSize: "small",
        description: "",
        schedule: { kind: "once", date: "2026-07-12", time: "11:00", timeZone: "Europe/Helsinki" },
        on: { triggered: "run" }
      }, agentStep("run", { end: "completed" })]
    };
    expect(reorderLoopSteps(scheduled, 0, 1)).toBe(scheduled);
    expect(reorderLoopSteps(scheduled, 1, 0)).toBe(scheduled);
    expect(removeStep(scheduled, "run")).toBe(scheduled);
    expect(removeStep(scheduled, "timer")).toMatchObject({ start: "run", steps: [{ id: "run" }] });
  });
});
