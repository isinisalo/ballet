import { Temporal } from "@js-temporal/polyfill";
import type { CriticScheduleDefinition } from "../../../shared/orchestration/environment.js";

export const nextCriticDue = (schedule: CriticScheduleDefinition, after: string): string => {
  const instant = Temporal.Instant.from(after);
  const zoned = instant.toZonedDateTimeISO(schedule.timeZone);
  let date = zoned.toPlainDate();
  for (let dayOffset = 0; dayOffset <= 8; dayOffset += 1) {
    if (dayOffset > 0) date = date.add({ days: 1 });
    if (schedule.kind === "weekly" && !schedule.weekdays.includes(date.dayOfWeek)) continue;
    for (const localTime of [...schedule.localTimes].sort()) {
      const [hour, minute] = localTime.split(":").map(Number) as [number, number];
      const candidate = Temporal.ZonedDateTime.from({
        timeZone: schedule.timeZone, year: date.year, month: date.month, day: date.day, hour, minute
      }, { disambiguation: "compatible" }).toInstant();
      if (Temporal.Instant.compare(candidate, instant) > 0) return candidate.toString();
    }
  }
  throw new Error(`Critic Schedule ${schedule.id} has no due instant in its bounded horizon.`);
};
