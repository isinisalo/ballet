import { canonicalJson, sha256, type JsonValue, type TimestampedApproval } from "./primitives.js";

export type DirectionStatus = "draft" | "accepted" | "superseded";

export interface DirectionReference {
  id: string;
  name: string;
  status: DirectionStatus;
}

export interface Constraint extends DirectionReference {
  kind: "required" | "prohibited";
  description: string;
  rationale: string;
  scope?: string;
}

export interface UseCaseExample {
  given: string;
  when: string;
  then: string;
}

export interface UseCase {
  id: string;
  name: string;
  status: "draft" | "approved";
  examples: UseCaseExample[];
  successGoals: string[];
  failureGoals: string[];
  expectedOutcomes: string[];
  goalIds: string[];
  adrIds: string[];
  constraintIds: string[];
  approval?: TimestampedApproval;
}

export interface Direction {
  goals: DirectionReference[];
  adrs: DirectionReference[];
  constraints: Constraint[];
  useCases: UseCase[];
}

const sortedUnique = (items: string[]): string[] => [...new Set(items)].sort();

export const useCaseApprovalContent = (useCase: UseCase): JsonValue => ({
  id: useCase.id,
  name: useCase.name,
  examples: useCase.examples.map(({ given, when, then }) => ({ given, when, then })),
  successGoals: sortedUnique(useCase.successGoals),
  failureGoals: sortedUnique(useCase.failureGoals),
  expectedOutcomes: sortedUnique(useCase.expectedOutcomes),
  goalIds: sortedUnique(useCase.goalIds),
  adrIds: sortedUnique(useCase.adrIds),
  constraintIds: sortedUnique(useCase.constraintIds)
});

export const useCaseApprovalHash = (useCase: UseCase): string => sha256(canonicalJson(useCaseApprovalContent(useCase)));

export const canTransitionUseCase = (from: UseCase["status"], to: UseCase["status"]): boolean => (
  (from === "draft" && to === "approved") || (from === "approved" && to === "draft")
);

export const approveUseCase = (
  useCase: UseCase,
  approval: Omit<TimestampedApproval, "contentHash">
): UseCase => ({
  ...useCase,
  status: "approved",
  approval: { ...approval, contentHash: useCaseApprovalHash(useCase) }
});

export const invalidateUseCaseApproval = (previous: UseCase, next: UseCase): UseCase => {
  if (previous.status !== "approved" || useCaseApprovalHash(previous) === useCaseApprovalHash(next)) return next;
  return { ...next, status: "draft", approval: undefined };
};

export const invalidateApprovalOnSemanticChange = invalidateUseCaseApproval;

export const hasValidUseCaseApproval = (useCase: UseCase): boolean => (
  useCase.status === "approved" && useCase.approval?.contentHash === useCaseApprovalHash(useCase)
);
