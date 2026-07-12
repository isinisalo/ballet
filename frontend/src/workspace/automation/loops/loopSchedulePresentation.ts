import {
  clockTimePattern,
  isCalendarDate,
  isIanaTimeZone,
  type ProjectScheduleWeekday,
  type ProjectStepSchedule
} from "@shared/api/workspace-contracts";

export type RecurringStepSchedule = Extract<ProjectStepSchedule, { kind: "recurring" }>;
export type ScheduleField = "date" | "startsOn" | "time" | "timeZone" | "weekdays" | "dayOfMonth";
export type ScheduleErrors = Partial<Record<ScheduleField, string>>;

const weekdayLabels: Record<ProjectScheduleWeekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun"
} as const;

export const scheduleWeekdays = Object.keys(weekdayLabels) as ProjectScheduleWeekday[];

export function defaultOnceSchedule(now = new Date()): ProjectStepSchedule {
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return {
    kind: "once",
    date: localDate(nextHour),
    time: `${pad(nextHour.getHours())}:00`,
    timeZone: browserTimeZone()
  };
}

export function changeScheduleKind(schedule: ProjectStepSchedule, kind: ProjectStepSchedule["kind"]): ProjectStepSchedule {
  if (schedule.kind === kind) return schedule;
  if (kind === "once") {
    return { kind: "once", date: schedule.kind === "recurring" ? schedule.startsOn : "", time: schedule.time, timeZone: schedule.timeZone };
  }
  return {
    kind: "recurring",
    cadence: "daily",
    startsOn: schedule.kind === "once" ? schedule.date : "",
    time: schedule.time,
    timeZone: schedule.timeZone
  };
}

export function changeScheduleCadence(schedule: RecurringStepSchedule, cadence: RecurringStepSchedule["cadence"]): RecurringStepSchedule {
  const base = { kind: "recurring" as const, startsOn: schedule.startsOn, time: schedule.time, timeZone: schedule.timeZone };
  if (cadence === "weekly") return { ...base, cadence, weekdays: schedule.cadence === "weekly" ? schedule.weekdays : ["mon"] };
  if (cadence === "monthly") return { ...base, cadence, dayOfMonth: schedule.cadence === "monthly" ? schedule.dayOfMonth : 1 };
  return { ...base, cadence };
}

export function validateSchedule(schedule: ProjectStepSchedule): ScheduleErrors {
  const errors: ScheduleErrors = {};
  if (schedule.kind === "once" && !isCalendarDate(schedule.date)) errors.date = "Enter a valid start date.";
  if (schedule.kind === "recurring" && !isCalendarDate(schedule.startsOn)) errors.startsOn = "Enter a valid start date.";
  if (!clockTimePattern.test(schedule.time)) errors.time = "Use a 24-hour time (HH:mm).";
  if (!isIanaTimeZone(schedule.timeZone)) errors.timeZone = "Enter a valid IANA time zone.";
  if (schedule.kind === "recurring" && schedule.cadence === "weekly" && schedule.weekdays.length === 0) {
    errors.weekdays = "Select at least one weekday.";
  }
  if (schedule.kind === "recurring" && schedule.cadence === "monthly" && (!Number.isInteger(schedule.dayOfMonth) || schedule.dayOfMonth < 1 || schedule.dayOfMonth > 31)) {
    errors.dayOfMonth = "Day must be between 1 and 31.";
  }
  return errors;
}

export function scheduleSummary(schedule: ProjectStepSchedule): string {
  if (schedule.kind === "once") return `Once ${schedule.date} · ${schedule.time} · ${schedule.timeZone}`;
  if (schedule.cadence === "daily") return `Daily · ${schedule.time} · ${schedule.timeZone}`;
  if (schedule.cadence === "weekdays") return `Weekdays · ${schedule.time} · ${schedule.timeZone}`;
  if (schedule.cadence === "weekly") {
    const days = schedule.weekdays.map((day) => weekdayLabels[day]).join(", ");
    return `${days || "Weekly"} · ${schedule.time} · ${schedule.timeZone}`;
  }
  return `Monthly day ${schedule.dayOfMonth} · ${schedule.time} · ${schedule.timeZone}`;
}

export const scheduleWeekdayLabel = (weekday: ProjectScheduleWeekday) => weekdayLabels[weekday];

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

const localDate = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const pad = (value: number) => String(value).padStart(2, "0");
