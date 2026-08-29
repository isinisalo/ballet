import { z } from "zod";
import { hasValidUseCaseApproval } from "../direction.js";
import { VNEXT_LIMITS } from "../limits.js";
import { idListSchema, idSchema, nonEmptyTextSchema, sha256Schema, timestampSchema } from "./common.js";

const directionReferenceSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  status: z.enum(["draft", "accepted", "superseded"])
}).strict();

export const constraintSchema = directionReferenceSchema.extend({
  kind: z.enum(["required", "prohibited"]),
  description: nonEmptyTextSchema,
  rationale: nonEmptyTextSchema,
  scope: nonEmptyTextSchema.optional()
}).strict();

export const useCaseExampleSchema = z.object({
  given: nonEmptyTextSchema,
  when: nonEmptyTextSchema,
  then: nonEmptyTextSchema
}).strict();

export const useCaseSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  status: z.enum(["draft", "approved"]),
  examples: z.array(useCaseExampleSchema).min(1).max(VNEXT_LIMITS.examplesPerUseCase),
  successGoals: z.array(nonEmptyTextSchema).min(1).max(VNEXT_LIMITS.referencesPerItem),
  failureGoals: z.array(nonEmptyTextSchema).min(1).max(VNEXT_LIMITS.referencesPerItem),
  expectedOutcomes: z.array(nonEmptyTextSchema).min(1).max(VNEXT_LIMITS.referencesPerItem),
  goalIds: idListSchema.min(1),
  adrIds: idListSchema.min(1),
  constraintIds: idListSchema.min(1),
  approval: z.object({
    approvedBy: idSchema,
    approvedAt: timestampSchema,
    revision: z.number().int().positive(),
    contentHash: sha256Schema
  }).strict().optional()
}).strict().superRefine((useCase, context) => {
  if (useCase.status === "approved" && !hasValidUseCaseApproval(useCase)) {
    context.addIssue({ code: "custom", path: ["approval"], message: "Approved Use Case needs a matching content hash" });
  }
  if (useCase.status === "draft" && useCase.approval) {
    context.addIssue({ code: "custom", path: ["approval"], message: "Draft Use Case cannot retain approval metadata" });
  }
});

export const directionSchema = z.object({
  goals: z.array(directionReferenceSchema).max(VNEXT_LIMITS.directionItems),
  adrs: z.array(directionReferenceSchema).max(VNEXT_LIMITS.directionItems),
  constraints: z.array(constraintSchema).max(VNEXT_LIMITS.directionItems),
  useCases: z.array(useCaseSchema).max(VNEXT_LIMITS.useCases)
}).strict();
