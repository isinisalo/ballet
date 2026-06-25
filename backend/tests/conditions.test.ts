import { describe, expect, it } from "vitest";
import { assertCondition, evaluateCondition } from "../shared/conditions.js";

const context = {
  event: {
    data: {
      approvalStatus: "approved",
      count: 3,
      tags: ["delivery", "urgent"],
      text: "release-123"
    }
  },
  output: {
    status: "completed",
    result: {
      decision: "approved"
    }
  }
};

describe("condition evaluator", () => {
  it("supports all, any, not, equality, and inequality", () => {
    const result = evaluateCondition({
      all: [
        { path: "/event/data/approvalStatus", op: "eq", value: "approved" },
        { path: "/output/result/decision", op: "neq", value: "changes_requested" },
        {
          any: [
            { path: "/event/data/missing", op: "exists", value: true },
            { not: { path: "/output/status", op: "eq", value: "failed" } }
          ]
        }
      ]
    }, context);

    expect(result.matched).toBe(true);
    expect(result.trace.children).toHaveLength(3);
  });

  it("supports in, contains, exists, numeric comparisons, and matches", () => {
    expect(evaluateCondition({ path: "/event/data/approvalStatus", op: "in", value: ["approved", "ready"] }, context).matched).toBe(true);
    expect(evaluateCondition({ path: "/event/data/tags", op: "contains", value: "urgent" }, context).matched).toBe(true);
    expect(evaluateCondition({ path: "/event/data/count", op: "gte", value: 3 }, context).matched).toBe(true);
    expect(evaluateCondition({ path: "/event/data/count", op: "lt", value: 5 }, context).matched).toBe(true);
    expect(evaluateCondition({ path: "/event/data/text", op: "matches", value: "^release-\\d+$" }, context).matched).toBe(true);
    expect(evaluateCondition({ path: "/event/data/missing", op: "exists", value: false }, context).matched).toBe(true);
  });

  it("rejects invalid condition configuration", () => {
    expect(() => assertCondition({ path: "event.data", op: "eq", value: "approved" })).toThrow("JSON Pointer");
    expect(() => assertCondition({ path: "/event/data", op: "contains_bad", value: "approved" })).toThrow("op is invalid");
  });
});

