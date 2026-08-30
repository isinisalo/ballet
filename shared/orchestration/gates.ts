import type { ActionDefinition, EnvironmentDefinition, StateDefinition } from "./environment.js";
import { CONTRACT_LIMITS } from "./limits.js";
import type { ContractIssue } from "./primitives.js";
import type { ActionExecution, StateExecution } from "./runtime.js";

export const orderedStates = <T extends Pick<StateDefinition, "id" | "order">>(states: T[]): T[] => (
  [...states].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
);

export const orderedActions = <T extends Pick<ActionDefinition, "id" | "priority">>(actions: T[]): T[] => (
  [...actions].sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
);

export const validateUniqueStateOrder = (states: Pick<StateDefinition, "order">[]): ContractIssue[] => (
  duplicateNumberIssues(states.map(({ order }) => order), "states", "duplicate_state_order")
);

export const validateUniqueActionPriority = (actions: Pick<ActionDefinition, "priority">[]): ContractIssue[] => (
  duplicateNumberIssues(actions.map(({ priority }) => priority), "actions", "duplicate_action_priority")
);

export const actionFlags = (status: ActionExecution["status"]): { done: boolean; blocked: boolean } => ({
  done: status === "done",
  blocked: status === "blocked"
});

export const stateFlags = (actions: ActionExecution[]): { done: boolean; blocked: boolean } => ({
  done: actions.length > 0 && actions.every((action) => action.status === "done"),
  blocked: actions.some((action) => action.status === "blocked")
});

export const deriveActionFlags = actionFlags;

export type DerivedStateStatus = "pending" | "running" | "blocked" | "done";
export type DerivedEnvironmentStatus = "pending" | "running" | "blocked" | "completed";

export const deriveStateStatus = (actions: ActionExecution[]): DerivedStateStatus => {
  if (actions.some((action) => action.status === "blocked")) return "blocked";
  if (actions.length > 0 && actions.every((action) => action.status === "done")) return "done";
  return actions.some((action) => action.status !== "pending") ? "running" : "pending";
};

export const deriveEnvironmentStatus = (states: StateExecution[]): DerivedEnvironmentStatus => {
  if (states.some((state) => state.status === "blocked")) return "blocked";
  if (states.length > 0 && states.every((state) => state.status === "done")) return "completed";
  return states.some((state) => state.status !== "pending") ? "running" : "pending";
};

export const nextRunnableState = (states: StateExecution[]): StateExecution | undefined => {
  const ordered = [...states].sort((left, right) => left.order - right.order);
  const firstOpen = ordered.find((state) => state.status !== "done");
  if (!firstOpen || firstOpen.status === "blocked" || firstOpen.status === "cancelled" || firstOpen.status === "interrupted") return undefined;
  return firstOpen.status === "pending" || firstOpen.status === "running" ? firstOpen : undefined;
};

export const nextRunnableAction = (actions: ActionExecution[]): ActionExecution | undefined => {
  const ordered = [...actions].sort((left, right) => left.priority - right.priority);
  const firstOpen = ordered.find((action) => action.status !== "done");
  return firstOpen?.status === "pending" ? firstOpen : undefined;
};

export interface RetryBudget {
  totalAttempts: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  retriesRemaining: number;
  exhausted: boolean;
}

export const retryBudget = (maxRetries: number, workAttempts: number): RetryBudget => {
  const totalAttempts = 1 + maxRetries;
  const attemptsUsed = Math.max(0, workAttempts);
  const attemptsRemaining = Math.max(0, totalAttempts - attemptsUsed);
  return {
    totalAttempts,
    attemptsUsed,
    attemptsRemaining,
    retriesRemaining: Math.max(0, maxRetries - Math.max(0, attemptsUsed - 1)),
    exhausted: attemptsUsed >= totalAttempts
  };
};

export const calculateRetryBudget = retryBudget;

const duplicateNumberIssues = (values: number[], path: string, code: string): ContractIssue[] => {
  const seen = new Set<number>();
  return values.flatMap((value, index) => {
    if (seen.has(value)) return [{ code, path: `${path}.${index}`, message: `Duplicate value ${value}` }];
    seen.add(value);
    return [];
  });
};

export const validateRunnableEnvironment = (environment: EnvironmentDefinition): ContractIssue[] => {
  const issues: ContractIssue[] = [];
  if (environment.states.length === 0) issues.push({ code: "empty_environment", path: "environment.states", message: "Environment needs a State" });
  issues.push(...duplicateNumberIssues(environment.states.map(({ order }) => order), "environment.states", "duplicate_state_order"));
  const actionCount = environment.states.reduce((count, state) => count + state.actions.length, 0);
  if (actionCount > CONTRACT_LIMITS.actionsTotal) issues.push({ code: "too_many_actions", path: "environment.states", message: "Environment action limit exceeded" });
  for (const [stateIndex, state] of environment.states.entries()) {
    const statePath = `environment.states.${stateIndex}`;
    if (state.actions.length === 0) issues.push({ code: "empty_state", path: `${statePath}.actions`, message: "State needs an Action" });
    issues.push(...duplicateNumberIssues(state.actions.map(({ priority }) => priority), `${statePath}.actions`, "duplicate_action_priority"));
  }
  return issues;
};
