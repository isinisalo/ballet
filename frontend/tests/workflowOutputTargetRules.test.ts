import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import {
  workflowOutputTargetCanSelectTrigger,
  workflowOutputTargetFromSelectValue,
  workflowOutputTargetSelectValue
} from "../src/workspace/automation/workflows/workflowOutputTargetRules";

const config = (): ProjectAutomationConfig => ({
  version: 1,
  triggers: [{ id: "approved", description: "Approved" }],
  actions: [
    { id: "review", description: "Review.", outputIds: ["approved", "changes_requested"], agentIds: ["reviewer-agent"] },
    { id: "human-review", description: "Human review.", outputIds: ["approved", "changes_requested"], agentIds: [], humanGate: true }
  ],
  outputs: [{ id: "approved" }, { id: "changes_requested" }],
  outputRoutes: [{
    sourcePolicyId: "human-review-policy",
    outputId: "approved",
    target: { type: "trigger", trigger: "approved" }
  }],
  humanGateResponses: [],
  policies: [
    { id: "agent-review-policy", source: "event", event: "review.ready", action: "review", enabled: true },
    { id: "human-review-policy", source: "event", event: "review.approved", action: "human-review", enabled: true }
  ],
  workflows: [],
  runtimes: []
});

describe("workflow output target rules", () => {
  it("allows trigger targets only for human gate approval outputs", () => {
    const current = config();

    expect(workflowOutputTargetCanSelectTrigger(current, "human-review-policy", "approved")).toBe(true);
    expect(workflowOutputTargetCanSelectTrigger(current, "human-review-policy", "changes_requested")).toBe(false);
    expect(workflowOutputTargetCanSelectTrigger(current, "agent-review-policy", "approved")).toBe(false);
  });

  it("reads and writes trigger target select values", () => {
    const current = config();

    expect(workflowOutputTargetSelectValue(current, "human-review-policy", "approved")).toBe("trigger:approved");
    expect(workflowOutputTargetSelectValue(current, "human-review-policy", "changes_requested")).toBe("event");
    expect(workflowOutputTargetFromSelectValue("trigger:approved")).toEqual({ type: "trigger", trigger: "approved" });
    expect(workflowOutputTargetFromSelectValue("event")).toBeUndefined();
  });
});
