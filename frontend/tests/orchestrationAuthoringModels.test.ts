import { describe, expect, it } from "vitest";
import { approvalProjection, normalizeSchedule, readinessGroups, skillImpactWarning } from "../src/orchestration/authoringModels";
import { orchestrationConfig } from "./orchestrationFixtures";
import { authoringModels, unsupportedAuthoringModelMessage } from "../src/orchestration/configure/agentModelPolicy";

describe("orchestration authoring pure models", () => {
  it("projects approved semantic edits as draft invalidation", () => { const useCase = orchestrationConfig().direction.useCases[0]!; expect(approvalProjection(useCase, { ...useCase, name: "Changed" })).toEqual({ invalidatesApproval: true, nextStatus: "draft" }); });
  it("groups readiness issues by owner path", () => { const config = orchestrationConfig(); config.environment.states[0]!.actions = []; expect(Object.keys(readinessGroups(config.environment))).toContain("environment.states.0"); });
  it("shows shared Skill reverse impact", () => { expect(skillImpactWarning("skill", [{ kind: "skill", id: "skill", references: [{}, {}] }])).toBe("Shared Skill impacts 2 referencing roles."); });
  it("normalizes schedule timezone, time and weekdays", () => { expect(normalizeSchedule({ id: "weekly", kind: "weekly", timeZone: " UTC ", localTimes: ["09:00", "09:00"], weekdays: [5, 1, 5] })).toEqual({ id: "weekly", kind: "weekly", timeZone: "UTC", localTimes: ["09:00"], weekdays: [1, 5] }); });
  it("filters and orders authoring models as Sol, Terra and Luna", () => {
    const model = (id: string) => ({ id, label: id, reasoningOptions: ["medium"] });
    expect(authoringModels([model("gpt-5.6-luna"), model("gpt-5.5"), model("gpt-5.6-sol"), model("gpt-5.6-terra")]).map(({ id }) => id))
      .toEqual(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
    expect(unsupportedAuthoringModelMessage("gpt-5.5")).toContain("Choose gpt-5.6-sol, gpt-5.6-terra, or gpt-5.6-luna");
  });
});
