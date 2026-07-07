import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputTargetsByOutputId } from "../src/workspace/automation/actions/actionOutputTargets";

const config = (): Pick<ProjectAutomationConfig, "outputRoutes" | "policies"> => ({
  outputRoutes: [{
    sourcePolicyId: "human-review-policy",
    outputId: "approved",
    target: { type: "trigger", trigger: "approved" }
  }],
  policies: [
    { id: "review-policy", source: "event", event: "review.ready", action: "review", enabled: true },
    { id: "human-review-policy", source: "event", event: "review.approved", action: "human-review", enabled: true }
  ]
});

describe("actionOutputTargetsByOutputId", () => {
  it("labels event outputs with the generated event type", () => {
    expect(actionOutputTargetsByOutputId(config(), "review", ["accepted"])).toEqual({
      accepted: { type: "event", id: "review.accepted", label: "review.accepted" }
    });
  });

  it("prefers trigger output routes for trigger-targeted outputs", () => {
    expect(actionOutputTargetsByOutputId(config(), "human-review", ["approved", "changes_requested"])).toEqual({
      approved: { type: "trigger", id: "approved", label: "approved" },
      changes_requested: { type: "event", id: "human-review.changes_requested", label: "human-review.changes_requested" }
    });
  });
});
