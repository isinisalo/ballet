import { describe, expect, it } from "vitest";
import {
  validationNodeOutcomeJsonSchema, workNodeOutcomeJsonSchema
} from "../../../shared/api/runtime-schemas.js";
import { parseStructuredJson } from "../providers/structuredOutput.js";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "checks"],
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 5 },
    checks: { type: "array", maxItems: 1, items: { type: "string" } }
  }
};

describe("structured output validation", () => {
  it("enforces bounded strings, arrays, and unknown fields before repair decisions", () => {
    expect(parseStructuredJson('{"summary":"too long","checks":[]}', schema).error).toContain("maxLength");
    expect(parseStructuredJson('{"summary":"ok","checks":["a","b"]}', schema).error).toContain("maxItems");
    expect(parseStructuredJson('{"summary":"ok","checks":[],"extra":true}', schema).error).toContain("not allowed");
    expect(parseStructuredJson('{"summary":"ok","checks":[]}', schema)).toEqual({
      value: { summary: "ok", checks: [] }
    });
  });

  it("validates generated role unions instead of accepting provider prose as control flow", () => {
    const work = JSON.stringify({
      role: "work", state: "completed", summary: "Done.", artifacts: {}, checks: []
    });
    const invalidDecision = JSON.stringify({
      role: "work", state: "completed", decision: "OK", summary: "Invalid.", artifacts: {}, checks: []
    });
    const validation = JSON.stringify({
      role: "validation", state: "completed", decision: "FAIL", summary: "Retry.", evidence: {}, checks: [],
      repair: { mode: "LOCAL_RETRY", feedback: "Fix it.", expectedCorrection: "Correct the value." }
    });
    expect(parseStructuredJson(work, workNodeOutcomeJsonSchema)).toEqual({ value: JSON.parse(work) });
    expect(parseStructuredJson(invalidDecision, workNodeOutcomeJsonSchema).error).toContain("anyOf");
    expect(parseStructuredJson(validation, validationNodeOutcomeJsonSchema)).toEqual({ value: JSON.parse(validation) });
  });
});
