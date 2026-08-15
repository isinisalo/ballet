import { z } from "zod";
import { workCompletedOutcomeSchema } from "./runtime-schemas.js";

const boundedText = z.string().max(20_000);
const nonEmptyText = boundedText.trim().min(1);
const identifier = z.string().trim().min(1).max(200);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

const providerRunIdentitySchema = z.object({
  rootRunId: identifier,
  loopRunId: identifier,
  nodeRunId: identifier,
  workLoopNodeRunId: identifier
}).strict();
const orchestratorRunIdentitySchema = z.object({
  rootRunId: identifier,
  loopRunId: identifier,
  nodeRunId: identifier
}).strict();
const loopIdentitySchema = z.object({ id: identifier, description: nonEmptyText }).strict();
const workLoopNodeIdentitySchema = z.object({ id: identifier, description: nonEmptyText }).strict();
const stateSchema = z.object({
  revision: z.number().int().nonnegative(),
  value: z.json(),
  sha256
}).strict();
const resumeSchema = z.object({
  question: nonEmptyText,
  context: boundedText,
  response: nonEmptyText
}).strict();
const historyEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  nodeRunId: identifier,
  role: z.enum(["work", "validation", "orchestrator"]),
  state: z.enum(["completed", "needs_input", "blocked", "failed"]),
  summary: boundedText,
  stateRevision: z.number().int().nonnegative()
}).strict();
const relevantHistorySchema = z.array(historyEntrySchema).max(8);

const commonProviderFields = {
  version: z.literal(2),
  run: providerRunIdentitySchema,
  loop: loopIdentitySchema,
  workLoopNode: workLoopNodeIdentitySchema,
  task: nonEmptyText,
  state: stateSchema,
  localAttempt: z.number().int().min(1).max(100),
  resume: resumeSchema.optional(),
  relevantHistory: relevantHistorySchema
};

export const workTaskEnvelopeV2Schema = z.object({
  role: z.literal("work"),
  ...commonProviderFields,
  previousValidationFeedback: z.object({
    feedback: nonEmptyText,
    expectedCorrection: nonEmptyText
  }).strict().optional()
}).strict();

export const validationTaskEnvelopeV2Schema = z.object({
  role: z.literal("validation"),
  ...commonProviderFields,
  workOutcome: workCompletedOutcomeSchema
}).strict();

const repairRequestFields = {
  id: identifier,
  requesterLoopRunId: identifier,
  requesterWorkLoopNodeRunId: identifier,
  requesterValidationNodeRunId: identifier,
  reason: nonEmptyText,
  evidence: z.json().optional(),
  stateRevisionAtRequest: z.number().int().nonnegative(),
  nestingDepth: z.number().int().nonnegative().max(32)
};
const repairRequestSchema = z.union([
  z.object({ ...repairRequestFields, requestedCapability: nonEmptyText }).strict(),
  z.object({ ...repairRequestFields, requestedOutcome: z.json() }).strict()
]);

export const orchestratorTaskEnvelopeV2Schema = z.object({
  version: z.literal(2),
  role: z.literal("orchestrator"),
  run: orchestratorRunIdentitySchema,
  loop: loopIdentitySchema,
  task: nonEmptyText,
  state: stateSchema,
  repairRequest: repairRequestSchema,
  allowedTargetLoops: z.array(loopIdentitySchema).max(100),
  resume: resumeSchema.optional(),
  relevantHistory: relevantHistorySchema
}).strict();

export const taskEnvelopeV2Schema = z.union([
  workTaskEnvelopeV2Schema,
  validationTaskEnvelopeV2Schema,
  orchestratorTaskEnvelopeV2Schema
]);
