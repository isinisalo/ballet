import { describe, expect, it } from "vitest";
import type { ProjectScheduledJobNode, ProjectJobSchedule } from "../../../shared/domain/automation.js";
import { scheduleDefinitionHash } from "../ScheduleDefinition.js";
import {
  latestScheduleOccurrenceBefore,
  nextScheduleOccurrence,
  scheduleOccurrenceAtOrAfter
} from "../ScheduleOccurrences.js";

const scheduledJob = (schedule: ProjectJobSchedule): ProjectScheduledJobNode => ({
  id: "scheduled-job",
  description: "Run the scheduled Job.",
  validationNodeId: "scheduled-job-validation",
  maxRetries: 3,
  type: "scheduled",
  task: "Run scheduled work.",
  executionProfileId: "codex-test",
  primaryInstructionId: "project:worker",
  skillIds: ["project:beta", "project:alpha"],
  nodeStyle: "terra",
  nodeSize: "medium",
  schedule
});

describe("strict-v12 Job Node schedules", () => {
  it("hashes normalized provider composition and schedule deterministically", () => {
    const schedule: ProjectJobSchedule = {
      kind: "recurring",
      cadence: "weekly",
      startsOn: "2026-08-10",
      weekdays: ["fri", "mon"],
      time: "09:00",
      timeZone: "Europe/Helsinki"
    };
    const left = scheduledJob(schedule);
    const right: ProjectScheduledJobNode = {
      ...left,
      skillIds: [...left.skillIds].reverse(),
      schedule: { ...schedule, weekdays: ["mon", "fri"] }
    };
    expect(scheduleDefinitionHash(left)).toBe(scheduleDefinitionHash(right));
  });

  it("changes the definition hash when occurrence or provider composition changes", () => {
    const schedule: ProjectJobSchedule = {
      kind: "once",
      date: "2026-08-16",
      time: "09:00",
      timeZone: "Europe/Helsinki"
    };
    const original = scheduledJob(schedule);
    const hash = scheduleDefinitionHash(original);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(scheduleDefinitionHash({ ...original, schedule: { ...schedule, time: "10:00" } })).not.toBe(hash);
    expect(scheduleDefinitionHash({ ...original, executionProfileId: "other-profile" })).not.toBe(hash);
    expect(scheduleDefinitionHash({ ...original, primaryInstructionId: "project:other" })).not.toBe(hash);
    expect(scheduleDefinitionHash({ ...original, skillIds: ["project:other"] })).not.toBe(hash);
  });

  it("calculates recurring occurrences using the configured IANA time zone", () => {
    const schedule: ProjectJobSchedule = {
      kind: "recurring",
      cadence: "daily",
      startsOn: "2026-08-15",
      time: "09:00",
      timeZone: "Europe/Helsinki"
    };
    expect(scheduleOccurrenceAtOrAfter(schedule, "2026-08-15T00:00:00.000Z")).toBe("2026-08-15T06:00:00.000Z");
    expect(nextScheduleOccurrence(schedule, "2026-08-15T06:00:00.000Z")).toBe("2026-08-16T06:00:00.000Z");
    expect(latestScheduleOccurrenceBefore(schedule, "2026-08-16T06:00:00.000Z")).toBe("2026-08-15T06:00:00.000Z");
  });
});
