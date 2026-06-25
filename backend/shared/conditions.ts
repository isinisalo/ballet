import type { JsonValue } from "./json.js";
import { getByJsonPointer } from "./json-pointer.js";

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | {
      path: string;
      op: "eq" | "neq" | "in" | "contains" | "exists" | "gt" | "gte" | "lt" | "lte" | "matches";
      value?: JsonValue;
    };

export interface ConditionTrace {
  path?: string;
  op?: string;
  expected?: JsonValue;
  actual?: unknown;
  result: boolean;
  reason?: string;
  children?: ConditionTrace[];
}

export interface ConditionResult {
  matched: boolean;
  trace: ConditionTrace;
}

export class ConditionEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConditionEvaluationError";
  }
}

const conditionOps = new Set(["eq", "neq", "in", "contains", "exists", "gt", "gte", "lt", "lte", "matches"]);

const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

const isConditionRecord = (condition: unknown): condition is Record<string, unknown> =>
  Boolean(condition) && typeof condition === "object" && !Array.isArray(condition);

export const assertCondition = (condition: unknown, location = "condition"): void => {
  if (!isConditionRecord(condition)) throw new ConditionEvaluationError(`${location} must be an object.`);

  if ("all" in condition) {
    if (!hasOnlyKeys(condition, ["all"]) || !Array.isArray(condition.all)) throw new ConditionEvaluationError(`${location}.all must be an array.`);
    condition.all.forEach((child, index) => assertCondition(child, `${location}.all[${index}]`));
    return;
  }

  if ("any" in condition) {
    if (!hasOnlyKeys(condition, ["any"]) || !Array.isArray(condition.any)) throw new ConditionEvaluationError(`${location}.any must be an array.`);
    condition.any.forEach((child, index) => assertCondition(child, `${location}.any[${index}]`));
    return;
  }

  if ("not" in condition) {
    if (!hasOnlyKeys(condition, ["not"])) throw new ConditionEvaluationError(`${location}.not has unexpected sibling keys.`);
    assertCondition(condition.not, `${location}.not`);
    return;
  }

  if (typeof condition.path !== "string" || !condition.path.startsWith("/")) {
    throw new ConditionEvaluationError(`${location}.path must be a JSON Pointer.`);
  }
  if (typeof condition.op !== "string" || !conditionOps.has(condition.op)) {
    throw new ConditionEvaluationError(`${location}.op is invalid.`);
  }
};

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const numericCompare = (actual: unknown, expected: unknown, op: "gt" | "gte" | "lt" | "lte"): boolean => {
  if (typeof actual !== "number" || typeof expected !== "number") return false;
  if (op === "gt") return actual > expected;
  if (op === "gte") return actual >= expected;
  if (op === "lt") return actual < expected;
  return actual <= expected;
};

const safeRegex = (pattern: unknown): RegExp => {
  if (typeof pattern !== "string") throw new ConditionEvaluationError("matches condition requires a string value.");
  if (pattern.length > 256) throw new ConditionEvaluationError("matches condition pattern is too long.");
  try {
    return new RegExp(pattern);
  } catch (error) {
    throw new ConditionEvaluationError(`matches condition pattern is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const evaluateLeaf = (condition: Extract<Condition, { path: string }>, context: unknown): ConditionTrace => {
  const lookup = getByJsonPointer(context, condition.path);
  const actual = lookup.value;
  let result = false;

  switch (condition.op) {
    case "exists":
      result = condition.value === undefined ? lookup.found : lookup.found === Boolean(condition.value);
      break;
    case "eq":
      result = lookup.found && sameJson(actual, condition.value);
      break;
    case "neq":
      result = !lookup.found || !sameJson(actual, condition.value);
      break;
    case "in":
      result = Array.isArray(condition.value) && lookup.found && condition.value.some((item) => sameJson(item, actual));
      break;
    case "contains":
      result = lookup.found && (
        Array.isArray(actual)
          ? actual.some((item) => sameJson(item, condition.value))
          : typeof actual === "string" && typeof condition.value === "string" && actual.includes(condition.value)
      );
      break;
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      result = lookup.found && numericCompare(actual, condition.value, condition.op);
      break;
    case "matches":
      result = lookup.found && typeof actual === "string" && safeRegex(condition.value).test(actual);
      break;
  }

  return {
    path: condition.path,
    op: condition.op,
    expected: condition.value,
    actual,
    result,
    reason: lookup.found ? undefined : "path_missing"
  };
};

const evaluate = (condition: Condition, context: unknown): ConditionTrace => {
  if ("all" in condition) {
    const children = condition.all.map((child) => evaluate(child, context));
    return { result: children.every((trace) => trace.result), children };
  }
  if ("any" in condition) {
    const children = condition.any.map((child) => evaluate(child, context));
    return { result: children.some((trace) => trace.result), children };
  }
  if ("not" in condition) {
    const child = evaluate(condition.not, context);
    return { result: !child.result, children: [child] };
  }
  return evaluateLeaf(condition, context);
};

export const evaluateCondition = (condition: Condition | undefined, context: unknown): ConditionResult => {
  if (!condition) return { matched: true, trace: { result: true, reason: "no_condition" } };
  assertCondition(condition);
  const trace = evaluate(condition as Condition, context);
  return { matched: trace.result, trace };
};
