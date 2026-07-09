import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputTargetsByOutputId } from "../src/workspace/automation/actions/actionOutputTargets";

const loopId = "review.loop";

const config = (): Pick<ProjectAutomationConfig, "actions" | "outputRoutes"> => ({
  actions: [
    {
      id: "review",
      description: "Review.",
      outputIds: ["accepted"],
      agentId: "reviewer-agent"
    },
    {
      id: "human-review",
      description: "Human review.",
      outputIds: ["approved", "changes-requested"],
      humanGate: true
    }
  ],
  outputRoutes: []
});

describe("actionOutputTargetsByOutputId", () => {
  it("labels event outputs with the generated action output event type", () => {
    expect(actionOutputTargetsByOutputId(config(), "review", ["accepted"])).toEqual({
      accepted: [{ type: "event", id: "review.accepted", label: "review.accepted" }]
    });
  });

  it("shows explicit output route targets as action handlers", () => {
    const current = {
      ...config(),
      outputRoutes: [{
        sourceLoopId: loopId,
        sourceActionId: "review",
        outputId: "accepted",
        targetLoopId: loopId,
        targetActionId: "human-review"
      }]
    };

    expect(actionOutputTargetsByOutputId(current, "review", ["accepted"])).toEqual({
      accepted: [{ type: "action", id: "review.loop:human-review", label: "human-review" }]
    });
  });

  it("derives event targets for human gate outputs", () => {
    expect(actionOutputTargetsByOutputId(config(), "human-review", ["approved", "changes-requested"])).toEqual({
      approved: [{ type: "event", id: "human-review.approved", label: "human-review.approved" }],
      "changes-requested": [{ type: "event", id: "human-review.changes-requested", label: "human-review.changes-requested" }]
    });
  });
});
