import { z } from "zod";
import { idSchema, nonEmptyTextSchema, sha256Schema, timestampSchema } from "./schemas/common.js";
import { CONTRACT_LIMITS } from "./limits.js";

export const USER_STORY_LIMITS = { stories: 256, criteria: 50, documentBytes: 131_072 } as const;
export const userStoryIdSchema = z.string().uuid();
export const acceptanceCriterionSchema = z.object({
  given: nonEmptyTextSchema, when: nonEmptyTextSchema, then: nonEmptyTextSchema
}).strict();
export const userStoryInputSchema = z.object({
  role: nonEmptyTextSchema, goal: nonEmptyTextSchema, benefit: nonEmptyTextSchema,
  acceptanceCriteria: z.array(acceptanceCriterionSchema).max(USER_STORY_LIMITS.criteria),
  adrIds: z.array(idSchema).max(CONTRACT_LIMITS.referencesPerItem).default([]),
  details: z.string().max(CONTRACT_LIMITS.text).default("")
}).strict();
const approvalSchema = z.object({
  approvedBy: idSchema, approvedAt: timestampSchema,
  revision: z.number().int().positive(), contentHash: sha256Schema
}).strict();
export const userStorySchema = userStoryInputSchema.extend({
  version: z.literal(2), id: userStoryIdSchema,
  status: z.enum(["draft", "approved"]), approvalRevision: z.number().int().nonnegative(),
  approval: approvalSchema.optional()
}).strict().superRefine((story, context) => {
  if ((story.status === "approved") !== Boolean(story.approval)
    || (story.approval && story.approval.revision !== story.approvalRevision)) {
    context.addIssue({ code: "custom", path: ["approval"], message: "Approval metadata must match status and revision." });
  }
});
export const userStoryParamsSchema = z.object({ id: userStoryIdSchema }).strict();
export const updateUserStorySchema = z.object({ value: userStoryInputSchema, expectedHash: sha256Schema }).strict();
export const userStoryApprovalSchema = z.object({ expectedHash: sha256Schema, expectedContentHash: sha256Schema }).strict();

export type AcceptanceCriterion = z.infer<typeof acceptanceCriterionSchema>;
export type UserStoryInput = z.input<typeof userStoryInputSchema>;
export type UserStoryContent = z.output<typeof userStoryInputSchema>;
export type UserStoryV2 = z.infer<typeof userStorySchema>;
export interface UserStoryDocument { value: UserStoryV2; contentHash: string; semanticHash: string }
export interface UserStoryCollection {
  stories: UserStoryDocument[];
  issues: Array<{ id: string; message: string }>;
}
