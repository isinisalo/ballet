import { describe, expect, it } from "vitest";
import {
  nodeOutcomeJsonSchemaForRole,
  orchestratorNodeOutcomeSchema,
  parseNodeOutcomeForRole,
  validationNodeOutcomeSchema,
  jobNodeOutcomeSchema
} from "../../shared/api/runtime-schemas.js";
import {
  NODE_OUTCOME_SCHEMA_IDS, NODE_OUTCOME_SCHEMA_SHA256
} from "./ExecutionComposition.js";

const checks = [{ name: "contract", status: "passed" as const }];

describe("role-specific Node outcome contracts", () => {
  it.each([
    { role: "job", state: "completed", summary: "Done.", artifacts: {}, checks },
    { role: "job", state: "needs_input", summary: "Paused.", question: "Choose.", context: "Two choices.", checks },
    { role: "job", state: "blocked", summary: "Blocked.", checks },
    { role: "job", state: "failed", summary: "Failed.", checks }
  ])("accepts Job outcome $state", (outcome) => {
    expect(jobNodeOutcomeSchema.parse(outcome)).toEqual(outcome);
  });

  it.each([
    {
      role: "validation", state: "completed", decision: "PASS", summary: "Valid.", evidence: {}, checks,
      statePatch: [{ op: "add", path: "/validated", value: true }]
    },
    {
      role: "validation", state: "completed", decision: "FAIL", summary: "Retry.", evidence: {}, checks,
      feedback: "Correct the value.", expectedCorrection: "Set it to one."
    },
    {
      role: "validation", state: "completed", decision: "FAIL", summary: "Repair.", evidence: {}, checks,
      feedback: "Correct the value.", expectedCorrection: "Set it to one.",
      escalation: { reason: "Validation failed.", requestedCapability: "repair structured state", evidenceRefs: [] }
    },
    {
      role: "validation", state: "completed", decision: "FAIL", summary: "Route repair.", evidence: {}, checks,
      feedback: "Correct the value.", expectedCorrection: "Set it to one.",
      escalation: { reason: "Another capability is required.", requestedCapability: "repair structured state", evidenceRefs: ["check:contract"] }
    },
    { role: "validation", state: "needs_input", summary: "Clarify.", question: "Expected value?", context: "Validation input.", checks },
    { role: "validation", state: "blocked", summary: "Blocked.", checks },
    { role: "validation", state: "failed", summary: "Failed.", checks }
  ])("accepts Validation outcome %#", (outcome) => {
    expect(validationNodeOutcomeSchema.parse(outcome)).toEqual(outcome);
  });

  it.each([
    {
      role: "orchestrator", state: "completed", targetLoopId: "repair-loop",
      routeReason: "Capability match.", dispatchInput: { value: 1 }, expectedOutcome: { repaired: true }
    },
    {
      role: "orchestrator", state: "needs_input", summary: "Clarify route.",
      question: "Which capability?", context: "No exact match."
    },
    { role: "orchestrator", state: "blocked", summary: "No allowed route." },
    { role: "orchestrator", state: "failed", summary: "Routing failed." }
  ])("accepts Orchestrator outcome %#", (outcome) => {
    expect(orchestratorNodeOutcomeSchema.parse(outcome)).toEqual(outcome);
  });

  it.each([
    ["PASS with escalation", validationNodeOutcomeSchema, {
      role: "validation", state: "completed", decision: "PASS", summary: "Contradiction.", evidence: {}, checks,
      escalation: { reason: "x", requestedCapability: "y", evidenceRefs: [] }
    }],
    ["FAIL with State patch", validationNodeOutcomeSchema, {
      role: "validation", state: "completed", decision: "FAIL", summary: "Contradiction.", evidence: {}, checks,
      feedback: "x", expectedCorrection: "y",
      escalation: { reason: "x", requestedCapability: "y", evidenceRefs: [] },
      statePatch: [{ op: "add", path: "/invalid", value: true }]
    }],
    ["FAIL with both transition and repair", validationNodeOutcomeSchema, {
      role: "validation", state: "completed", decision: "FAIL", summary: "Contradiction.", evidence: {}, checks,
      feedback: "x", expectedCorrection: "y", transitionOutcome: "invalid_plan",
      escalation: { reason: "x", requestedCapability: "repair structured state", evidenceRefs: [] }
    }],
    ["Repair Request with provider-selected target", validationNodeOutcomeSchema, {
      role: "validation", state: "completed", decision: "FAIL", summary: "Invalid target selection.",
      evidence: {}, checks,
      feedback: "x", expectedCorrection: "y",
      escalation: {
        reason: "Another capability is required.",
        requestedCapability: "repair structured state", targetLoopId: "repair-loop", evidenceRefs: []
      }
    }],
    ["Job decision", jobNodeOutcomeSchema, {
      role: "job", state: "completed", decision: "PASS", summary: "Invalid.", artifacts: {}, checks
    }],
    ["Job patch while waiting", jobNodeOutcomeSchema, {
      role: "job", state: "needs_input", summary: "Invalid.", question: "Question?", context: "Context.", checks,
      statePatch: [{ op: "add", path: "/invalid", value: true }]
    }],
    ["Orchestrator continuation", orchestratorNodeOutcomeSchema, {
      role: "orchestrator", state: "completed", targetLoopId: "repair-loop", routeReason: "Invalid.",
      dispatchInput: {}, expectedOutcome: {}, returnJobNodeId: "caller"
    }],
    ["Orchestrator State patch", orchestratorNodeOutcomeSchema, {
      role: "orchestrator", state: "completed", targetLoopId: "repair-loop", routeReason: "Invalid.",
      dispatchInput: {}, expectedOutcome: {}, statePatch: [{ op: "add", path: "/invalid", value: true }]
    }]
  ])("rejects invalid union combination: %s", (_label, schema, outcome) => {
    expect(schema.safeParse(outcome).success).toBe(false);
  });

  it("rejects a Validation escalation that declares both requested forms", () => {
    expect(validationNodeOutcomeSchema.safeParse({
      role: "validation", state: "completed", decision: "FAIL", summary: "Ambiguous.", evidence: {}, checks,
      feedback: "x", expectedCorrection: "y",
      escalation: {
        reason: "Ambiguous request.", requestedCapability: "one",
        requestedOutcome: { two: true }, evidenceRefs: []
      }
    }).success).toBe(false);
  });

  it("parses only the schema selected by immutable Node role", () => {
    const validation = {
      role: "validation", state: "completed", decision: "PASS", summary: "Valid.", evidence: {}, checks
    };
    expect(() => parseNodeOutcomeForRole("job", validation)).toThrow();
    expect(parseNodeOutcomeForRole("validation", validation)).toEqual(validation);
  });

  it("generates one traceable JSON Schema and hash per role", () => {
    expect(Object.keys(NODE_OUTCOME_SCHEMA_IDS)).toEqual(["job", "validation", "orchestrator"]);
    expect(new Set(Object.values(NODE_OUTCOME_SCHEMA_SHA256))).toHaveLength(3);
    expect(Object.values(NODE_OUTCOME_SCHEMA_SHA256)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^[0-9a-f]{64}$/)])
    );
    expect(nodeOutcomeJsonSchemaForRole("job")).not.toEqual(nodeOutcomeJsonSchemaForRole("validation"));
    expect(nodeOutcomeJsonSchemaForRole("validation")).not.toEqual(nodeOutcomeJsonSchemaForRole("orchestrator"));
  });
});
