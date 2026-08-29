import type { JsonValue, RefinementProposalSeed } from "../../../shared/vnext/index.js";
import { canonicalJson, sha256 } from "../../../shared/vnext/primitives.js";
import { VNextConflictError } from "./VNextErrors.js";

export const refinementChangeListHash = (input: RefinementProposalSeed): string => sha256(canonical({
  targetActionId: input.targetActionId,
  expectedBaseCommit: input.expectedBaseCommit,
  impactScope: input.impactScope,
  expectedBehavioralImprovement: input.expectedBehavioralImprovement,
  risks: input.risks,
  validationPlan: input.validationPlan,
  rollback: input.rollback,
  files: [...input.files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}));

export const canonicalReviewValue = (value: unknown): string => canonical(value);

export const assertReviewHash = (value: JsonValue, expected: string, label: string): void => {
  if (sha256(canonical(value)) !== expected) throw new VNextConflictError(`${label} hash does not match.`);
};

export const impactActionIds = (value: unknown): string[] => {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  const actionIds = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "actionIds") : undefined;
  if (!Array.isArray(actionIds) || actionIds.some((id) => typeof id !== "string")) {
    throw new VNextConflictError("Refinement impact scope has no exact Action IDs.");
  }
  return [...new Set(actionIds)].sort();
};

export const readReviewString = (row: unknown, key: string): string => {
  const value = typeof row === "object" && row !== null ? Reflect.get(row, key) : undefined;
  if (typeof value !== "string") throw new Error(`SQLite returned invalid ${key}.`);
  return value;
};

export const readReviewInteger = (row: unknown, key: string): number => {
  const value = typeof row === "object" && row !== null ? Reflect.get(row, key) : undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`SQLite returned invalid ${key}.`);
  return value;
};

const canonical = (value: unknown): string => canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue);
