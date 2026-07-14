import { createHash } from "node:crypto";
import type { ProjectStepSchedule } from "../../shared/domain/automation.js";

const weekdayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const normalizedDefinition = (schedule: ProjectStepSchedule): unknown => {
  if (schedule.kind !== "recurring" || schedule.cadence !== "weekly") return schedule;
  const weekdays = [...new Set(schedule.weekdays)]
    .sort((left, right) => weekdayOrder.indexOf(left) - weekdayOrder.indexOf(right));
  return { ...schedule, weekdays };
};

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

export const scheduleDefinitionHash = (schedule: ProjectStepSchedule, agentId: string): string =>
  createHash("sha256")
    .update(canonicalJson({ schedule: normalizedDefinition(schedule), agentId }))
    .digest("hex");
