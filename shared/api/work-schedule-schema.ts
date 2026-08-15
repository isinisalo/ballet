import { z } from "zod";
import {
  clockTimePattern,
  isCalendarDate,
  isIanaTimeZone,
  type ProjectWorkSchedule
} from "../domain/automation.js";

const calendarDateSchema = z.string().refine(isCalendarDate, "Expected a valid date in YYYY-MM-DD format.");
const clockTimeSchema = z.string().regex(clockTimePattern, "Expected a valid time in HH:mm format.");
const timeZoneSchema = z.string().min(1).refine(isIanaTimeZone, "Expected a valid IANA time zone.");
const scheduleBase = {
  time: clockTimeSchema,
  timeZone: timeZoneSchema
};
const recurringScheduleBase = {
  ...scheduleBase,
  kind: z.literal("recurring"),
  startsOn: calendarDateSchema
};
const scheduleWeekdaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const recurringScheduleSchema = z.discriminatedUnion("cadence", [
  z.object({ ...recurringScheduleBase, cadence: z.literal("daily") }).strict(),
  z.object({ ...recurringScheduleBase, cadence: z.literal("weekdays") }).strict(),
  z.object({
    ...recurringScheduleBase,
    cadence: z.literal("weekly"),
    weekdays: z.array(scheduleWeekdaySchema)
      .min(1)
      .refine((days) => new Set(days).size === days.length, "Weekdays must be unique.")
  }).strict(),
  z.object({
    ...recurringScheduleBase,
    cadence: z.literal("monthly"),
    dayOfMonth: z.number().int().min(1).max(31)
  }).strict()
]);

export const projectWorkScheduleSchema = z.union([
  z.object({
    ...scheduleBase,
    kind: z.literal("once"),
    date: calendarDateSchema
  }).strict(),
  recurringScheduleSchema
]) satisfies z.ZodType<ProjectWorkSchedule>;
