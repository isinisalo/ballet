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
  updateLoopAtIndex
} from "../src/workspace/automation/loops/loopEditorState";
import { agentTransitions } from "./agentTransitionFixture";

const agentStep = (id: string, target: StepTransitionTarget): ProjectStep => ({
  id,
  type: "agent",
  nodeStyle: "terra",
  nodeSize: "medium",
  agentId: "agent",
  description: "",
  on: agentTransitions(target)
});

const loop = (): ProjectLoop => ({
  id: "first-loop",
  start: "start",
  nodes: [agentStep("start", "review"), agentStep("review", "completed"), ...defaultTerminalNodes()]
});

describe("loop editor state", () => {
  it("creates explicit action defaults for the first Step", () => {
    const draft = createLoopDraft();
    expect(draft).toEqual({ id: "", start: "", nodes: defaultTerminalNodes() });
    const withAgent = addFirstStep(draft, [{ id: "builder" } as never]);
    expect(withAgent.nodes[0]).toMatchObject({
      id: "new-step",
      type: "agent",
      on: agentTransitions("completed")
    });
  });

  it("renames local references recursively in goto, retry, wait, and fallback actions", () => {
    const current = loop();
    const source = current.nodes[0] as ProjectStep;
    if (source.type === "human") throw new Error("Expected agent.");
    current.nodes[0] = {
      ...source,
      on: {
        ...source.on,
        blocked: { action: "retry", target: "review", policy: { maxAttempts: 2, onExhausted: { action: "goto", target: "review" } } },
        needs_input: { action: "wait", resume: { target: "review" } }
      }
    };
    const next = replaceNode(current, "review", { ...current.nodes[1]!, id: "final-review" } as ProjectStep);
    const changed = next.nodes[0] as ProjectStep;
    if (changed.type === "human") throw new Error("Expected agent.");
    expect(changed.on.ready).toMatchObject({ target: "final-review" });
    expect(changed.on.blocked).toMatchObject({ target: "final-review", policy: { onExhausted: { target: "final-review" } } });
    expect(changed.on.needs_input).toMatchObject({ resume: { target: "final-review" } });
  });

  it("uses action-generic safe fallbacks when referenced Steps or Loops are removed", () => {
    const current = loop();
    const currentStart = current.nodes[0] as ProjectStep;
    if (currentStart.type === "human") throw new Error("Expected agent.");
    current.nodes[0] = {
      ...currentStart,
      on: {
        ...currentStart.on,
        blocked: {
          action: "retry",
          target: "review",
          policy: { maxAttempts: 2, onExhausted: { action: "wait", resume: "same-step" } }
        }
      }
    };
    const withoutReview = removeStep(current, "review");
    const start = withoutReview.nodes[0] as ProjectStep;
    if (start.type === "human") throw new Error("Expected agent.");
    expect(start.on.ready).toEqual({ action: "terminate", status: "blocked" });
    expect(start.on.approved).toEqual({ action: "terminate", status: "blocked" });
    expect(start.on.blocked).toEqual({ action: "wait", resume: "same-step" });

    const referencingLoop: ProjectLoop = {
      id: "next-loop",
      start: "gate",
      nodes: [{
        id: "gate", type: "human", nodeStyle: "luna", nodeSize: "tiny", description: "",
        on: {
          approved: { action: "goto", target: { loop: "first-loop" } },
          rejected: { action: "wait", resume: { target: { loop: "first-loop" } } }
        }
      }, ...defaultTerminalNodes()]
    };
    const config: ProjectAutomationConfig = { version: 8, loops: [loop(), referencingLoop] };
    const remaining = removeLoopAtIndex(config, 0).loops[0]!.nodes[0] as ProjectStep;
    expect(remaining.on.approved).toEqual({ action: "terminate", status: "blocked" });
    expect(remaining.on.rejected).toEqual({ action: "terminate", status: "blocked" });
  });

  it("updates every cross-Loop action reference when a Loop is renamed", () => {
    const second: ProjectLoop = {
      id: "second-loop",
      start: "gate",
      nodes: [{
        id: "gate", type: "human", nodeStyle: "luna", nodeSize: "tiny", description: "",
        on: {
          approved: { action: "goto", target: { loop: "first-loop" } },
          rejected: { action: "wait", resume: { target: { loop: "first-loop" } } }
        }
      }, ...defaultTerminalNodes()]
    };
    const config: ProjectAutomationConfig = { version: 8, loops: [loop(), second] };
    const next = updateLoopAtIndex(config, 0, { ...config.loops[0]!, id: "renamed-loop" });
    const gate = next.loops[1]!.nodes[0] as ProjectStep;
    expect(gate.on.approved).toMatchObject({ target: { loop: "renamed-loop" } });
    expect(gate.on.rejected).toMatchObject({ resume: { target: { loop: "renamed-loop" } } });
  });

  it("preserves the shared approved action across Step type changes, including cross-Loop targets", () => {
    const gate: ProjectStep = {
      id: "gate", type: "human", nodeStyle: "sol", nodeSize: "large", description: "",
      on: {
        approved: { action: "goto", target: { loop: "other" }, input: "append-signal" },
        rejected: { action: "terminate", status: "failed" }
      }
    };
    const changed = changeStepType(gate, "agent", {
      loop: { id: "current", start: gate.id, nodes: [gate, ...defaultTerminalNodes()] },
      firstAgentId: "agent"
    });
    expect(changed).toMatchObject({
      type: "agent",
      agentId: "agent",
      on: { approved: { action: "goto", target: { loop: "other" } } }
    });
  });

  it("updates start when a Step is reordered", () => {
    const next = reorderLoopSteps(loop(), 1, 0);
    expect(next.nodes.slice(0, 2).map((node) => node.id)).toEqual(["review", "start"]);
    expect(next.start).toBe("review");
  });
});

describe("scheduled loop editor state", () => {
  it("preserves generic actions when an eligible agent Step becomes scheduled", () => {
    const current = loop();
    expect(canChangeStepToScheduled(current, "start")).toBe(true);
    const next = changeStepType(current.nodes[0] as ProjectStep, "scheduled", {
      loop: current,
      now: new Date(2026, 6, 12, 10, 20)
    });
    expect(next).toMatchObject({
      id: "start",
      type: "scheduled",
      on: agentTransitions("review"),
      schedule: { kind: "once", date: "2026-07-12", time: "11:00" }
    });
  });

  it("does not offer Scheduled when a nested action targets the start Step", () => {
    const current = loop();
    const review = current.nodes[1] as ProjectStep;
    if (review.type === "human") throw new Error("Expected agent.");
    current.nodes[1] = {
      ...review,
      on: {
        ...review.on,
        blocked: { action: "retry", target: "start", policy: { maxAttempts: 2, onExhausted: { action: "terminate", status: "blocked" } } }
      }
    };
    expect(canChangeStepToScheduled(current, "start")).toBe(false);
  });

  it("keeps a scheduled start first and allows it to become the only Step", () => {
    const scheduled = changeStepType(loop().nodes[0] as ProjectStep, "scheduled", {
      loop: loop(),
      now: new Date(2026, 6, 12, 10, 20)
    });
    const current: ProjectLoop = { ...loop(), nodes: [scheduled, ...loop().nodes.slice(1)] };
    expect(reorderLoopSteps(current, 0, 1)).toBe(current);
    const withoutReview = removeStep(current, "review");
    expect(withoutReview.nodes[0]).toMatchObject({ id: "start" });
  });
});
