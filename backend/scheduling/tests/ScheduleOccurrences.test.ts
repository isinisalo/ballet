import { Temporal } from "@js-temporal/polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectStepSchedule } from "../../../shared/domain/automation.js";
import {
  initialScheduleOccurrence,
  latestScheduleOccurrenceBefore,
  nextScheduleOccurrence,
  scheduleOccurrenceAtOrAfter
} from "../ScheduleOccurrences.js";

type DailyOverrides = Partial<Pick<
  Extract<ProjectStepSchedule, { kind: "recurring" }>,
  "startsOn" | "time" | "timeZone"
>>;

const daily = (overrides: DailyOverrides = {}): ProjectStepSchedule => ({
  kind: "recurring",
  startsOn: "2026-07-12",
  time: "09:00",
  timeZone: "Europe/Helsinki",
  cadence: "daily",
  ...overrides
});

afterEach(() => {
  vi.useRealTimers();
});

describe("schedule occurrence boundaries", () => {
  it("uses an injectable clock and includes an occurrence exactly at now", () => {
    const clock = { now: () => Temporal.Instant.from("2026-07-12T06:00:00.000Z") };
    expect(initialScheduleOccurrence(daily(), clock)).toBe("2026-07-12T06:00:00.000Z");
  });

  it("uses the fake system date with the default clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T05:59:00.000Z"));
    expect(initialScheduleOccurrence(daily())).toBe("2026-07-12T06:00:00.000Z");
  });

  it("treats next and latest boundaries as strict", () => {
    const schedule = daily();
    expect(scheduleOccurrenceAtOrAfter(schedule, "2026-07-12T06:00:00.000Z"))
      .toBe("2026-07-12T06:00:00.000Z");
    expect(nextScheduleOccurrence(schedule, "2026-07-12T06:00:00.000Z"))
      .toBe("2026-07-13T06:00:00.000Z");
    expect(latestScheduleOccurrenceBefore(schedule, "2026-07-13T06:00:00.000Z"))
      .toBe("2026-07-12T06:00:00.000Z");
  });
});

describe("one-time schedules", () => {
  const schedule: ProjectStepSchedule = {
    kind: "once",
    date: "2026-12-01",
    time: "09:00",
    timeZone: "America/New_York"
  };

  it("maps the local calendar time through its IANA time zone", () => {
    expect(scheduleOccurrenceAtOrAfter(schedule, "2026-12-01T13:59:59.999Z"))
      .toBe("2026-12-01T14:00:00.000Z");
  });

  it("has no next occurrence after firing", () => {
    expect(nextScheduleOccurrence(schedule, "2026-12-01T14:00:00.000Z")).toBeUndefined();
    expect(scheduleOccurrenceAtOrAfter(schedule, "2026-12-01T14:00:00.001Z")).toBeUndefined();
  });

  it("only reports the occurrence as latest after its instant", () => {
    expect(latestScheduleOccurrenceBefore(schedule, "2026-12-01T14:00:00.000Z")).toBeUndefined();
    expect(latestScheduleOccurrenceBefore(schedule, "2026-12-01T14:00:00.001Z"))
      .toBe("2026-12-01T14:00:00.000Z");
  });
});

describe("recurring cadences", () => {
  it("runs daily from startsOn in local calendar time", () => {
    expect(scheduleOccurrenceAtOrAfter(daily(), "2026-01-01T00:00:00.000Z"))
      .toBe("2026-07-12T06:00:00.000Z");
    expect(nextScheduleOccurrence(daily(), "2026-07-12T06:00:00.001Z"))
      .toBe("2026-07-13T06:00:00.000Z");
  });

  it("skips weekends for the weekdays cadence", () => {
    const schedule: ProjectStepSchedule = {
      kind: "recurring",
      startsOn: "2026-07-10",
      time: "09:00",
      timeZone: "UTC",
      cadence: "weekdays"
    };
    expect(nextScheduleOccurrence(schedule, "2026-07-10T09:00:00.000Z"))
      .toBe("2026-07-13T09:00:00.000Z");
  });

  it("uses selected weekdays on and after startsOn", () => {
    const schedule: ProjectStepSchedule = {
      kind: "recurring",
      startsOn: "2026-07-08",
      time: "09:00",
      timeZone: "UTC",
      cadence: "weekly",
      weekdays: ["tue", "thu"]
    };
    expect(scheduleOccurrenceAtOrAfter(schedule, "2026-07-01T00:00:00.000Z"))
      .toBe("2026-07-09T09:00:00.000Z");
    expect(nextScheduleOccurrence(schedule, "2026-07-09T09:00:00.000Z"))
      .toBe("2026-07-14T09:00:00.000Z");
  });

  it("skips months that do not contain dayOfMonth", () => {
    const schedule: ProjectStepSchedule = {
      kind: "recurring",
      startsOn: "2026-01-30",
      time: "10:00",
      timeZone: "UTC",
      cadence: "monthly",
      dayOfMonth: 31
    };
    expect(scheduleOccurrenceAtOrAfter(schedule, "2026-01-01T00:00:00.000Z"))
      .toBe("2026-01-31T10:00:00.000Z");
    expect(nextScheduleOccurrence(schedule, "2026-01-31T10:00:00.000Z"))
      .toBe("2026-03-31T10:00:00.000Z");
    expect(latestScheduleOccurrenceBefore(schedule, "2026-03-31T10:00:00.000Z"))
      .toBe("2026-01-31T10:00:00.000Z");
  });

  it("does not backdate a monthly occurrence before startsOn", () => {
    const schedule: ProjectStepSchedule = {
      kind: "recurring",
      startsOn: "2026-01-20",
      time: "10:00",
      timeZone: "UTC",
      cadence: "monthly",
      dayOfMonth: 15
    };
    expect(scheduleOccurrenceAtOrAfter(schedule, "2026-01-01T00:00:00.000Z"))
      .toBe("2026-02-15T10:00:00.000Z");
    expect(latestScheduleOccurrenceBefore(schedule, "2026-02-15T10:00:00.000Z"))
      .toBeUndefined();
  });
});

describe("Temporal compatible DST behavior", () => {
  it("moves a nonexistent wall time forward by the DST gap", () => {
    const schedule = daily({ startsOn: "2026-03-29", time: "03:30" });
    expect(scheduleOccurrenceAtOrAfter(schedule, "2026-03-28T00:00:00.000Z"))
      .toBe("2026-03-29T01:30:00.000Z");
  });

  it("chooses the earlier instant for a repeated wall time", () => {
    const schedule = daily({ startsOn: "2026-10-25", time: "03:30" });
    expect(scheduleOccurrenceAtOrAfter(schedule, "2026-10-24T00:00:00.000Z"))
      .toBe("2026-10-25T00:30:00.000Z");
    expect(nextScheduleOccurrence(schedule, "2026-10-25T00:30:00.000Z"))
      .toBe("2026-10-26T01:30:00.000Z");
  });
});
