import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputTargetsByOutputId } from "../src/workspace/automation/actions/actionOutputTargets";

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

describe("actionOutputTargetsByOutputId", () => {
  it("labels event outputs with the generated action output event type", () => {
    expect(actionOutputTargetsByOutputId(config(), "review", ["approved"])).toEqual({
      approved: [{ type: "event", id: "review.approved", label: "review.approved" }]
    });
  });

  it("shows explicit output route targets as action handlers", () => {
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

    expect(actionOutputTargetsByOutputId(current, "review", ["approved"])).toEqual({
      approved: [{ type: "action", id: "review.loop:human-review", label: "human-review" }]
    });
  });

  it("derives event targets for human gate outputs", () => {
    expect(actionOutputTargetsByOutputId(config(), "human-review", ["approved", "rejected"])).toEqual({
      approved: [{ type: "event", id: "human-review.approved", label: "human-review.approved" }],
      rejected: [{ type: "event", id: "human-review.rejected", label: "human-review.rejected" }]
    });
  });
});
