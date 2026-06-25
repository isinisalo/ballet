import { describe, expect, it } from "vitest";
import { getByJsonPointer } from "../shared/json-pointer.js";
import { evaluateMapping, MappingEvaluationError } from "../shared/mapping.js";

const context = {
  event: {
    data: {
      goal: "Implement contracts",
      "slash/key": "escaped slash",
      "tilde~key": "escaped tilde",
      tags: ["planning", "delivery"]
    },
    subject: "work-1"
  },
  run: {
    id: "run-1"
  }
};

describe("JSON Pointer and mapping evaluator", () => {
  it("looks up nested paths and escaped segments", () => {
    expect(getByJsonPointer(context, "/event/data/goal")).toEqual({ found: true, value: "Implement contracts" });
    expect(getByJsonPointer(context, "/event/data/slash~1key")).toEqual({ found: true, value: "escaped slash" });
    expect(getByJsonPointer(context, "/event/data/tilde~0key")).toEqual({ found: true, value: "escaped tilde" });
  });

  it("builds deterministic objects, arrays, constants, defaults, and templates", () => {
    expect(evaluateMapping({
      object: {
        workItemId: { from: "/event/subject" },
        goal: { from: "/event/data/goal" },
        missingWithDefault: { from: "/event/data/missing", default: [] },
        constant: { const: 42 },
        tags: { array: [{ from: "/event/data/tags/0" }, { const: "agent" }] },
        dedupe: { template: "emission:{{/run/id}}:slot" }
      }
    }, context)).toEqual({
      workItemId: "work-1",
      goal: "Implement contracts",
      missingWithDefault: [],
      constant: 42,
      tags: ["planning", "agent"],
      dedupe: "emission:run-1:slot"
    });
  });

  it("coalesces the first defined result", () => {
    expect(evaluateMapping({
      coalesce: [
        { from: "/event/data/missing" },
        { from: "/event/data/goal" },
        { const: "fallback" }
      ]
    }, context)).toBe("Implement contracts");
  });

  it("reports missing required values with policy and path context", () => {
    expect(() => evaluateMapping({ from: "/event/data/missing" }, context, { policyId: "policy-1" }))
      .toThrow(MappingEvaluationError);
    expect(() => evaluateMapping({ from: "/event/data/missing" }, context, { policyId: "policy-1" }))
      .toThrow("policy=policy-1");
    expect(() => evaluateMapping({ from: "/event/data/missing" }, context, { policyId: "policy-1" }))
      .toThrow("path=/event/data/missing");
  });
});

