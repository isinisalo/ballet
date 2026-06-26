import type { Condition } from "backend/shared/conditions";
import type { DataShapeFieldDraft } from "backend/shared/flow";

export type ConditionOperator = "eq" | "neq" | "in" | "exists" | "contains" | "gt" | "gte" | "lt" | "lte" | "matches";

export interface LeafConditionDraft {
  kind?: "leaf";
  field: string;
  op: ConditionOperator;
  value: string;
}

export interface GroupConditionDraft {
  kind: "all" | "any";
  conditions: ConditionDraft[];
}

export interface NotConditionDraft {
  kind: "not";
  condition: ConditionDraft;
}

export type ConditionDraft = LeafConditionDraft | GroupConditionDraft | NotConditionDraft;

export const opLabels: Array<{ value: ConditionOperator; label: string }> = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "in", label: "is one of" },
  { value: "exists", label: "is present" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is at least" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is at most" },
  { value: "matches", label: "matches pattern" }
];

const pointerSegment = (value: string): string => value.replace(/~/g, "~0").replace(/\//g, "~1");
const unpointerSegment = (value: string): string => value.replace(/~1/g, "/").replace(/~0/g, "~");
const leafOps = new Set<ConditionOperator>(["eq", "neq", "in", "exists", "contains", "gt", "gte", "lt", "lte", "matches"]);
const isLeafCondition = (condition: Condition): condition is Extract<Condition, { path: string }> =>
  "path" in condition && typeof condition.path === "string" && leafOps.has(condition.op as ConditionOperator);

export const defaultLeafDraft = (fields: DataShapeFieldDraft[]): LeafConditionDraft => ({
  field: fields[0]?.name ?? "",
  op: "eq",
  value: ""
});

export const isLeafDraft = (draft: ConditionDraft): draft is LeafConditionDraft =>
  !("kind" in draft) || draft.kind === undefined || draft.kind === "leaf";

const operatorLabel = (op: ConditionOperator): string =>
  opLabels.find((item) => item.value === op)?.label ?? op;

const fieldLabel = (fields: DataShapeFieldDraft[], fieldName: string): string =>
  fields.find((field) => field.name === fieldName)?.label || fieldName || "field";

export const conditionDraftSummary = (draft: ConditionDraft, fields: DataShapeFieldDraft[] = []): string => {
  if (isLeafDraft(draft)) {
    const field = fieldLabel(fields, draft.field);
    if (!draft.field) return "When a field is selected";
    if (draft.op === "exists") return `When ${field} is present`;
    return `When ${field} ${operatorLabel(draft.op)} ${draft.value || "a value"}`;
  }
  if (draft.kind === "not") return `When not: ${conditionDraftSummary(draft.condition, fields)}`;
  return draft.kind === "all" ? "When all of these are true" : "When any of these is true";
};

export const conditionDraftToCondition = (draft: ConditionDraft, root = "/output/result"): Condition | undefined => {
  if (draft.kind === "all") {
    const conditions = draft.conditions.map((condition) => conditionDraftToCondition(condition, root)).filter((condition): condition is Condition => Boolean(condition));
    return conditions.length ? { all: conditions } : undefined;
  }
  if (draft.kind === "any") {
    const conditions = draft.conditions.map((condition) => conditionDraftToCondition(condition, root)).filter((condition): condition is Condition => Boolean(condition));
    return conditions.length ? { any: conditions } : undefined;
  }
  if (draft.kind === "not") {
    const condition = conditionDraftToCondition(draft.condition, root);
    return condition ? { not: condition } : undefined;
  }
  if (!isLeafDraft(draft)) return undefined;
  if (!draft.field) return undefined;
  if (draft.op === "exists") return { path: `${root}/${pointerSegment(draft.field)}`, op: "exists", value: true };
  const numeric = Number(draft.value);
  const value = ["gt", "gte", "lt", "lte"].includes(draft.op) && Number.isFinite(numeric)
    ? numeric
    : draft.op === "in"
      ? draft.value.split(",").map((item) => item.trim()).filter(Boolean)
      : draft.value;
  return { path: `${root}/${pointerSegment(draft.field)}`, op: draft.op, value };
};

export const conditionToConditionDraft = (condition: Condition | undefined, root = "/output/result"): ConditionDraft | undefined => {
  if (!condition) return undefined;
  if ("all" in condition) {
    return {
      kind: "all",
      conditions: condition.all.map((child) => conditionToConditionDraft(child, root)).filter((child): child is ConditionDraft => Boolean(child))
    };
  }
  if ("any" in condition) {
    return {
      kind: "any",
      conditions: condition.any.map((child) => conditionToConditionDraft(child, root)).filter((child): child is ConditionDraft => Boolean(child))
    };
  }
  if ("not" in condition) {
    const child = conditionToConditionDraft(condition.not, root);
    return child ? { kind: "not", condition: child } : undefined;
  }
  if (!isLeafCondition(condition) || !condition.path.startsWith(`${root}/`)) return undefined;
  const field = unpointerSegment(condition.path.slice(root.length + 1));
  const value = condition.op === "exists"
    ? ""
    : condition.op === "in" && Array.isArray(condition.value)
      ? condition.value.map(String).join(", ")
      : condition.value === undefined
        ? ""
        : String(condition.value);
  return {
    field,
    op: condition.op as ConditionOperator,
    value
  };
};
