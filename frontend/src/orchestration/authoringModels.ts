import type { UseCase } from "@shared/orchestration/direction";
import type { CriticScheduleDefinition } from "@shared/orchestration/environment";
import { validateRunnableEnvironment } from "@shared/orchestration/gates";

export const approvalProjection = (previous: UseCase, next: UseCase) => ({
  invalidatesApproval: previous.status === "approved" && JSON.stringify(previous) !== JSON.stringify(next),
  nextStatus: previous.status === "approved" && JSON.stringify(previous) !== JSON.stringify(next) ? "draft" as const : next.status
});

export const readinessGroups = (environment: Parameters<typeof validateRunnableEnvironment>[0]) => {
  const issues = validateRunnableEnvironment(environment);
  return issues.reduce<Record<string, typeof issues>>((groups, issue) => {
    const key = issue.path.split(".").slice(0, 3).join(".");
    groups[key] = [...(groups[key] ?? []), issue];
    return groups;
  }, {});
};

export const skillImpactWarning = (skillId: string, entries: Array<{ kind: string; id: string; references: unknown[] }>) => {
  const count = entries.find((entry) => entry.kind === "skill" && entry.id === skillId)?.references.length ?? 0;
  return count > 0 ? `Shared Skill impacts ${count} referencing role${count === 1 ? "" : "s"}.` : "No current Action references.";
};

export const normalizeSchedule = (schedule: CriticScheduleDefinition): CriticScheduleDefinition => ({
  ...schedule,
  timeZone: schedule.timeZone.trim(),
  localTimes: [...new Set(schedule.localTimes.map((time) => time.trim()))].sort(),
  ...(schedule.kind === "weekly" ? { weekdays: [...new Set(schedule.weekdays)].sort((a, b) => a - b) } : {})
});
