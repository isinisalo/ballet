import type { Direction, UseCase } from "./direction.js";
import { hasValidUseCaseApproval } from "./direction.js";
import type { ActionDefinition, EnvironmentDefinition, StateDefinition } from "./environment.js";
import { VNEXT_LIMITS } from "./limits.js";
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

const validateReferences = (useCaseIds: string[], direction: Direction, path: string): ContractIssue[] => {
  const byId = new Map<string, UseCase>(direction.useCases.map((useCase) => [useCase.id, useCase]));
  if (useCaseIds.length === 0) return [{ code: "empty_use_case_binding", path, message: "At least one Use Case is required" }];
  return useCaseIds.flatMap((id, index) => {
    const useCase = byId.get(id);
    if (!useCase) return [{ code: "unknown_use_case", path: `${path}.${index}`, message: `Unknown Use Case ${id}` }];
    if (!hasValidUseCaseApproval(useCase)) {
      return [{ code: "unapproved_use_case", path: `${path}.${index}`, message: `Use Case ${id} is not approved` }];
    }
    const issues: ContractIssue[] = [];
    const targets = [
      ["goal", useCase.goalIds, new Map(direction.goals.map((item) => [item.id, item]))],
      ["adr", useCase.adrIds, new Map(direction.adrs.map((item) => [item.id, item]))],
      ["constraint", useCase.constraintIds, new Map(direction.constraints.map((item) => [item.id, item]))]
    ] as const;
    for (const [kind, references, available] of targets) {
      for (const reference of references) {
        const target = available.get(reference);
        if (!target) issues.push({ code: `missing_${kind}_reference`, path: `${path}.${index}`, message: `${id} references missing ${kind} ${reference}` });
        else if (target.status !== "accepted") issues.push({ code: `inactive_${kind}_reference`, path: `${path}.${index}`, message: `${id} references non-accepted ${kind} ${reference}` });
      }
    }
    return issues;
  });
};

export const validateRunnableEnvironment = (environment: EnvironmentDefinition, direction: Direction): ContractIssue[] => {
  const issues: ContractIssue[] = [];
  if (environment.states.length === 0) issues.push({ code: "empty_environment", path: "environment.states", message: "Environment needs a State" });
  issues.push(...duplicateNumberIssues(environment.states.map(({ order }) => order), "environment.states", "duplicate_state_order"));
  const actionCount = environment.states.reduce((count, state) => count + state.actions.length, 0);
  if (actionCount > VNEXT_LIMITS.actionsTotal) issues.push({ code: "too_many_actions", path: "environment.states", message: "Environment action limit exceeded" });
  for (const [stateIndex, state] of environment.states.entries()) {
    const statePath = `environment.states.${stateIndex}`;
    if (state.actions.length === 0) issues.push({ code: "empty_state", path: `${statePath}.actions`, message: "State needs an Action" });
    issues.push(...validateReferences(state.useCaseIds, direction, `${statePath}.useCaseIds`));
    issues.push(...duplicateNumberIssues(state.actions.map(({ priority }) => priority), `${statePath}.actions`, "duplicate_action_priority"));
    for (const [actionIndex, action] of state.actions.entries()) {
      issues.push(...validateReferences(action.useCaseIds, direction, `${statePath}.actions.${actionIndex}.useCaseIds`));
    }
  }
  return issues;
};
