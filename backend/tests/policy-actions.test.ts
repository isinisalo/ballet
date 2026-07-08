import { describe, expect, it } from "vitest";
import { generatedPolicyId, policyOutputEventType } from "../../shared/policy-actions.js";

describe("loop-aware policy action ids", () => {
  it("keeps legacy policy ids and output events unchanged without loop context", () => {
    expect(generatedPolicyId({
      source: "event",
      event: "create-roadmap.approved",
      action: "challenge-roadmap"
    })).toBe("on.create-roadmap.approved.start.challenge-roadmap");
    expect(policyOutputEventType({ action: "create-roadmap" }, "approved")).toBe("create-roadmap.approved");
  });

  it("includes the loop id in generated policy ids and output events", () => {
    expect(generatedPolicyId({
      loopId: "project-brief-gate.approved.loop",
      source: "event",
      event: "create-roadmap.approved",
      action: "challenge-roadmap"
    })).toBe("on.project-brief-gate.approved.loop.create-roadmap.approved.start.project-brief-gate.approved.loop.challenge-roadmap");
    expect(policyOutputEventType({
      loopId: "project-brief-gate.approved.loop",
      action: "create-roadmap"
    }, "approved")).toBe("project-brief-gate.approved.loop.create-roadmap.approved");
  });
});
