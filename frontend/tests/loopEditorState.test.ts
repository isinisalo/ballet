import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig, ProjectLoop, ProjectStep } from "@shared/api/workspace-contracts";
import { changeStepType, insertStepForTransition, removeLoopAtIndex, removeStep, reorderLoopSteps, replaceStep, updateLoopAtIndex } from "../src/workspace/automation/loops/loopEditorState";

const agentStep = (id: string, approved: ProjectStep["on"]["approved"]): ProjectStep => ({
  id,
  type: "agent",
  agentId: "agent",
  description: "",
  on: { approved, rejected: { end: "failed" } }
});

const loop = (): ProjectLoop => ({
  id: "first-loop",
  start: "start",
  steps: [agentStep("start", "review"), agentStep("review", { end: "completed" })]
});

describe("loop editor state", () => {
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
      version: 2,
      runtimes: [],
      loops: [loop(), {
        id: "next-loop",
        start: "gate",
        steps: [{ id: "gate", type: "human", description: "", on: { approved: { loop: "first-loop" }, rejected: { end: "failed" } } }]
      }]
    };
    expect(removeLoopAtIndex(config, 0).loops[0].steps[0].on.approved).toEqual({ end: "blocked" });
  });

  it("updates cross-loop references when a loop is renamed", () => {
    const second: ProjectLoop = {
      id: "second-loop",
      start: "gate",
      steps: [{ id: "gate", type: "human", description: "", on: { approved: { loop: "first-loop" }, rejected: { end: "failed" } } }]
    };
    const config: ProjectAutomationConfig = { version: 2, runtimes: [], loops: [loop(), second] };
    const next = updateLoopAtIndex(config, 0, { ...config.loops[0], id: "renamed-loop" });
    expect(next.loops[1].steps[0].on.approved).toEqual({ loop: "renamed-loop" });
  });

  it("removes cross-loop transitions when changing a human gate to agent", () => {
    const step: ProjectStep = { id: "gate", type: "human", description: "", on: { approved: { loop: "other" }, rejected: "gate" } };
    expect(changeStepType(step, "agent", "agent").on.approved).toEqual({ end: "blocked" });
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
});
