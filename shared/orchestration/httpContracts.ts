import { z } from "zod";
import { CONTRACT_LIMITS } from "./limits.js";
import { idSchema, nonEmptyTextSchema, sha256Schema } from "./schemas/common.js";
import { constraintSchema, directionReferenceSchema, useCaseAuthoringSchema } from "./schemas/directionSchemas.js";
import {
  actionDefinitionSchema, agentDefinitionSchema, environmentDefinitionSchema, projectConfigurationV21Schema, stateDefinitionSchema
} from "./schemas/environmentSchemas.js";

const markdownSourceSchema = z.string().max(CONTRACT_LIMITS.text)
  .refine((value) => value.trim().length > 0, "Markdown must not be empty");

export const documentKindSchema = z.enum(["goal", "adr", "constraint", "use-case", "agent", "instruction", "skill"]);
export const idParamsSchema = z.object({ id: idSchema }).strict();
export const runParamsSchema = z.object({ runId: idSchema }).strict();
export const stateParamsSchema = z.object({ stateId: idSchema }).strict();
export const actionParamsSchema = z.object({ stateId: idSchema, actionId: idSchema }).strict();
export const emptySchema = z.object({}).strict();
export const putProjectSchema = z.object({
  expectedHash: z.union([sha256Schema, z.literal("absent")]), config: projectConfigurationV21Schema
}).strict();
export const putResourceSchema = z.object({
  expectedHash: z.union([sha256Schema, z.literal("absent")]), content: markdownSourceSchema
}).strict();
export const removeResourceSchema = z.object({ expectedHash: sha256Schema }).strict();
export const removeDirectionSchema = z.object({ expectedHash: sha256Schema, expectedConfigHash: sha256Schema }).strict();
export const putDirectionSchema = z.object({
  expectedConfigHash: sha256Schema, expectedDocumentHash: z.union([sha256Schema, z.literal("absent")]),
  markdown: markdownSourceSchema,
  value: z.union([directionReferenceSchema, constraintSchema, useCaseAuthoringSchema])
}).strict();
export const putAgentSchema = z.object({
  expectedConfigHash: sha256Schema, expectedDocumentHash: z.union([sha256Schema, z.literal("absent")]),
  markdown: markdownSourceSchema, value: agentDefinitionSchema
}).strict();
export const directionDecisionSchema = z.object({ expectedConfigHash: sha256Schema }).strict();
export const useCaseApprovalDecisionSchema = z.object({
  expectedConfigHash: sha256Schema, expectedContentHash: sha256Schema
}).strict();
export const startRunSchema = z.object({ environmentId: idSchema, expectedConfigHash: sha256Schema,
  input: z.string().max(CONTRACT_LIMITS.text).optional() }).strict();
export const workInputResponseSchema = z.object({
  expectedAgentRunId: idSchema, expectedAgentRevision: z.number().int().nonnegative(),
  answer: z.string().trim().min(1).max(32768)
}).strict();
export const putEnvironmentSchema = z.object({ expectedConfigHash: sha256Schema, environment: environmentDefinitionSchema }).strict();
export const putStateSchema = z.object({ expectedConfigHash: sha256Schema, state: stateDefinitionSchema }).strict();
export const putActionSchema = z.object({ expectedConfigHash: sha256Schema, action: actionDefinitionSchema }).strict();
export const reorderSchema = z.object({ expectedConfigHash: sha256Schema, orderedIds: z.array(idSchema).min(1) }).strict();
export const eventQuerySchema = z.object({ after: z.coerce.number().int().nonnegative().default(0) }).strict();
export const feedbackQuerySchema = z.object({
  environmentRunId: idSchema.optional(), status: z.enum(["open", "in_refinement", "resolved", "dismissed"]).optional(),
  category: z.enum(["system", "architecture", "code", "design", "documentation"]).optional()
}).strict();
export const createFeedbackSchema = z.object({
  category: z.enum(["system", "architecture", "code", "design", "documentation"]),
  comment: nonEmptyTextSchema
}).strict();
export const feedbackDecisionSchema = z.object({
  from: z.enum(["open", "in_refinement"]), decision: z.enum(["resolved", "dismissed"])
}).strict();
export const criticDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]), expectedContentHash: sha256Schema, expectedVersion: z.literal(2),
  rationale: nonEmptyTextSchema.optional()
}).strict();
export const refinementDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]), expectedContentHash: sha256Schema, expectedVersion: z.literal(2),
  expectedChangeHashes: z.array(z.union([sha256Schema, z.literal("absent")])).min(1),
  expectedImpactActionIds: z.array(idSchema), acknowledgeLocalCommitAndContinuation: z.boolean(),
  rationale: nonEmptyTextSchema.optional()
}).strict();

export type InvalidationKind =
  | "project_changed" | "run_changed" | "feedback_changed"
  | "critic_changed" | "refinement_changed" | "schedule_changed";
export interface InvalidationEvent {
  sequence: number;
  kind: InvalidationKind;
  entityId?: string;
  createdAt: string;
}
