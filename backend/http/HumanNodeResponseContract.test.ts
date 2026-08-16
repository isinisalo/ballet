import { describe, expect, it } from "vitest";
import {
  repairRequestSchema, respondToNodeRunBodySchema, rootRunRepairProjectionSchema
} from "../../shared/api/runtime-schemas.js";

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

  it("serializes repair read DTOs strictly without hidden reasoning fields", () => {
    const id = (suffix: string) => `10000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
    const request = {
      repairRequestId: id("1"), rootRunId: id("2"), requesterLoopRunId: id("3"),
      requesterWorkLoopNodeRunId: id("4"), requesterValidationNodeRunId: id("5"),
      mode: "orchestrator", attempt: 1, validationSummary: "Repair required.",
      requestedCapability: "repair-state", reason: "Validation evidence failed.",
      stateRevisionAtRequest: 2, status: "pending", returnLoopId: "main-loop",
      returnWorkLoopNodeId: "work", returnValidationNodeDefinitionId: "main-loop:work:validation",
      nestingDepth: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    };
    expect(repairRequestSchema.parse(JSON.parse(JSON.stringify(request)))).toEqual(request);
    expect(repairRequestSchema.safeParse({ ...request, hiddenReasoning: "private trace" }).success).toBe(false);
    expect(rootRunRepairProjectionSchema.parse({
      requests: [request], routes: [], continuations: [], results: [], activeContinuationChain: [],
      pendingRepair: request,
      returnDestination: {
        loopId: "main-loop", workLoopNodeId: "work",
        validationNodeDefinitionId: "main-loop:work:validation"
      }
    })).toMatchObject({ pendingRepair: { repairRequestId: id("1") } });
  });
});
