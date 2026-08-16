import { describe, expect, it } from "vitest";
import { respondToNodeRunBodySchema } from "../../shared/api/runtime-schemas.js";

describe("Human Node response contract", () => {
  it("accepts role-specific Work, Validation, and resume requests", () => {
    expect(respondToNodeRunBodySchema.safeParse({
      kind: "work",
      outcome: { role: "work", state: "completed", summary: "Done.", artifacts: {}, checks: [] }
    }).success).toBe(true);
    expect(respondToNodeRunBodySchema.safeParse({
      kind: "validation",
      outcome: {
        role: "validation", state: "completed", decision: "FAIL", summary: "Retry.",
        evidence: {}, checks: [],
        repair: { mode: "LOCAL_RETRY", feedback: "Fix it.", expectedCorrection: "Make it valid." }
      }
    }).success).toBe(true);
    expect(respondToNodeRunBodySchema.safeParse({ kind: "resume", response: "Continue with A." }).success)
      .toBe(true);
  });

  it.each([
    { kind: "work", approved: true },
    { kind: "validation", outcome: { role: "work", state: "blocked", summary: "Wrong role.", checks: [] } },
    { kind: "resume", response: "Continue.", returnTarget: "next" }
  ])("rejects legacy, role-mismatched, and runtime-owned control fields %#", (value) => {
    expect(respondToNodeRunBodySchema.safeParse(value).success).toBe(false);
  });
});
