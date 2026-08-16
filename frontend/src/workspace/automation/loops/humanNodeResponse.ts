import {
  validationNodeOutcomeSchema,
  workNodeOutcomeSchema,
  type RespondToNodeRunRequest
} from "@shared/api/workspace-contracts";

export type HumanWorkState = "completed" | "blocked" | "failed";
export type HumanValidationState = "OK" | "FAIL" | "blocked" | "failed";
export type HumanRepairMode = "LOCAL_RETRY" | "ORCHESTRATOR_REPAIR";

export interface HumanWorkResponseFields {
  state: HumanWorkState;
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
  repairMode: HumanRepairMode;
  feedback: string;
  expectedCorrection: string;
  reason: string;
  requestedCapability: string;
  evidenceRefs: string;
}

export const buildHumanWorkResponse = (
  fields: HumanWorkResponseFields
): RespondToNodeRunRequest => {
  const common = {
    role: "work" as const,
    state: fields.state,
    summary: requireText(fields.summary, "Summary"),
    checks: parseJson(fields.checks, "Checks", [])
  };
  const value = fields.state === "completed" ? {
    ...common,
    artifacts: parseJson(fields.artifacts, "Artifacts", {}),
    ...optionalJson(fields.statePatch, "State patch")
  } : common;
  return { kind: "work", outcome: workNodeOutcomeSchema.parse(value) };
};

export const buildHumanValidationResponse = (
  fields: HumanValidationResponseFields
): RespondToNodeRunRequest => {
  const common = {
    role: "validation" as const,
    state: fields.state === "OK" || fields.state === "FAIL" ? "completed" as const : fields.state,
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
  const value = fields.state === "OK" ? {
    ...completed,
    ...optionalJson(fields.statePatch, "State patch")
  } : {
    ...completed,
    repair: fields.repairMode === "LOCAL_RETRY" ? {
      mode: "LOCAL_RETRY",
      feedback: requireText(fields.feedback, "Feedback"),
      expectedCorrection: requireText(fields.expectedCorrection, "Expected correction")
    } : {
      mode: "ORCHESTRATOR_REPAIR",
      reason: requireText(fields.reason, "Repair reason"),
      requestedCapability: requireText(fields.requestedCapability, "Requested capability"),
      evidenceRefs: parseJson(fields.evidenceRefs, "Evidence references", [])
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
