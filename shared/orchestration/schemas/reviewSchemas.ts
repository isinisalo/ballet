import { z } from "zod";
import { CONTRACT_LIMITS } from "../limits.js";
import { idListSchema, idSchema, nonEmptyTextSchema, sha256Schema, timestampSchema } from "./common.js";

const approvalSchema = z.object({
  approvedBy: idSchema,
  approvedAt: timestampSchema,
  revision: z.number().int().positive(),
  contentHash: sha256Schema
}).strict();

export const feedbackEntrySchema = z.object({
  id: idSchema,
  environmentRunId: idSchema,
  actionExecutionId: idSchema.optional(),
  source: z.enum(["validation_blocked", "retry_exhaustion", "system_invalid_output", "approved_critic_proposal", "human"]),
  sourceId: idSchema,
  status: z.enum(["open", "in_refinement", "resolved", "dismissed"]),
  message: nonEmptyTextSchema,
  evidenceRefs: idListSchema,
  createdAt: timestampSchema,
  resolvedAt: timestampSchema.optional()
}).strict();

export const criticScheduleSchema = z.object({
  id: idSchema,
  enabled: z.boolean(),
  configHash: sha256Schema,
  nextDueAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

export const criticRunSchema = z.object({
  id: idSchema,
  scheduleId: idSchema,
  dueAt: timestampSchema,
  status: z.enum(["queued", "running", "completed", "failed", "cancelled", "skipped"]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

export const criticReviewProposalSchema = z.object({
  id: idSchema,
  criticRunId: idSchema,
  status: z.enum(["pending_human_review", "approved", "rejected"]),
  version: z.literal(1),
  contentHash: sha256Schema,
  proposedText: nonEmptyTextSchema,
  evidenceRefs: idListSchema,
  approval: approvalSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

export const refinementRunSchema = z.object({
  id: idSchema,
  sourceEnvironmentRunId: idSchema,
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

const refinementFileBindingSchema = z.object({
  relativePath: nonEmptyTextSchema,
  preimageSha256: sha256Schema,
  proposedContentSha256: sha256Schema
}).strict();

export const refinementReviewProposalSchema = z.object({
  id: idSchema,
  refinementRunId: idSchema,
  status: z.enum(["pending_human_review", "applying", "rejected", "stale", "applied", "apply_failed"]),
  proposalHash: sha256Schema,
  files: z.array(refinementFileBindingSchema).min(1).max(CONTRACT_LIMITS.proposalFiles),
  sharedSkillImpact: z.array(z.object({ resourceId: idSchema, actionIds: idListSchema }).strict()),
  approval: approvalSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();
