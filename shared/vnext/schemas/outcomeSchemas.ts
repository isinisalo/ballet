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
  rationale: nonEmptyTextSchema,
  evidenceRefs: idListSchema,
  proposedText: nonEmptyTextSchema
}).strict();

export const criticOutcomeSchema = z.object({
  ...outcomeBase,
  role: z.literal("critic"),
  proposal: criticProposalSchema.optional()
}).strict();

const refinementFileProposalSchema = z.object({
  relativePath: nonEmptyTextSchema,
  preimageSha256: sha256Schema,
  proposedContentSha256: sha256Schema,
  proposedContent: z.string().max(VNEXT_LIMITS.instruction),
  resourceId: idSchema.optional()
}).strict();

export const refinementOutcomeSchema = z.object({
  ...outcomeBase,
  role: z.literal("refinement"),
  proposalId: idSchema,
  rationale: nonEmptyTextSchema,
  files: z.array(refinementFileProposalSchema).min(1).max(VNEXT_LIMITS.proposalFiles),
  sharedSkillImpact: z.array(z.object({ resourceId: idSchema, actionIds: idListSchema }).strict())
}).strict().superRefine((outcome, context) => {
  for (const [index, file] of outcome.files.entries()) {
    if (!isAllowedRefinementPath(file.relativePath)) {
      context.addIssue({ code: "custom", path: ["files", index, "relativePath"], message: "Refinement path is outside instruction/Skill scope" });
    }
    if (sha256(file.proposedContent) !== file.proposedContentSha256) {
      context.addIssue({ code: "custom", path: ["files", index, "proposedContentSha256"], message: "Proposed content hash does not match" });
    }
  }
});

export const roleOutcomeV10Schema = z.union([
  validationOutcomeSchema,
  workOutcomeSchema,
  criticOutcomeSchema,
  refinementOutcomeSchema
]);
