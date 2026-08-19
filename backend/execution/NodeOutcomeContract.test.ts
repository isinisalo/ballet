import { describe, expect, it } from "vitest";
import {
  nodeOutcomeJsonSchemaForRole,
  orchestratorNodeOutcomeSchema,
  parseNodeOutcomeForRole,
  validationNodeOutcomeSchema,
  workNodeOutcomeSchema
} from "../../shared/api/runtime-schemas.js";
import {
  NODE_OUTCOME_SCHEMA_IDS, NODE_OUTCOME_SCHEMA_SHA256
} from "./ExecutionComposition.js";

const checks = [{ name: "contract", status: "passed" as const }];

describe("role-specific Node outcome contracts", () => {
  it.each([
    { role: "work", state: "completed", summary: "Done.", artifacts: {}, checks },
    { role: "work", state: "needs_input", summary: "Paused.", question: "Choose.", context: "Two choices.", checks },
    { role: "work", state: "blocked", summary: "Blocked.", checks },
    { role: "work", state: "failed", summary: "Failed.", checks }
  ])("accepts Work outcome $state", (outcome) => {
    expect(workNodeOutcomeSchema.parse(outcome)).toEqual(outcome);
  });

  it.each([
    {
      role: "validation", state: "completed", decision: "OK", summary: "Valid.", evidence: {}, checks,
      statePatch: [{ op: "add", path: "/validated", value: true }]
    },
    {
      role: "validation", state: "completed", decision: "FAIL", summary: "Retry.", evidence: {}, checks,
      repair: { mode: "LOCAL_RETRY", feedback: "Correct the value.", expectedCorrection: "Set it to one." }
    },
    {
      role: "validation", state: "completed", decision: "FAIL", summary: "Route repair.", evidence: {}, checks,
      repair: {
        mode: "ORCHESTRATOR_REPAIR", reason: "Another capability is required.",
        requestedCapability: "repair structured state", evidenceRefs: ["check:contract"]
      }
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
    ["FAIL without repair", validationNodeOutcomeSchema, {
      role: "validation", state: "completed", decision: "FAIL", summary: "No repair.", evidence: {}, checks
    }],
    ["OK with repair", validationNodeOutcomeSchema, {
      role: "validation", state: "completed", decision: "OK", summary: "Contradiction.", evidence: {}, checks,
      repair: { mode: "LOCAL_RETRY", feedback: "x", expectedCorrection: "y" }
    }],
    ["FAIL with State patch", validationNodeOutcomeSchema, {
      role: "validation", state: "completed", decision: "FAIL", summary: "Contradiction.", evidence: {}, checks,
      repair: { mode: "LOCAL_RETRY", feedback: "x", expectedCorrection: "y" },
      statePatch: [{ op: "add", path: "/invalid", value: true }]
    }],
    ["Repair Request with provider-selected target", validationNodeOutcomeSchema, {
      role: "validation", state: "completed", decision: "FAIL", summary: "Invalid target selection.",
      evidence: {}, checks,
      repair: {
        mode: "ORCHESTRATOR_REPAIR", reason: "Another capability is required.",
        requestedCapability: "repair structured state", targetLoopId: "repair-loop", evidenceRefs: []
      }
    }],
    ["Work decision", workNodeOutcomeSchema, {
      role: "work", state: "completed", decision: "OK", summary: "Invalid.", artifacts: {}, checks
    }],
    ["Work patch while waiting", workNodeOutcomeSchema, {
      role: "work", state: "needs_input", summary: "Invalid.", question: "Question?", context: "Context.", checks,
      statePatch: [{ op: "add", path: "/invalid", value: true }]
    }],
    ["Orchestrator continuation", orchestratorNodeOutcomeSchema, {
      role: "orchestrator", state: "completed", targetLoopId: "repair-loop", routeReason: "Invalid.",
      dispatchInput: {}, expectedOutcome: {}, returnWorkLoopNodeId: "caller"
    }],
    ["Orchestrator State patch", orchestratorNodeOutcomeSchema, {
      role: "orchestrator", state: "completed", targetLoopId: "repair-loop", routeReason: "Invalid.",
      dispatchInput: {}, expectedOutcome: {}, statePatch: [{ op: "add", path: "/invalid", value: true }]
    }]
  ])("rejects invalid union combination: %s", (_label, schema, outcome) => {
    expect(schema.safeParse(outcome).success).toBe(false);
  });

  it("rejects an Orchestrator repair that declares both requested forms", () => {
    expect(validationNodeOutcomeSchema.safeParse({
      role: "validation", state: "completed", decision: "FAIL", summary: "Ambiguous.", evidence: {}, checks,
      repair: {
        mode: "ORCHESTRATOR_REPAIR", reason: "Ambiguous request.", requestedCapability: "one",
        requestedOutcome: { two: true }, evidenceRefs: []
      }
    }).success).toBe(false);
  });

  it("parses only the schema selected by immutable Node role", () => {
    const validation = {
      role: "validation", state: "completed", decision: "OK", summary: "Valid.", evidence: {}, checks
    };
    expect(() => parseNodeOutcomeForRole("work", validation)).toThrow();
    expect(parseNodeOutcomeForRole("validation", validation)).toEqual(validation);
  });

  it("generates one traceable JSON Schema and hash per role", () => {
    expect(Object.keys(NODE_OUTCOME_SCHEMA_IDS)).toEqual(["work", "validation", "orchestrator"]);
    expect(new Set(Object.values(NODE_OUTCOME_SCHEMA_SHA256))).toHaveLength(3);
    expect(Object.values(NODE_OUTCOME_SCHEMA_SHA256)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^[0-9a-f]{64}$/)])
    );
    expect(nodeOutcomeJsonSchemaForRole("work")).not.toEqual(nodeOutcomeJsonSchemaForRole("validation"));
    expect(nodeOutcomeJsonSchemaForRole("validation")).not.toEqual(nodeOutcomeJsonSchemaForRole("orchestrator"));
  });
});
