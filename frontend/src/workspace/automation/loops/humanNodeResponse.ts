import {
  validationNodeOutcomeSchema,
  jobNodeOutcomeSchema,
  type RespondToNodeRunRequest
} from "@shared/api/workspace-contracts";

export type HumanJobState = "completed" | "blocked" | "failed";
export type HumanValidationState = "PASS" | "FAIL" | "blocked" | "failed";
export type HumanEscalationKind = "capability" | "outcome";

export interface HumanJobResponseFields {
  state: HumanJobState;
  summary: string;
  artifacts: string;
  checks: string;
  statePatch: string;
}

export interface HumanValidationResponseFields {
  state: HumanValidationState;
  summary: string;
  evidence: string;
  checks: string;
  statePatch: string;
  feedback: string;
  expectedCorrection: string;
  escalationKind: HumanEscalationKind;
  reason: string;
  requestedCapability: string;
  requestedOutcome: string;
  evidenceRefs: string;
}

export const buildHumanJobResponse = (
  fields: HumanJobResponseFields
): RespondToNodeRunRequest => {
  const common = {
    role: "job" as const,
    state: fields.state,
    summary: requireText(fields.summary, "Summary"),
    checks: parseJson(fields.checks, "Checks", [])
  };
  const value = fields.state === "completed" ? {
    ...common,
    artifacts: parseJson(fields.artifacts, "Artifacts", {}),
    ...optionalJson(fields.statePatch, "State patch")
  } : common;
  return { kind: "job", outcome: jobNodeOutcomeSchema.parse(value) };
};

export const buildHumanValidationResponse = (
  fields: HumanValidationResponseFields
): RespondToNodeRunRequest => {
  const common = {
    role: "validation" as const,
    state: fields.state === "PASS" || fields.state === "FAIL" ? "completed" as const : fields.state,
    summary: requireText(fields.summary, "Summary"),
    checks: parseJson(fields.checks, "Checks", [])
  };
  if (fields.state === "blocked" || fields.state === "failed") {
    return { kind: "validation", outcome: validationNodeOutcomeSchema.parse(common) };
  }
  const completed = {
    ...common,
    decision: fields.state,
    evidence: parseJson(fields.evidence, "Evidence", {})
  };
  const value = fields.state === "PASS" ? {
    ...completed,
    ...optionalJson(fields.statePatch, "State patch")
  } : {
    ...completed,
    feedback: requireText(fields.feedback, "Feedback"),
    expectedCorrection: requireText(fields.expectedCorrection, "Expected correction"),
    escalation: {
      reason: requireText(fields.reason, "Escalation reason"),
      evidenceRefs: parseJson(fields.evidenceRefs, "Evidence references", []),
      ...(fields.escalationKind === "capability"
        ? { requestedCapability: requireText(fields.requestedCapability, "Requested capability") }
        : { requestedOutcome: parseJson(fields.requestedOutcome, "Requested outcome", {}) })
    }
  };
  return { kind: "validation", outcome: validationNodeOutcomeSchema.parse(value) };
};

export const buildResumeResponse = (response: string): RespondToNodeRunRequest => ({
  kind: "resume",
  response: requireText(response, "Response")
});

const requireText = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must not be empty.`);
  return trimmed;
};

const parseJson = (source: string, label: string, empty: unknown): unknown => {
  if (!source.trim()) return empty;
  try { return JSON.parse(source); }
  catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const optionalJson = (source: string, label: string): { statePatch?: unknown } =>
  source.trim() ? { statePatch: parseJson(source, label, []) } : {};
