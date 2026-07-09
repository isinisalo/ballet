import { describe, expect, it } from "vitest";
import type { ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { humanGateResponseId } from "@shared/policy-actions";
import {
  nextConfigWithLoopHandlerAction,
  nextConfigWithLoopOutputRouteTarget,
  nextConfigWithPendingLoopOutputHandlerAction,
  nextConfigWithLoopStepAction,
  nextConfigWithLoopStepActions,
  nextConfigWithoutLoopOutputRouteTarget,
  nextConfigWithoutLoopStepIndexes
} from "../src/workspace/automation/loops/loopActionSheetLogic";

const loopId = "delivery.loop";

const action = (patch: Partial<ProjectAction>): ProjectAction => ({
  id: patch.id ?? "build",
  description: patch.description ?? `${patch.id ?? "build"} action.`,
  ...("agentId" in patch ? (patch.agentId ? { agentId: patch.agentId } : {}) : { agentId: "agent-1" }),
  ...(patch.humanGate ? { humanGate: true } : {})
});

const config = (actions: ProjectAction[], steps = actions.map((item) => item.id)): ProjectAutomationConfig => ({
  version: 1,
  actions,
  outputRoutes: [],
  humanGateResponses: [],
  loops: [{ id: loopId, steps }],
  runtimes: []
});

describe("nextConfigWithLoopStepAction", () => {
  it("changes the selected step to an existing action without creating action copies", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review", description: "Review.", agentId: "reviewer" });
    const current = config([build, review], [build.id]);
    const next = nextConfigWithLoopStepAction(current, loopId, 0, review.id);

    expect(next).not.toBe(current);
    expect(next.loops[0]?.steps).toEqual([review.id]);
    expect(next.actions).toBe(current.actions);
  });

  it("returns the current config for invalid loop, step, missing action, or unchanged action", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const current = config([build, review], [build.id]);

    expect(nextConfigWithLoopStepAction(current, "missing.loop", 0, review.id)).toBe(current);
    expect(nextConfigWithLoopStepAction(current, loopId, 5, review.id)).toBe(current);
    expect(nextConfigWithLoopStepAction(current, loopId, 0, "missing")).toBe(current);
    expect(nextConfigWithLoopStepAction(current, loopId, 0, build.id)).toBe(current);
  });

  it("changes every selected folded step to the existing target action", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const rework = action({ id: "rework" });
    const current = config([build, review, rework]);
    const next = nextConfigWithLoopStepActions(current, loopId, [0, 2], review.id);

    expect(next.loops[0]?.steps).toEqual([review.id, review.id, review.id]);
    expect(next.actions).toBe(current.actions);
  });

  it("removes every selected folded step from the loop", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const rework = action({ id: "rework" });
    const current = config([build, review, rework]);
    const next = nextConfigWithoutLoopStepIndexes(current, loopId, [0, 2]);

    expect(next.actions).toBe(current.actions);
    expect(next.loops[0]?.steps).toEqual([review.id]);
  });

  it("updates only scoped routes that reference the changed loop step", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const rework = action({ id: "rework" });
    const done = action({ id: "done", agentId: undefined });
    const current: ProjectAutomationConfig = {
      ...config([build, review, rework, done], [build.id, review.id, rework.id]),
      outputRoutes: [
        { sourceLoopId: loopId, sourceActionId: build.id, outputId: "approved", targetLoopId: loopId, targetActionId: review.id },
        { sourceLoopId: loopId, sourceActionId: review.id, outputId: "rejected", targetLoopId: loopId, targetActionId: rework.id }
      ]
    };
    const next = nextConfigWithLoopHandlerAction(current, loopId, 2, done.id);

    expect(next.loops[0]?.steps).toEqual([build.id, review.id, done.id]);
    expect(next.actions).toBe(current.actions);
    expect(next.outputRoutes).toEqual([
      { sourceLoopId: loopId, sourceActionId: build.id, outputId: "approved", targetLoopId: loopId, targetActionId: review.id },
      { sourceLoopId: loopId, sourceActionId: review.id, outputId: "rejected", targetLoopId: loopId, targetActionId: done.id }
    ]);
  });
});

describe("nextConfigWithLoopHandlerAction route cleanup", () => {
  it("rewrites scoped routes and removes stale human gate responses when a loop step action changes", () => {
    const start = action({ id: "start-review", agentId: "reviewer" });
    const gate = action({ id: "gate-review", humanGate: true });
    const done = action({ id: "done-review", agentId: undefined });
    const gateResponseBase = {
      loopId,
      actionId: gate.id,
      outputId: "rejected",
      prompt: "Please rework this.",
      submittedAt: "2026-07-07T10:00:00.000Z"
    };
    const current: ProjectAutomationConfig = {
      ...config([start, gate, done]),
      outputRoutes: [
        { sourceLoopId: loopId, sourceActionId: start.id, outputId: "rejected", targetLoopId: loopId, targetActionId: gate.id },
        { sourceLoopId: loopId, sourceActionId: gate.id, outputId: "rejected", targetLoopId: loopId, targetActionId: done.id }
      ],
      humanGateResponses: [{ ...gateResponseBase, id: humanGateResponseId(gateResponseBase) }]
    };

    const next = nextConfigWithLoopHandlerAction(current, loopId, 1, done.id);

    expect(next.loops[0]?.steps).toEqual([start.id, done.id, done.id]);
    expect(next.actions).toBe(current.actions);
    expect(next.outputRoutes).toEqual([
      { sourceLoopId: loopId, sourceActionId: start.id, outputId: "rejected", targetLoopId: loopId, targetActionId: done.id }
    ]);
    expect(next.humanGateResponses).toEqual([]);
  });
});

describe("nextConfigWithLoopOutputRouteTarget", () => {
  it("upserts scoped output routes by source loop, source action, and output", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const done = action({ id: "done", agentId: undefined });
    const current: ProjectAutomationConfig = {
      ...config([build, review, done], [build.id, review.id, done.id]),
      outputRoutes: [
        { sourceLoopId: loopId, sourceActionId: build.id, outputId: "approved", targetLoopId: loopId, targetActionId: review.id }
      ]
    };

    const next = nextConfigWithLoopOutputRouteTarget(current, loopId, build.id, "approved", loopId, done.id);

    expect(next.outputRoutes).toEqual([
      { sourceLoopId: loopId, sourceActionId: build.id, outputId: "approved", targetLoopId: loopId, targetActionId: done.id }
    ]);
  });

  it("creates cross-loop output routes when the target action belongs to the target loop", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const rework = action({ id: "rework" });
    const returnLoopId = "return.loop";
    const current: ProjectAutomationConfig = {
      ...config([build, review, rework], [build.id]),
      loops: [
        { id: loopId, steps: [build.id] },
        { id: returnLoopId, steps: [review.id, rework.id] }
      ]
    };

    const next = nextConfigWithLoopOutputRouteTarget(current, loopId, build.id, "rejected", returnLoopId, rework.id);

    expect(next.outputRoutes).toEqual([
      { sourceLoopId: loopId, sourceActionId: build.id, outputId: "rejected", targetLoopId: returnLoopId, targetActionId: rework.id }
    ]);
  });

  it("does not create invalid routes for empty target loops or actions outside the target loop", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const emptyLoopId = "empty.loop";
    const current: ProjectAutomationConfig = {
      ...config([build, review], [build.id]),
      loops: [
        { id: loopId, steps: [build.id] },
        { id: emptyLoopId, steps: [] }
      ]
    };

    expect(nextConfigWithLoopOutputRouteTarget(current, loopId, build.id, "approved", emptyLoopId, review.id)).toBe(current);
    expect(nextConfigWithLoopOutputRouteTarget(current, loopId, build.id, "approved", loopId, review.id)).toBe(current);
  });
});

describe("nextConfigWithPendingLoopOutputHandlerAction", () => {
  it("appends the selected handler action and creates the scoped output route", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const current = config([build, review], [build.id]);

    const next = nextConfigWithPendingLoopOutputHandlerAction(current, loopId, 1, review.id, build.id, "approved");

    expect(next.loops[0]?.steps).toEqual([build.id, review.id]);
    expect(next.outputRoutes).toEqual([
      { sourceLoopId: loopId, sourceActionId: build.id, outputId: "approved", targetLoopId: loopId, targetActionId: review.id }
    ]);
  });

  it("returns the current config for invalid pending handler input", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const current = config([build, review], [build.id]);

    expect(nextConfigWithPendingLoopOutputHandlerAction(current, "missing.loop", 1, review.id, build.id, "approved")).toBe(current);
    expect(nextConfigWithPendingLoopOutputHandlerAction(current, loopId, -1, review.id, build.id, "approved")).toBe(current);
    expect(nextConfigWithPendingLoopOutputHandlerAction(current, loopId, 2, review.id, build.id, "approved")).toBe(current);
    expect(nextConfigWithPendingLoopOutputHandlerAction(current, loopId, 1, "missing-action", build.id, "approved")).toBe(current);
    expect(nextConfigWithPendingLoopOutputHandlerAction(current, loopId, 1, review.id, build.id, "missing-output")).toBe(current);
  });
});

describe("nextConfigWithoutLoopOutputRouteTarget", () => {
  it("removes only the selected scoped output route", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const rework = action({ id: "rework" });
    const responseBase = {
      loopId,
      actionId: review.id,
      outputId: "approved",
      prompt: "Ship it.",
      submittedAt: "2026-07-07T10:00:00.000Z"
    };
    const current: ProjectAutomationConfig = {
      ...config([build, review, rework], [build.id, review.id, rework.id]),
      outputRoutes: [
        { sourceLoopId: loopId, sourceActionId: build.id, outputId: "approved", targetLoopId: loopId, targetActionId: review.id },
        { sourceLoopId: loopId, sourceActionId: build.id, outputId: "rejected", targetLoopId: loopId, targetActionId: rework.id }
      ],
      humanGateResponses: [{ ...responseBase, id: humanGateResponseId(responseBase) }]
    };

    const next = nextConfigWithoutLoopOutputRouteTarget(current, loopId, build.id, "approved");

    expect(next).not.toBe(current);
    expect(next.outputRoutes).toEqual([
      { sourceLoopId: loopId, sourceActionId: build.id, outputId: "rejected", targetLoopId: loopId, targetActionId: rework.id }
    ]);
    expect(next.loops).toBe(current.loops);
    expect(next.actions).toBe(current.actions);
    expect(next.humanGateResponses).toBe(current.humanGateResponses);
  });

  it("returns the current config for invalid route targets", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const current: ProjectAutomationConfig = {
      ...config([build, review], [build.id, review.id]),
      outputRoutes: [
        { sourceLoopId: loopId, sourceActionId: build.id, outputId: "approved", targetLoopId: loopId, targetActionId: review.id }
      ]
    };

    expect(nextConfigWithoutLoopOutputRouteTarget(current, "missing.loop", build.id, "approved")).toBe(current);
    expect(nextConfigWithoutLoopOutputRouteTarget(current, loopId, "missing-action", "approved")).toBe(current);
    expect(nextConfigWithoutLoopOutputRouteTarget(current, loopId, build.id, "missing-output")).toBe(current);
    expect(nextConfigWithoutLoopOutputRouteTarget(current, loopId, review.id, "approved")).toBe(current);
  });
});
