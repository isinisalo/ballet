import type { JsonValue } from "./primitives.js";
import { VNEXT_ROLE_OUTCOME_VERSION } from "./versions.js";

export interface CheckEvidence {
  name: string;
  status: "passed" | "failed" | "skipped";
  details?: string;
  evidenceRefs: string[];
}

interface OutcomeBase {
  version: typeof VNEXT_ROLE_OUTCOME_VERSION;
  summary: string;
  checks: CheckEvidence[];
}

export type ValidationDecision =
  | { phase: "precheck"; decision: "done"; evidence: JsonValue }
  | { phase: "precheck"; decision: "delegate"; workPrompt: string; evidence: JsonValue }
  | { phase: "precheck"; decision: "blocked"; reason: string; correctiveActions: string[]; evidence: JsonValue }
  | { phase: "postwork"; decision: "done"; evidence: JsonValue }
  | { phase: "postwork"; decision: "retry"; workPrompt: string; feedback: string; expectedCorrection: string; evidence: JsonValue }
  | { phase: "postwork"; decision: "blocked"; reason: string; correctiveActions: string[]; evidence: JsonValue };

export interface ValidationOutcome extends OutcomeBase {
  role: "validation";
  result: ValidationDecision;
}

export type WorkOutcome = OutcomeBase & { role: "work" } & (
  | { state: "completed"; artifacts: Record<string, JsonValue> }
  | { state: "needs_input"; artifacts: Record<string, JsonValue>; question: string; context: string }
  | { state: "blocked" | "failed"; artifacts: Record<string, JsonValue> }
);

export interface CriticProposal {
  proposalId: string;
  title: string;
  finding: string;
  evidenceRefs: string[];
  category: "product" | "system" | "architecture" | "code" | "design" | "documentation";
  targetType: "product_snapshot" | "environment_definition" | "environment_run" | "state_definition"
    | "state_execution" | "action_definition" | "action_execution" | "resource";
  targetId: string;
  severity: "low" | "medium" | "high" | "critical";
  priority: number;
  recommendedCorrectiveActions: string[];
  rationale: string;
  confidence: number;
  suggestedActionTarget?: string;
}

export interface CriticOutcome extends OutcomeBase {
  role: "critic";
  proposal?: CriticProposal;
}

export interface RefinementFileProposal {
  operation: "create" | "replace" | "delete";
  relativePath: string;
  preimageSha256: string | "absent";
  proposedContentSha256: string | "absent";
  proposedContent?: string;
  rationale: string;
  resourceId?: string;
}

export interface RefinementOutcome extends OutcomeBase {
  role: "refinement";
  proposalId: string;
  rationale: string;
  feedbackIds: string[];
  targetActionId: string;
  impactedActionIds: string[];
  mappingExplanation: string;
  files: RefinementFileProposal[];
  sharedSkillImpact: Array<{ resourceId: string; actionIds: string[] }>;
  expectedBehavioralImprovement: string;
  risks: string[];
  validationPlan: Array<"instruction_contract" | "resource_contract" | "relevant_tests">;
  rollback: string;
  continuationInvalidationScope: string[];
}
