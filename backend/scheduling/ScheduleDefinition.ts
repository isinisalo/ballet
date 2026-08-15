import { createHash } from "node:crypto";
import type { ProjectScheduledWorkNode, ProjectWorkSchedule } from "../../shared/domain/automation.js";

const weekdayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const scheduleDefinitionHash = (work: ProjectScheduledWorkNode): string => {
  const value = JSON.stringify({
    schedule: normalizedSchedule(work.schedule),
    executionProfileId: work.executionProfileId,
    primaryInstructionId: work.primaryInstructionId,
    skillIds: [...work.skillIds].sort(compareText)
  });
  return createHash("sha256").update(value, "utf8").digest("hex");
};

const normalizedSchedule = (schedule: ProjectWorkSchedule): object => {
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
