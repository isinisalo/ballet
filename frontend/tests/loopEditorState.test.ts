import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig, ProjectLoop, ProjectStep, StepTransitionTarget } from "@shared/api/workspace-contracts";
import {
  addFirstStep,
  canChangeStepToScheduled,
  changeStepType,
  createLoopDraft,
  insertStepForTransition,
  removeLoopAtIndex,
  removeStep,
  reorderLoopSteps,
  replaceStep,
  updateLoopAtIndex
} from "../src/workspace/automation/loops/loopEditorState";

const agentStep = (id: string, approved: StepTransitionTarget): ProjectStep => ({
  id,
  type: "agent",
  nodeStyle: "terra",
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
  it("starts with a serverless empty draft and creates a Flat first Step on demand", () => {
    const draft = createLoopDraft();
    expect(draft).toEqual({ id: "", start: "", steps: [] });

    expect(addFirstStep(draft, [{ id: "builder" } as never])).toMatchObject({
      start: "new-step",
      steps: [{
        id: "new-step",
        type: "agent",
        agentId: "builder",
        nodeStyle: "flat",
        on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
      }]
    });
    expect(addFirstStep(createLoopDraft(), [])).toMatchObject({
      steps: [{ type: "human", nodeStyle: "flat" }]
    });
  });

  it("renames a Step and every local transition that points to it", () => {
    const current = loop();
    const review = current.steps[1]!;
    const next = replaceStep(current, "review", { ...review, id: "final-review" });
    expect(next.steps[0]!.on.approved).toBe("final-review");
  });

  it("redirects removed Step and Loop references to output-specific terminals", () => {
    const withoutReview = removeStep(loop(), "review");
    expect(withoutReview.steps[0]!.on.approved).toEqual({ end: "completed" });

    const referencingLoop: ProjectLoop = {
      id: "next-loop",
      start: "gate",
      steps: [{
        id: "gate",
        type: "human",
        nodeStyle: "luna",
        description: "",
        on: { approved: { loop: "first-loop" }, rejected: { loop: "first-loop" } }
      }]
    };
    const config: ProjectAutomationConfig = { version: 7, loops: [loop(), referencingLoop] };
    const remaining = removeLoopAtIndex(config, 0).loops[0]!.steps[0]!;
    expect(remaining.on.approved).toEqual({ end: "completed" });
    expect(remaining.on.rejected).toEqual({ end: "blocked" });
  });

  it("updates cross-Loop references when a Loop is renamed", () => {
    const second: ProjectLoop = {
      id: "second-loop",
      start: "gate",
      steps: [{
        id: "gate",
        type: "human",
        nodeStyle: "luna",
        description: "",
        on: { approved: { loop: "first-loop" }, rejected: { end: "failed" } }
      }]
    };
    const config: ProjectAutomationConfig = { version: 7, loops: [loop(), second] };
    const next = updateLoopAtIndex(config, 0, { ...config.loops[0]!, id: "renamed-loop" });
    expect(next.loops[1]!.steps[0]!.on.approved).toEqual({ loop: "renamed-loop" });
  });

  it("replaces cross-Loop transitions with output-specific defaults when changing to agent", () => {
    const step: ProjectStep = {
      id: "gate",
      type: "human",
      nodeStyle: "sol",
      description: "",
      on: { approved: { loop: "other" }, rejected: { loop: "other" } }
    };
    const changed = changeStepType(step, "agent", {
      loop: { id: "current", start: step.id, steps: [step] },
      firstAgentId: "agent"
    });
    expect(changed).toMatchObject({
      type: "agent",
      agentId: "agent",
      nodeStyle: "sol",
      on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
    });
  });

  it("inserts a new Step before a terminal and preserves that terminal target", () => {
    const current = loop();
    const next = insertStepForTransition(current, "review", "approved", []);
    const inserted = next.steps.find((step) => step.id === "new-step")!;
    expect(next.steps.find((step) => step.id === "review")!.on.approved).toBe("new-step");
    expect(inserted).toMatchObject({
      type: "human",
      nodeStyle: "flat",
      on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
    });
  });

  it("updates start when a Step is reordered to the first position", () => {
    const next = reorderLoopSteps(loop(), 1, 0);
    expect(next.steps.map((step) => step.id)).toEqual(["review", "start"]);
    expect(next.start).toBe("review");
  });
});

describe("scheduled loop editor state", () => {
  it("converts only an eligible start Step to a scheduled agent while preserving outputs", () => {
    const current = loop();
    expect(canChangeStepToScheduled(current, "start")).toBe(true);
    expect(canChangeStepToScheduled(current, "review")).toBe(false);

    const next = changeStepType(current.steps[0]!, "scheduled", {
      loop: current,
      now: new Date(2026, 6, 12, 10, 20)
    });
    expect(next).toMatchObject({
      id: "start",
      type: "scheduled",
      agentId: "agent",
      nodeStyle: "terra",
      on: { approved: "review", rejected: { end: "failed" } },
      schedule: { kind: "once", date: "2026-07-12", time: "11:00" }
    });
  });

  it("does not offer Scheduled when a transition points to the start Step", () => {
    const incoming = loop();
    incoming.steps[1] = { ...incoming.steps[1]!, on: { ...incoming.steps[1]!.on, rejected: "start" } };

    expect(canChangeStepToScheduled(incoming, "start")).toBe(false);
  });

  it("replaces Human cross-Loop outputs with scheduled terminal defaults", () => {
    const gate: ProjectStep = {
      id: "gate",
      type: "human",
      nodeStyle: "mars",
      description: "Start scheduled work.",
      on: { approved: { loop: "next-loop" }, rejected: { loop: "retry-loop" } }
    };

    expect(changeStepType(gate, "scheduled", {
      loop: { id: "current-loop", start: gate.id, steps: [gate] },
      firstAgentId: "agent"
    })).toMatchObject({
      type: "scheduled",
      agentId: "agent",
      nodeStyle: "mars",
      on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
    });
  });

  it("keeps a scheduled start first and allows it to become the only Step", () => {
    const scheduled: ProjectLoop = {
      id: "scheduled",
      start: "timer",
      steps: [{
        id: "timer",
        type: "scheduled",
        nodeStyle: "luna",
        agentId: "agent",
        description: "",
        schedule: { kind: "once", date: "2026-07-12", time: "11:00", timeZone: "Europe/Helsinki" },
        on: { approved: "run", rejected: { end: "blocked" } }
      }, agentStep("run", { end: "completed" })]
    };

    expect(reorderLoopSteps(scheduled, 0, 1)).toBe(scheduled);
    expect(reorderLoopSteps(scheduled, 1, 0)).toBe(scheduled);
    expect(removeStep(scheduled, "run")).toMatchObject({
      start: "timer",
      steps: [{ id: "timer", on: { approved: { end: "completed" }, rejected: { end: "blocked" } } }]
    });
    expect(removeStep(scheduled, "timer")).toMatchObject({ start: "run", steps: [{ id: "run" }] });
  });
});
