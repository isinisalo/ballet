import { z } from "zod";
import { CONTRACT_LIMITS } from "../limits.js";
import { TASK_ENVELOPE_VERSION } from "../versions.js";
import { idListSchema, idSchema, nonEmptyTextSchema, sha256Schema } from "./common.js";
import { workOutcomeSchema } from "./outcomeSchemas.js";

const base = {
  version: z.literal(TASK_ENVELOPE_VERSION),
  taskId: idSchema,
  environmentRunId: idSchema,
  snapshotSha256: sha256Schema,
  instruction: z.string().trim().min(1).max(CONTRACT_LIMITS.instruction),
  context: z.json()
};
const actionBase = {
  ...base,
  stateExecutionId: idSchema,
  actionExecutionId: idSchema,
  actionId: idSchema
};

export const validationPrecheckTaskEnvelopeSchema = z.object({
  ...actionBase,
  role: z.literal("validation"),
  phase: z.literal("precheck"),
  workAttempts: z.number().int().nonnegative().max(1 + CONTRACT_LIMITS.maxRetries),
  maxRetries: z.number().int().nonnegative().max(CONTRACT_LIMITS.maxRetries)
}).strict();

export const workTaskEnvelopeSchema = z.object({
  ...actionBase,
  role: z.literal("work"),
  phase: z.literal("work"),
  workAttempt: z.number().int().positive().max(1 + CONTRACT_LIMITS.maxRetries),
  dynamicPrompt: nonEmptyTextSchema,
  previousValidationFeedback: nonEmptyTextSchema.optional()
}).strict();

export const validationPostworkTaskEnvelopeSchema = z.object({
  ...actionBase,
  role: z.literal("validation"),
  phase: z.literal("postwork"),
  workAttempt: z.number().int().positive().max(1 + CONTRACT_LIMITS.maxRetries),
  retriesRemaining: z.number().int().nonnegative().max(CONTRACT_LIMITS.maxRetries),
  workOutcome: workOutcomeSchema
}).strict();

export const criticTaskEnvelopeSchema = z.object({
  ...base,
  role: z.literal("critic"),
  phase: z.literal("proposal"),
  criticRunId: idSchema,
  scheduleId: idSchema,
  productSnapshotIds: idListSchema
}).strict();

export const refinementTaskEnvelopeSchema = z.object({
  ...base,
  role: z.literal("refinement"),
  phase: z.literal("proposal"),
  refinementRunId: idSchema,
  approvedCriticProposalIds: idListSchema,
  allowedPaths: z.array(nonEmptyTextSchema).max(CONTRACT_LIMITS.proposalFiles),
  preimageHashes: z.record(z.string(), sha256Schema)
}).strict();

export const taskEnvelopeV10Schema = z.union([
  validationPrecheckTaskEnvelopeSchema,
  workTaskEnvelopeSchema,
  validationPostworkTaskEnvelopeSchema,
  criticTaskEnvelopeSchema,
  refinementTaskEnvelopeSchema
]);
