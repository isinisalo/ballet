import { Temporal } from "@js-temporal/polyfill";
import type {
  ProjectRecurringStepSchedule,
  ProjectScheduleWeekday,
  ProjectStepSchedule
} from "../../shared/domain/automation.js";
import { systemScheduleClock, type ScheduleClock } from "./ScheduleClock.js";

export type ScheduleInstantInput = Temporal.Instant | Date | string;

const weekdayNumbers: Record<ProjectScheduleWeekday, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7
};

const asInstant = (value: ScheduleInstantInput): Temporal.Instant => {
  if (value instanceof Date) return Temporal.Instant.fromEpochMilliseconds(value.getTime());
  return typeof value === "string" ? Temporal.Instant.from(value) : value;
};

const asIsoString = (instant: Temporal.Instant): string =>
  instant.toString({ smallestUnit: "millisecond" });

const occurrenceInstant = (
  schedule: ProjectStepSchedule,
  date: Temporal.PlainDate
): Temporal.Instant => date
  .toPlainDateTime(Temporal.PlainTime.from(schedule.time))
  .toZonedDateTime(schedule.timeZone, { disambiguation: "compatible" })
  .toInstant();

const laterDate = (left: Temporal.PlainDate, right: Temporal.PlainDate): Temporal.PlainDate =>
  Temporal.PlainDate.compare(left, right) >= 0 ? left : right;

const matchesDate = (
  schedule: ProjectRecurringStepSchedule,
  date: Temporal.PlainDate
): boolean => {
  if (Temporal.PlainDate.compare(date, Temporal.PlainDate.from(schedule.startsOn)) < 0) return false;
  if (schedule.cadence === "daily") return true;
  if (schedule.cadence === "weekdays") return date.dayOfWeek <= 5;
  if (schedule.cadence === "weekly") {
    return schedule.weekdays.some((weekday) => weekdayNumbers[weekday] === date.dayOfWeek);
  }
  return date.day === schedule.dayOfMonth;
};

const nextMatchingDate = (
  schedule: ProjectRecurringStepSchedule,
  from: Temporal.PlainDate
): Temporal.PlainDate => {
  let date = laterDate(from, Temporal.PlainDate.from(schedule.startsOn));
  while (!matchesDate(schedule, date)) date = date.add({ days: 1 });
  return date;
};

const previousMatchingDate = (
  schedule: ProjectRecurringStepSchedule,
  from: Temporal.PlainDate
): Temporal.PlainDate | undefined => {
  const startsOn = Temporal.PlainDate.from(schedule.startsOn);
  let date = from;
  while (Temporal.PlainDate.compare(date, startsOn) >= 0) {
    if (matchesDate(schedule, date)) return date;
    date = date.subtract({ days: 1 });
  }
  return undefined;
};

const recurringAtOrAfter = (
  schedule: ProjectRecurringStepSchedule,
  threshold: Temporal.Instant
): Temporal.Instant => {
  const localDate = threshold.toZonedDateTimeISO(schedule.timeZone).toPlainDate();
  let date = nextMatchingDate(schedule, localDate);
  let candidate = occurrenceInstant(schedule, date);
  while (Temporal.Instant.compare(candidate, threshold) < 0) {
    date = nextMatchingDate(schedule, date.add({ days: 1 }));
    candidate = occurrenceInstant(schedule, date);
  }
  return candidate;
};

const occurrenceAtOrAfter = (
  schedule: ProjectStepSchedule,
  threshold: Temporal.Instant
): Temporal.Instant | undefined => {
  if (schedule.kind === "recurring") return recurringAtOrAfter(schedule, threshold);
  const occurrence = occurrenceInstant(schedule, Temporal.PlainDate.from(schedule.date));
  return Temporal.Instant.compare(occurrence, threshold) >= 0 ? occurrence : undefined;
};

/** Returns the first occurrence whose instant is greater than or equal to `atOrAfter`. */
export const scheduleOccurrenceAtOrAfter = (
  schedule: ProjectStepSchedule,
  atOrAfter: ScheduleInstantInput
): string | undefined => {
  const occurrence = occurrenceAtOrAfter(schedule, asInstant(atOrAfter));
  return occurrence ? asIsoString(occurrence) : undefined;
};

/** Uses an injectable clock to establish a new schedule cursor. */
export const initialScheduleOccurrence = (
  schedule: ProjectStepSchedule,
  clock: ScheduleClock = systemScheduleClock
): string | undefined => scheduleOccurrenceAtOrAfter(schedule, clock.now());

/** Returns the first occurrence strictly later than `after`. */
export const nextScheduleOccurrence = (
  schedule: ProjectStepSchedule,
  after: ScheduleInstantInput
): string | undefined => {
  const threshold = asInstant(after).add({ nanoseconds: 1 });
  const occurrence = occurrenceAtOrAfter(schedule, threshold);
  return occurrence ? asIsoString(occurrence) : undefined;
};

/** Returns the most recent occurrence strictly earlier than `before`. */
export const latestScheduleOccurrenceBefore = (
  schedule: ProjectStepSchedule,
  before: ScheduleInstantInput
): string | undefined => {
  const threshold = asInstant(before);
  if (schedule.kind === "once") {
    const occurrence = occurrenceInstant(schedule, Temporal.PlainDate.from(schedule.date));
    return Temporal.Instant.compare(occurrence, threshold) < 0 ? asIsoString(occurrence) : undefined;
  }
  const localDate = threshold.toZonedDateTimeISO(schedule.timeZone).toPlainDate();
  let date = previousMatchingDate(schedule, localDate);
  while (date) {
    const occurrence = occurrenceInstant(schedule, date);
    if (Temporal.Instant.compare(occurrence, threshold) < 0) return asIsoString(occurrence);
    date = previousMatchingDate(schedule, date.subtract({ days: 1 }));
  }
  return undefined;
};
