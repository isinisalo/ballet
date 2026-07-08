import { describe, expect, it } from "vitest";
import type { ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { humanGateResponseId } from "@shared/policy-actions";
import {
  nextConfigWithLoopHandlerAction,
  nextConfigWithLoopStepAction,
  nextConfigWithLoopStepActions,
  nextConfigWithoutLoopStepIndexes
} from "../src/workspace/automation/loops/loopActionSheetLogic";

const loopId = "delivery.loop";

const action = (patch: Partial<ProjectAction>): ProjectAction => ({
  id: patch.id ?? "build",
  description: patch.description ?? `${patch.id ?? "build"} action.`,
  outputIds: patch.outputIds ?? ["approved", "rejected"],
  agentIds: patch.agentIds ?? ["agent-1"],
  ...(patch.humanGate ? { humanGate: true, agentIds: [] } : {})
});

const config = (actions: ProjectAction[], steps = actions.map((item) => item.id)): ProjectAutomationConfig => ({
  version: 1,
  actions,
  outputs: [{ id: "approved" }, { id: "rejected" }],
  outputRoutes: [],
  humanGateResponses: [],
  loops: [{ id: loopId, steps }],
  runtimes: []
});

describe("nextConfigWithLoopStepAction", () => {
  it("changes the selected step to an existing action without creating action copies", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review", description: "Review.", agentIds: ["reviewer"] });
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
    const build = action({ id: "build", outputIds: ["ready", "blocked"] });
    const review = action({ id: "review", outputIds: ["approved", "changes-requested"] });
    const rework = action({ id: "rework", outputIds: ["ready", "blocked"] });
    const done = action({ id: "done", outputIds: [] });
    const current: ProjectAutomationConfig = {
      ...config([build, review, rework, done], [build.id, review.id, rework.id]),
      outputRoutes: [
        { sourceLoopId: loopId, sourceActionId: build.id, outputId: "ready", targetLoopId: loopId, targetActionId: review.id },
        { sourceLoopId: loopId, sourceActionId: review.id, outputId: "changes-requested", targetLoopId: loopId, targetActionId: rework.id }
      ]
    };
    const next = nextConfigWithLoopHandlerAction(current, loopId, 2, done.id);

    expect(next.loops[0]?.steps).toEqual([build.id, review.id, done.id]);
    expect(next.actions).toBe(current.actions);
    expect(next.outputRoutes).toEqual([
      { sourceLoopId: loopId, sourceActionId: build.id, outputId: "ready", targetLoopId: loopId, targetActionId: review.id },
      { sourceLoopId: loopId, sourceActionId: review.id, outputId: "changes-requested", targetLoopId: loopId, targetActionId: done.id }
    ]);
  });
});

describe("nextConfigWithLoopHandlerAction route cleanup", () => {
  it("rewrites scoped routes and removes stale human gate responses when a loop step action changes", () => {
    const start = action({ id: "start-review", outputIds: ["rejected"], agentIds: ["reviewer"] });
    const gate = action({ id: "gate-review", outputIds: ["rejected"], humanGate: true });
    const done = action({ id: "done-review", outputIds: [], agentIds: [] });
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
