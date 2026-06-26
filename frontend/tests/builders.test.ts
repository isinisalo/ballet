import { describe, expect, it } from "vitest";
import { evaluateMapping } from "../../backend/shared/mapping";
import { evaluateCondition } from "../../backend/shared/conditions";
import {
  mappingExpressionToRows,
  rowsToMappingExpression,
  type MappingRowDraft
} from "../src/components/mapping-builder/mapping-builder-model";
import {
  conditionDraftToCondition,
  conditionToConditionDraft,
  type ConditionDraft
} from "../src/components/condition-builder/condition-builder-model";

describe("MappingBuilder serialization", () => {
  it("round-trips common form rows through MappingExpression", () => {
    const rows: MappingRowDraft[] = [
      { target: "workItemId", sourceKind: "trigger-subject", defaultValue: "unknown" },
      { target: "projectId", sourceKind: "trigger-project" },
      { target: "firstTag", sourceKind: "trigger-tag", sourceField: "0" },
      { target: "goal", sourceKind: "trigger-field", sourceField: "goal", defaultValue: "No goal" },
      { target: "constraints", sourceKind: "default", defaultValue: "[]" },
      { target: "note", sourceKind: "constant", value: "Ready" },
      { target: "message", sourceKind: "template", value: "Launch {{/event/data/goal}}" }
    ];

    expect(mappingExpressionToRows(rowsToMappingExpression(rows))).toEqual(rows);
  });

  it("serializes to the existing deterministic mapping AST and evaluates correctly", () => {
    const mapping = rowsToMappingExpression([
      { target: "workItemId", sourceKind: "trigger-subject" },
      { target: "goal", sourceKind: "trigger-field", sourceField: "goal" },
      { target: "fallback", sourceKind: "default", defaultValue: "not supplied" },
      { target: "message", sourceKind: "template", value: "Goal: {{/event/data/goal}}" }
    ]);

    expect(mapping).toEqual({
      object: {
        workItemId: { from: "/event/subject" },
        goal: { from: "/event/data/goal" },
        fallback: { coalesce: [{ from: "/event/data/fallback" }, { const: "not supplied" }] },
        message: { template: "Goal: {{/event/data/goal}}" }
      }
    });
    expect(evaluateMapping(mapping, {
      event: {
        subject: "item-1",
        data: { goal: "Ship" }
      }
    })).toEqual({
      workItemId: "item-1",
      goal: "Ship",
      fallback: "not supplied",
      message: "Goal: Ship"
    });
  });
});

describe("ConditionBuilder serialization", () => {
  it("round-trips supported condition form rows through Condition", () => {
    const drafts: ConditionDraft[] = [
      { field: "decision", op: "eq", value: "Approved" },
      { field: "status", op: "in", value: "Approved, Changes requested" },
      { field: "score", op: "gte", value: "3" },
      { field: "summary", op: "matches", value: "^Done" },
      { field: "evidence", op: "exists", value: "" },
      {
        kind: "all",
        conditions: [
          { field: "status", op: "eq", value: "completed" },
          { field: "score", op: "gte", value: "3" }
        ]
      },
      {
        kind: "any",
        conditions: [
          { field: "decision", op: "eq", value: "Approved" },
          { field: "decision", op: "eq", value: "Changes requested" }
        ]
      },
      {
        kind: "not",
        condition: { field: "status", op: "eq", value: "failed" }
      }
    ];

    for (const draft of drafts) {
      expect(conditionToConditionDraft(conditionDraftToCondition(draft))).toEqual(draft);
    }
  });

  it("serializes conditions to the runtime Condition AST", () => {
    const condition = conditionDraftToCondition({ field: "score", op: "gte", value: "3" });

    expect(condition).toEqual({ path: "/output/result/score", op: "gte", value: 3 });
    expect(evaluateCondition(condition, { output: { result: { score: 4 } } }).matched).toBe(true);
    expect(evaluateCondition(condition, { output: { result: { score: 2 } } }).matched).toBe(false);
  });

  it("serializes composite conditions to the runtime Condition AST", () => {
    const condition = conditionDraftToCondition({
      kind: "all",
      conditions: [
        { field: "status", op: "eq", value: "completed" },
        {
          kind: "not",
          condition: { field: "decision", op: "eq", value: "Rejected" }
        }
      ]
    });

    expect(condition).toEqual({
      all: [
        { path: "/output/result/status", op: "eq", value: "completed" },
        { not: { path: "/output/result/decision", op: "eq", value: "Rejected" } }
      ]
    });
    expect(evaluateCondition(condition, { output: { result: { status: "completed", decision: "Approved" } } }).matched).toBe(true);
    expect(evaluateCondition(condition, { output: { result: { status: "completed", decision: "Rejected" } } }).matched).toBe(false);
  });
});
