import { describe, expect, it } from "vitest";
import type { ProjectStepSchedule } from "../../../shared/domain/automation.js";
import { scheduleDefinitionHash } from "../ScheduleDefinition.js";

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

    expect(scheduleDefinitionHash(left, "agent-a")).toBe(scheduleDefinitionHash(right, "agent-a"));
    expect(scheduleDefinitionHash(left, "agent-a")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when an occurrence-defining field changes", () => {
    const schedule: ProjectStepSchedule = {
      kind: "once",
      date: "2026-07-12",
      time: "09:00",
      timeZone: "Europe/Helsinki"
    };

    expect(scheduleDefinitionHash(schedule, "agent-a")).not.toBe(scheduleDefinitionHash({
      ...schedule,
      time: "10:00"
    }, "agent-a"));
    expect(scheduleDefinitionHash(schedule, "agent-a"))
      .not.toBe(scheduleDefinitionHash(schedule, "agent-b"));
  });
});
