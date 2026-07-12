import { describe, expect, it } from "vitest";
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
});
