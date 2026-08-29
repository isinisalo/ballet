import { describe, expect, it } from "vitest";
import { approvalProjection, normalizeSchedule, readinessGroups, reorderStates, reprioritizeActions, skillImpactWarning } from "../src/vnext/authoringModels";
import { vNextConfig } from "./vnextFixtures";

describe("vNext authoring pure models", () => {
  it("reorders States and assigns unique ascending order", () => { const states = reorderStates(vNextConfig().environment.states, "state-2", -1); expect(states.map(({ id, order }) => [id, order])).toEqual([["state-2", 1], ["state-1", 2]]); });
  it("keeps State order stable at a boundary", () => { const states = vNextConfig().environment.states; expect(reorderStates(states, "state-1", -1)).toEqual(states); });
  it("reprioritizes Actions deterministically", () => { const action = vNextConfig().environment.states[0]!.actions[0]!; const actions = reprioritizeActions([action, { ...action, id: "action-0", priority: 0 }], "action-1", -1); expect(actions.map(({ id, priority }) => [id, priority])).toEqual([["action-1", 1], ["action-0", 2]]); });
  it("projects approved semantic edits as draft invalidation", () => { const useCase = vNextConfig().direction.useCases[0]!; expect(approvalProjection(useCase, { ...useCase, name: "Changed" })).toEqual({ invalidatesApproval: true, nextStatus: "draft" }); });
  it("groups readiness issues by owner path", () => { const config = vNextConfig(); config.environment.states[0]!.actions = []; expect(Object.keys(readinessGroups(config.environment, config.direction))).toContain("environment.states.0"); });
  it("shows shared Skill reverse impact", () => { expect(skillImpactWarning("skill", [{ kind: "skill", id: "skill", references: [{}, {}] }])).toBe("Shared Skill impacts 2 referencing roles."); });
  it("normalizes schedule timezone, time and weekdays", () => { expect(normalizeSchedule({ id: "weekly", kind: "weekly", timeZone: " UTC ", localTimes: ["09:00", "09:00"], weekdays: [5, 1, 5] })).toEqual({ id: "weekly", kind: "weekly", timeZone: "UTC", localTimes: ["09:00"], weekdays: [1, 5] }); });
});
