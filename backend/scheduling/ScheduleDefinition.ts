import { createHash } from "node:crypto";
import type { ProjectScheduledStep, ProjectStepSchedule } from "../../shared/domain/automation.js";

const weekdayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const scheduleDefinitionHash = (step: ProjectScheduledStep): string => {
  const value = JSON.stringify({
    schedule: normalizedSchedule(step.schedule),
    executionProfileId: step.executionProfileId,
    primaryInstructionId: step.primaryInstructionId,
    skillIds: [...step.skillIds].sort(compareText)
  });
  return createHash("sha256").update(value, "utf8").digest("hex");
};

const normalizedSchedule = (schedule: ProjectStepSchedule): object => {
  if (schedule.kind === "once") return {
    kind: "once",
    date: schedule.date,
    time: schedule.time,
    timeZone: schedule.timeZone
  };
  const base = {
    kind: "recurring",
    cadence: schedule.cadence,
    startsOn: schedule.startsOn,
    time: schedule.time,
    timeZone: schedule.timeZone
  };
  if (schedule.cadence === "weekly") return {
    ...base,
    weekdays: [...new Set(schedule.weekdays)]
      .sort((left, right) => weekdayOrder.indexOf(left) - weekdayOrder.indexOf(right))
  };
  if (schedule.cadence === "monthly") return { ...base, dayOfMonth: schedule.dayOfMonth };
  return base;
};

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
