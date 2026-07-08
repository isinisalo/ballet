import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import {
  workflowOutputTargetCanSelectTrigger,
  workflowOutputTargetDisplay,
  workflowOutputEventTargetDisplay,
  workflowOutputTargetFromSelectValue,
  workflowOutputTargetSelectValue
} from "../src/workspace/automation/workflows/workflowOutputTargetRules";

const config = (): ProjectAutomationConfig => ({
  version: 1,
  actions: [
    { id: "review", description: "Review.", outputIds: ["approved", "changes_requested"], agentIds: ["reviewer-agent"] },
    { id: "human-review", description: "Human review.", outputIds: ["approved", "changes_requested"], agentIds: [], humanGate: true }
  ],
  outputs: [{ id: "approved" }, { id: "changes_requested" }],
  outputRoutes: [],
  humanGateResponses: [],
  policies: [
    { id: "agent-review-policy", source: "event", event: "review.ready", action: "review", enabled: true },
    { id: "human-review-policy", source: "event", event: "review.approved", action: "human-review", enabled: true }
  ],
  workflows: [],
  runtimes: []
});

describe("workflow output target rules", () => {
  it("does not expose manual trigger target selection", () => {
    const current = config();

    expect(workflowOutputTargetCanSelectTrigger(current, "human-review-policy", "approved")).toBe(false);
    expect(workflowOutputTargetCanSelectTrigger(current, "human-review-policy", "changes_requested")).toBe(false);
    expect(workflowOutputTargetCanSelectTrigger(current, "agent-review-policy", "approved")).toBe(false);
  });

  it("keeps output target select values event-only", () => {
    const current = config();

    expect(workflowOutputTargetSelectValue(current, "human-review-policy", "approved")).toBe("event");
    expect(workflowOutputTargetSelectValue(current, "human-review-policy", "changes_requested")).toBe("event");
    expect(workflowOutputTargetFromSelectValue("trigger:approved")).toBeUndefined();
    expect(workflowOutputTargetFromSelectValue("event")).toBeUndefined();
  });

  it("formats selected output targets for event and trigger badges", () => {
    const current = config();

    expect(workflowOutputTargetDisplay(current, "human-review-policy", "approved")).toEqual({
      type: "trigger",
      label: "human-review.approved"
    });
    expect(workflowOutputTargetDisplay(current, "human-review-policy", "changes_requested")).toEqual({
      type: "event",
      label: "human-review.changes_requested"
    });
    expect(workflowOutputEventTargetDisplay(current, "human-review-policy", "approved")).toEqual({
      type: "event",
      label: "human-review.approved"
    });
  });
});
