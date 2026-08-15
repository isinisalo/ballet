import { describe, expect, it } from "vitest";
import type { ProjectScheduledStep, ProjectStepSchedule } from "../../../shared/domain/automation.js";
import { scheduleDefinitionHash } from "../ScheduleDefinition.js";

const step = (
  schedule: ProjectStepSchedule,
  overrides: Partial<ProjectScheduledStep> = {}
): ProjectScheduledStep => ({
  id: "scheduled-work",
  type: "scheduled",
  executionProfileId: "primary",
  primaryInstructionId: "project:scheduled-work",
  skillIds: ["project:checks"],
  description: "Run scheduled work.",
  nodeStyle: "luna",
  nodeSize: "tiny",
  schedule,
  on: { approved: "completed", rejected: "blocked" },
  ...overrides
});

describe("schedule definition hash", () => {
  it("is stable across object key and weekday ordering", () => {
    const left: ProjectStepSchedule = {
      kind: "recurring",
      startsOn: "2026-07-12",
      time: "09:00",
      timeZone: "Europe/Helsinki",
      cadence: "weekly",
      weekdays: ["fri", "mon", "fri"]
    };
    const right: ProjectStepSchedule = {
      weekdays: ["mon", "fri"],
      cadence: "weekly",
      timeZone: "Europe/Helsinki",
      time: "09:00",
      startsOn: "2026-07-12",
      kind: "recurring"
    };

    const leftHash = scheduleDefinitionHash(step(left, {
      skillIds: ["project:zeta", "project:alpha"]
    }));
    const rightHash = scheduleDefinitionHash(step(right, {
      skillIds: ["project:alpha", "project:zeta"]
    }));
    expect(leftHash).toBe(rightHash);
    expect(leftHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when an occurrence-defining field changes", () => {
    const schedule: ProjectStepSchedule = {
      kind: "once",
      date: "2026-07-12",
      time: "09:00",
      timeZone: "Europe/Helsinki"
    };

    const original = scheduleDefinitionHash(step(schedule));
    expect(original).not.toBe(scheduleDefinitionHash(step({ ...schedule, time: "10:00" })));
    expect(original).not.toBe(scheduleDefinitionHash(step(schedule, { executionProfileId: "secondary" })));
    expect(original).not.toBe(scheduleDefinitionHash(step(schedule, {
      primaryInstructionId: "project:alternate"
    })));
    expect(original).not.toBe(scheduleDefinitionHash(step(schedule, { skillIds: ["project:review"] })));
  });
});
