import { describe, expect, it } from "vitest";
import {
  parseMilestoneLoopHandoff,
  validateLoopTransitionHandoff
} from "../../shared/domain/loopHandoff.js";

describe("milestone Loop handoff", () => {
  it("parses a milestone and repeated GitHub issue declarations", () => {
    expect(parseMilestoneLoopHandoff([
      "Human approval: continue.",
      "milestone_id: milestone-001",
      "github_issue: isinisalo/ballet#123",
      "github_issue: isinisalo/ballet#124"
    ].join("\n"))).toEqual({
      milestoneId: "milestone-001",
      githubIssues: ["isinisalo/ballet#123", "isinisalo/ballet#124"]
    });
  });

  it.each([
    ["missing milestone", "github_issue: isinisalo/ballet#123", "exactly one line in the form milestone_id"],
    ["malformed milestone", "milestone_id: milestone-1\ngithub_issue: isinisalo/ballet#123", "exactly one line in the form milestone_id"],
    ["missing issue", "milestone_id: milestone-001", "at least one line in the form github_issue"],
    ["malformed issue", "milestone_id: milestone-001\ngithub_issue: isinisalo/ballet/123", "at least one line in the form github_issue"]
  ])("rejects %s", (_case, input, message) => {
    expect(() => parseMilestoneLoopHandoff(input)).toThrow(message);
  });

  it("rejects duplicate GitHub issue declarations", () => {
    expect(() => parseMilestoneLoopHandoff([
      "milestone_id: milestone-001",
      "github_issue: isinisalo/ballet#123",
      "github_issue: isinisalo/ballet#123"
    ].join("\n"))).toThrow("duplicate github_issue declarations");
  });

  it("validates only gated Loop transitions", () => {
    expect(() => validateLoopTransitionHandoff("blueprint-design", "invalid")).not.toThrow();
    expect(() => validateLoopTransitionHandoff("milestone-planning", "milestone_id: milestone-001")).toThrow();
  });
});
