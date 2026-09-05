import { z } from "zod";
import { nonEmptyTextSchema, sha256Schema } from "./schemas/common.js";

export const USER_STORY_LIMITS = { stories: 256, criteria: 50, documentBytes: 131_072 } as const;
export const userStoryIdSchema = z.string().uuid();
export const acceptanceCriterionSchema = z.object({
  given: nonEmptyTextSchema, when: nonEmptyTextSchema, then: nonEmptyTextSchema
}).strict();
export const userStoryInputSchema = z.object({
  role: nonEmptyTextSchema, goal: nonEmptyTextSchema, benefit: nonEmptyTextSchema,
  acceptanceCriteria: z.array(acceptanceCriterionSchema).max(USER_STORY_LIMITS.criteria)
}).strict();
export const userStorySchema = userStoryInputSchema.extend({ version: z.literal(1), id: userStoryIdSchema }).strict();
export const userStoryParamsSchema = z.object({ id: userStoryIdSchema }).strict();
export const updateUserStorySchema = z.object({ value: userStoryInputSchema, expectedHash: sha256Schema }).strict();

export type AcceptanceCriterion = z.infer<typeof acceptanceCriterionSchema>;
export type UserStoryInput = z.infer<typeof userStoryInputSchema>;
export type UserStoryV1 = z.infer<typeof userStorySchema>;
export interface UserStoryDocument { value: UserStoryV1; contentHash: string }
export interface UserStoryCollection {
  stories: UserStoryDocument[];
  issues: Array<{ id: string; message: string }>;
}
