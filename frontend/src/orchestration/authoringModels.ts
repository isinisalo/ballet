import type { UseCase } from "@shared/orchestration/direction";
import type { ActionDefinition, CriticScheduleDefinition, StateDefinition } from "@shared/orchestration/environment";
import { orderedActions, orderedStates, validateRunnableEnvironment } from "@shared/orchestration/gates";
import type { Direction } from "@shared/orchestration/direction";

export const moveBy = <T extends { id: string }>(items: T[], id: string, delta: -1 | 1): T[] => {
  const index = items.findIndex((item) => item.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const result = [...items]; [result[index], result[target]] = [result[target]!, result[index]!];
  return result;
};

export const reorderStates = (states: StateDefinition[], id: string, delta: -1 | 1): StateDefinition[] =>
  moveBy(orderedStates(states), id, delta).map((state, index) => ({ ...state, order: index + 1 }));

export const reprioritizeActions = (actions: ActionDefinition[], id: string, delta: -1 | 1): ActionDefinition[] =>
  moveBy(orderedActions(actions), id, delta).map((action, index) => ({ ...action, priority: index + 1 }));

export const approvalProjection = (previous: UseCase, next: UseCase) => ({
  invalidatesApproval: previous.status === "approved" && JSON.stringify(previous) !== JSON.stringify(next),
  nextStatus: previous.status === "approved" && JSON.stringify(previous) !== JSON.stringify(next) ? "draft" as const : next.status
});

export const readinessGroups = (environment: Parameters<typeof validateRunnableEnvironment>[0], direction: Direction) => {
  const issues = validateRunnableEnvironment(environment, direction);
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
