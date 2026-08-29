import { z } from "zod";
import { VNEXT_LIMITS } from "../limits.js";
import { sha256 } from "../primitives.js";
import { isAllowedRefinementPath } from "../refinement.js";
import { VNEXT_ROLE_OUTCOME_VERSION } from "../versions.js";
import { checkEvidenceSchema, idListSchema, idSchema, nonEmptyTextSchema, sha256Schema } from "./common.js";

const evidence = z.json();
const precheckDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ phase: z.literal("precheck"), decision: z.literal("done"), evidence }).strict(),
  z.object({ phase: z.literal("precheck"), decision: z.literal("delegate"), workPrompt: nonEmptyTextSchema, evidence }).strict(),
  z.object({
    phase: z.literal("precheck"), decision: z.literal("blocked"), reason: nonEmptyTextSchema,
    correctiveActions: z.array(nonEmptyTextSchema).min(1).max(VNEXT_LIMITS.evidenceItems), evidence
  }).strict()
]);
const postworkDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ phase: z.literal("postwork"), decision: z.literal("done"), evidence }).strict(),
  z.object({
    phase: z.literal("postwork"), decision: z.literal("retry"), workPrompt: nonEmptyTextSchema,
    feedback: nonEmptyTextSchema, expectedCorrection: nonEmptyTextSchema, evidence
  }).strict(),
  z.object({
    phase: z.literal("postwork"), decision: z.literal("blocked"), reason: nonEmptyTextSchema,
    correctiveActions: z.array(nonEmptyTextSchema).min(1).max(VNEXT_LIMITS.evidenceItems), evidence
  }).strict()
]);
export const validationDecisionSchema = z.union([precheckDecisionSchema, postworkDecisionSchema]);

const outcomeBase = {
  version: z.literal(VNEXT_ROLE_OUTCOME_VERSION),
  summary: nonEmptyTextSchema,
  checks: z.array(checkEvidenceSchema).max(VNEXT_LIMITS.evidenceItems)
};

export const validationOutcomeSchema = z.object({
  ...outcomeBase,
  role: z.literal("validation"),
  result: validationDecisionSchema
}).strict();

const workBase = { ...outcomeBase, role: z.literal("work"), artifacts: z.record(z.string(), z.json()) };
export const workOutcomeSchema = z.discriminatedUnion("state", [
  z.object({ ...workBase, state: z.literal("completed") }).strict(),
  z.object({ ...workBase, state: z.literal("needs_input"), question: nonEmptyTextSchema, context: nonEmptyTextSchema }).strict(),
  z.object({ ...workBase, state: z.literal("blocked") }).strict(),
  z.object({ ...workBase, state: z.literal("failed") }).strict()
]);

const criticProposalSchema = z.object({
  proposalId: idSchema,
  title: nonEmptyTextSchema,
  finding: nonEmptyTextSchema,
  evidenceRefs: idListSchema,
  category: z.enum(["product", "system", "architecture", "code", "design", "documentation"]),
  targetType: z.enum(["product_snapshot", "environment_definition", "environment_run", "state_definition",
    "state_execution", "action_definition", "action_execution", "resource"]),
  targetId: idSchema,
  severity: z.enum(["low", "medium", "high", "critical"]),
  priority: z.number().int().min(1).max(5),
  recommendedCorrectiveActions: z.array(nonEmptyTextSchema).min(1).max(VNEXT_LIMITS.evidenceItems),
  rationale: nonEmptyTextSchema,
  confidence: z.number().min(0).max(1),
  suggestedActionTarget: idSchema.optional()
}).strict();

export const criticOutcomeSchema = z.object({
  ...outcomeBase,
  role: z.literal("critic"),
  proposal: criticProposalSchema.optional()
}).strict();

const refinementFileProposalSchema = z.object({
  operation: z.enum(["create", "replace", "delete"]),
  relativePath: nonEmptyTextSchema,
  preimageSha256: z.union([sha256Schema, z.literal("absent")]),
  proposedContentSha256: z.union([sha256Schema, z.literal("absent")]),
  proposedContent: z.string().max(VNEXT_LIMITS.instruction).optional(),
  rationale: nonEmptyTextSchema,
  resourceId: idSchema.optional()
}).strict();

export const refinementOutcomeSchema = z.object({
  ...outcomeBase,
  role: z.literal("refinement"),
  proposalId: idSchema,
  rationale: nonEmptyTextSchema,
  feedbackIds: idListSchema.min(1),
  targetActionId: idSchema,
  impactedActionIds: idListSchema.min(1),
  mappingExplanation: nonEmptyTextSchema,
  files: z.array(refinementFileProposalSchema).min(1).max(VNEXT_LIMITS.proposalFiles),
  sharedSkillImpact: z.array(z.object({ resourceId: idSchema, actionIds: idListSchema }).strict()),
  expectedBehavioralImprovement: nonEmptyTextSchema,
  risks: z.array(nonEmptyTextSchema).max(VNEXT_LIMITS.evidenceItems),
  validationPlan: z.array(z.enum(["instruction_contract", "resource_contract", "relevant_tests"]))
    .min(1).max(VNEXT_LIMITS.evidenceItems),
  rollback: nonEmptyTextSchema,
  continuationInvalidationScope: idListSchema
}).strict().superRefine((outcome, context) => {
  for (const [index, file] of outcome.files.entries()) {
    if (!isAllowedRefinementPath(file.relativePath)) {
      context.addIssue({ code: "custom", path: ["files", index, "relativePath"], message: "Refinement path is outside instruction/Skill scope" });
    }
    const contentMatches = file.operation === "delete"
      ? file.proposedContent === undefined && file.proposedContentSha256 === "absent"
      : file.proposedContent !== undefined && sha256(file.proposedContent) === file.proposedContentSha256;
    if (!contentMatches) {
      context.addIssue({ code: "custom", path: ["files", index, "proposedContentSha256"], message: "Proposed content hash does not match" });
    }
    if ((file.operation === "create") !== (file.preimageSha256 === "absent")) {
      context.addIssue({ code: "custom", path: ["files", index, "preimageSha256"], message: "Operation and preimage do not match" });
    }
  }
});

export const roleOutcomeV10Schema = z.union([
  validationOutcomeSchema,
  workOutcomeSchema,
  criticOutcomeSchema,
  refinementOutcomeSchema
]);
