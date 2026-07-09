import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { describe, expect, it } from "vitest";
import {
  loopOutputHandlerForOutput,
  loopOutputHandlerSelection,
  loopOutputTargetActionOptions
} from "../src/workspace/automation/loops/loopOutputHandlers";

const loopId = "delivery.loop";
const returnLoopId = "return.loop";

const config = (): ProjectAutomationConfig => ({
  version: 1,
  actions: [
    { id: "start", description: "Build.", agentId: "agent-1" },
    { id: "review", description: "Review.", agentId: "agent-1" },
    { id: "human-review", description: "Human review.", humanGate: true },
    { id: "return-start", description: "Build.", agentId: "agent-1" },
    { id: "rework", description: "Build.", agentId: "agent-1" },
    { id: "done", description: "Done." }
  ],
  outputRoutes: [{
    sourceLoopId: loopId,
    sourceActionId: "start",
    outputId: "approved",
    targetLoopId: loopId,
    targetActionId: "review"
  }, {
    sourceLoopId: returnLoopId,
    sourceActionId: "review",
    outputId: "rejected",
    targetLoopId: returnLoopId,
    targetActionId: "rework"
  }, {
    sourceLoopId: loopId,
    sourceActionId: "review",
    outputId: "approved",
    targetLoopId: loopId,
    targetActionId: "done"
  }],
  humanGateResponses: [],
  loops: [{
    id: loopId,
    steps: ["start", "review", "done"]
  }, {
    id: returnLoopId,
    steps: ["return-start", "rework", "review"]
  }],
  runtimes: []
});

describe("loopOutputHandlerForOutput", () => {
  it("finds the next action handler for an output route", () => {
    expect(loopOutputHandlerForOutput(config(), loopId, "start", "approved")).toEqual({
      type: "action",
      outputId: "approved",
      eventType: "delivery.loop.start.approved",
      actionId: "review",
      loopId,
      stepIndex: 1,
      label: "review"
    });
  });

  it("finds an earlier return handler action for a rework route", () => {
    expect(loopOutputHandlerForOutput(config(), returnLoopId, "review", "rejected")).toEqual({
      type: "action",
      outputId: "rejected",
      eventType: "return.loop.review.rejected",
      actionId: "rework",
      loopId: returnLoopId,
      stepIndex: 1,
      label: "rework"
    });
  });

  it("uses custom scoped output route target actions", () => {
    expect(loopOutputHandlerForOutput(config(), loopId, "review", "approved")).toEqual({
      type: "action",
      outputId: "approved",
      eventType: "delivery.loop.review.approved",
      actionId: "done",
      loopId,
      stepIndex: 2,
      label: "done"
    });
  });

  it("returns undefined for human gate approval outputs without a loop handler", () => {
    expect(loopOutputHandlerForOutput(config(), loopId, "human-review", "approved")).toBeUndefined();
  });

  it("returns undefined when an output has no loop handler", () => {
    expect(loopOutputHandlerForOutput(config(), loopId, "start", "rejected")).toBeUndefined();
  });
});

describe("loop output handler selection", () => {
  it("defaults the target loop to the edited action loop without selecting an action", () => {
    expect(loopOutputHandlerSelection(config(), loopId, "start", "rejected")).toEqual({
      targetLoopId: loopId,
      targetActionId: "",
      actionOptions: [
        { id: "start", label: "start · Build." },
        { id: "review", label: "review · Review." },
        { id: "done", label: "done · Done." }
      ]
    });
  });

  it("limits target action options to the selected loop steps", () => {
    expect(loopOutputTargetActionOptions(config(), returnLoopId)).toEqual([
      { id: "return-start", label: "return-start · Build." },
      { id: "rework", label: "rework · Build." },
      { id: "review", label: "review · Review." }
    ]);
  });

  it("returns cross-loop route selections", () => {
    const current = {
      ...config(),
      outputRoutes: [{
        sourceLoopId: loopId,
        sourceActionId: "start",
        outputId: "rejected",
        targetLoopId: returnLoopId,
        targetActionId: "rework"
      }]
    };

    expect(loopOutputHandlerSelection(current, loopId, "start", "rejected")).toEqual({
      targetLoopId: returnLoopId,
      targetActionId: "rework",
      actionOptions: [
        { id: "return-start", label: "return-start · Build." },
        { id: "rework", label: "rework · Build." },
        { id: "review", label: "review · Review." }
      ]
    });
  });
});
