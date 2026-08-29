import type { AgentRunPhase, AgentRunRole } from "../../../shared/orchestration/runtime.js";
import type { CriticOutcome, RefinementOutcome, ValidationOutcome, WorkOutcome } from "../../../shared/orchestration/outcomes.js";
import {
  criticOutcomeSchema, refinementOutcomeSchema, validationOutcomeSchema, workOutcomeSchema
} from "../../../shared/orchestration/schemas/outcomeSchemas.js";

export type OrchestrationRoleOutcome = ValidationOutcome | WorkOutcome | CriticOutcome | RefinementOutcome;

export const parseOrchestrationStructuredOutput = (
  raw: string,
  expected: { role: AgentRunRole; phase: AgentRunPhase }
): { success: true; outcome: OrchestrationRoleOutcome } | { success: false; error: string } => {
  if (raw !== raw.trim() || raw.startsWith("```") || raw.endsWith("```")) {
    return { success: false, error: "Provider output must be one unwrapped JSON object." };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return { success: false, error: `Provider output is invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const schema = expected.role === "validation" ? validationOutcomeSchema
    : expected.role === "work" ? workOutcomeSchema
      : expected.role === "critic" ? criticOutcomeSchema : refinementOutcomeSchema;
  const parsed = schema.safeParse(value);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Output schema rejected provider content." };
  if (parsed.data.role !== expected.role) return { success: false, error: "Provider output role differs from Agent Run." };
  if (parsed.data.role === "validation" && parsed.data.result.phase !== expected.phase) {
    return { success: false, error: "Validation decision phase differs from Agent Run." };
  }
  return { success: true, outcome: parsed.data as OrchestrationRoleOutcome };
};
