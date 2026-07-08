import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { describe, expect, it } from "vitest";
import {
    loopOutputEventTargetDisplay,
    loopOutputTargetCanSelectTrigger,
    loopOutputTargetDisplay,
    loopOutputTargetFromSelectValue,
    loopOutputTargetSelectValue
} from "../src/workspace/automation/loops/loopOutputTargetRules";

const config = (): ProjectAutomationConfig => ({
  version: 1,
  actions: [
    { id: "review", description: "Review.", outputIds: ["approved", "changes-requested"], agentIds: ["reviewer-agent"] },
    { id: "human-review", description: "Human review.", outputIds: ["approved", "changes-requested"], agentIds: [], humanGate: true }
  ],
  outputs: [{ id: "approved" }, { id: "changes-requested" }],
  outputRoutes: [],
  humanGateResponses: [],
  policies: [
    { id: "agent-review-policy", source: "event", event: "review.ready", action: "review", enabled: true },
    { id: "human-review-policy", source: "event", event: "review.approved", action: "human-review", enabled: true }
  ],
  loops: [],
  runtimes: []
});

describe("loop output target rules", () => {
  it("does not expose manual trigger target selection", () => {
    const current = config();

    expect(loopOutputTargetCanSelectTrigger(current, "human-review-policy", "approved")).toBe(false);
    expect(loopOutputTargetCanSelectTrigger(current, "human-review-policy", "changes-requested")).toBe(false);
    expect(loopOutputTargetCanSelectTrigger(current, "agent-review-policy", "approved")).toBe(false);
  });

  it("keeps output target select values event-only", () => {
    const current = config();

    expect(loopOutputTargetSelectValue(current, "human-review-policy", "approved")).toBe("event");
    expect(loopOutputTargetSelectValue(current, "human-review-policy", "changes-requested")).toBe("event");
    expect(loopOutputTargetFromSelectValue("trigger:approved")).toBeUndefined();
    expect(loopOutputTargetFromSelectValue("event")).toBeUndefined();
  });

  it("formats selected output targets for event and trigger badges", () => {
    const current = config();

    expect(loopOutputTargetDisplay(current, "human-review-policy", "approved")).toEqual({
      type: "trigger",
      label: "human-review.approved"
    });
    expect(loopOutputTargetDisplay(current, "human-review-policy", "changes-requested")).toEqual({
      type: "event",
      label: "human-review.changes-requested"
    });
    expect(loopOutputEventTargetDisplay(current, "human-review-policy", "approved")).toEqual({
      type: "event",
      label: "human-review.approved"
    });
  });
});
