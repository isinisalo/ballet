import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { describe, expect, it } from "vitest";
import {
  loopOutputEventTargetDisplay,
  loopOutputTargetDisplay,
  loopOutputTargetSelectValue
} from "../src/workspace/automation/loops/loopOutputTargetRules";

const loopId = "review.loop";

const config = (): Pick<ProjectAutomationConfig, "actions" | "outputRoutes"> => ({
  actions: [
    {
      id: "review",
      description: "Review.",
      agentId: "reviewer-agent"
    },
    {
      id: "human-review",
      description: "Human review.",
      humanGate: true
    }
  ],
  outputRoutes: []
});

describe("loop output target rules", () => {
  it("uses event select values until an explicit output route exists", () => {
    expect(loopOutputTargetSelectValue(config(), loopId, "human-review", "approved")).toBe("event");
    expect(loopOutputTargetSelectValue(config(), loopId, "human-review", "rejected")).toBe("event");
  });

  it("formats selected output targets for event badges", () => {
    expect(loopOutputTargetDisplay(config(), loopId, "human-review", "approved")).toEqual({
      type: "event",
      label: "review.loop.human-review.approved"
    });
    expect(loopOutputEventTargetDisplay(config(), loopId, "human-review", "approved")).toEqual({
      type: "event",
      label: "review.loop.human-review.approved"
    });
  });

  it("formats explicit action output targets", () => {
    const current = {
      ...config(),
      outputRoutes: [{
        sourceLoopId: loopId,
        sourceActionId: "review",
        outputId: "approved",
        targetLoopId: loopId,
        targetActionId: "human-review"
      }]
    };

    expect(loopOutputTargetDisplay(current, loopId, "review", "approved")).toEqual({
      type: "action",
      label: "human-review"
    });
    expect(loopOutputTargetSelectValue(current, loopId, "review", "approved")).toBe("action");
  });

  it("formats cross-loop action output targets with loop and action", () => {
    const current = {
      ...config(),
      outputRoutes: [{
        sourceLoopId: loopId,
        sourceActionId: "review",
        outputId: "approved",
        targetLoopId: "return.loop",
        targetActionId: "human-review"
      }]
    };

    expect(loopOutputTargetDisplay(current, loopId, "review", "approved")).toEqual({
      type: "action",
      label: "return.loop:human-review"
    });
  });
});
