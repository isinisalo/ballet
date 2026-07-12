import { describe, expect, it } from "vitest";
import { changeScheduleCadence, changeScheduleKind, defaultOnceSchedule, scheduleSummary, validateSchedule } from "../src/workspace/automation/loops/loopSchedulePresentation";

describe("loop schedule presentation", () => {
  it("defaults a new scheduled start to the browser's next full hour", () => {
    expect(defaultOnceSchedule(new Date(2026, 6, 12, 10, 42))).toMatchObject({
      kind: "once",
      date: "2026-07-12",
      time: "11:00"
    });
  });

  it("converts schedule modes and cadences without losing shared calendar fields", () => {
    const recurring = changeScheduleKind({ kind: "once", date: "2026-07-12", time: "09:00", timeZone: "Europe/Helsinki" }, "recurring");
    expect(recurring).toEqual({ kind: "recurring", cadence: "daily", startsOn: "2026-07-12", time: "09:00", timeZone: "Europe/Helsinki" });
    if (recurring.kind !== "recurring") throw new Error("Expected recurring schedule");
    expect(changeScheduleCadence(recurring, "weekly")).toMatchObject({ cadence: "weekly", weekdays: ["mon"] });
    expect(changeScheduleCadence(recurring, "monthly")).toMatchObject({ cadence: "monthly", dayOfMonth: 1 });
  });

  it("validates strict calendar fields and formats one compact canvas line", () => {
    const weekly = { kind: "recurring" as const, cadence: "weekly" as const, startsOn: "2026-02-30", time: "24:00", timeZone: "Mars/Olympus", weekdays: [] };
    expect(validateSchedule(weekly)).toEqual({
      startsOn: "Enter a valid start date.",
      time: "Use a 24-hour time (HH:mm).",
      timeZone: "Enter a valid IANA time zone.",
      weekdays: "Select at least one weekday."
    });
    expect(scheduleSummary({ ...weekly, startsOn: "2026-02-28", time: "09:00", timeZone: "Europe/Helsinki", weekdays: ["mon", "wed"] })).toBe("Mon, Wed · 09:00 · Europe/Helsinki");
    expect(validateSchedule({ kind: "recurring", cadence: "monthly", startsOn: "2026-07-01", time: "09:00", timeZone: "UTC", dayOfMonth: 1.5 }))
      .toMatchObject({ dayOfMonth: "Day must be between 1 and 31." });
  });
});
