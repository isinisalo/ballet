import { z } from "zod";
import { canonicalNodeOutcomeSchema, jobCompletedOutcomeSchema } from "./runtime-schemas.js";

const boundedText = z.string().max(20_000);
const nonEmptyText = boundedText.trim().min(1);
const identifier = z.string().trim().min(1).max(200);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

const providerRunIdentitySchema = z.object({
  rootRunId: identifier,
  loopRunId: identifier,
  nodeRunId: identifier,
  jobRunId: identifier
}).strict();
const orchestratorRunIdentitySchema = z.object({
  rootRunId: identifier,
  loopRunId: identifier,
  nodeRunId: identifier
}).strict();
const loopIdentitySchema = z.object({ id: identifier, description: nonEmptyText }).strict();
const workflowNodeIdentitySchema = z.object({ id: identifier, description: nonEmptyText }).strict();
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
  role: z.enum(["job", "validation", "orchestrator"]),
  state: z.enum(["completed", "needs_input", "blocked", "failed"]),
  summary: boundedText,
  stateRevision: z.number().int().nonnegative()
}).strict();
const relevantHistorySchema = z.array(historyEntrySchema).max(8);

const commonProviderFields = {
  version: z.literal(5),
  run: providerRunIdentitySchema,
  loop: loopIdentitySchema,
  jobNode: workflowNodeIdentitySchema,
  task: nonEmptyText,
  state: stateSchema,
  jobAttempt: z.number().int().min(1).max(101),
  resume: resumeSchema.optional(),
  relevantHistory: relevantHistorySchema
};

export const jobTaskEnvelopeV5Schema = z.object({
  role: z.literal("job"),
  ...commonProviderFields,
  previousValidationFeedback: z.object({
    feedback: nonEmptyText,
    expectedCorrection: nonEmptyText
  }).strict().optional()
}).strict();

const repairRequestFields = {
  id: identifier,
  requesterLoopRunId: identifier,
  requesterJobRunId: identifier,
  requesterValidationNodeRunId: identifier,
  attempt: z.number().int().min(1).max(100),
  validationSummary: nonEmptyText,
  reason: nonEmptyText,
  evidence: z.json().optional(),
  stateRevisionAtRequest: z.number().int().nonnegative(),
  nestingDepth: z.number().int().nonnegative().max(32)
};
export const taskEnvelopeRepairRequestSchema = z.union([
  z.object({ ...repairRequestFields, requestedCapability: nonEmptyText }).strict(),
  z.object({ ...repairRequestFields, requestedOutcome: z.json() }).strict()
]);

export const taskEnvelopeRepairReturnSchema = z.object({
  repairRequest: taskEnvelopeRepairRequestSchema,
  repairResult: z.object({
    id: identifier,
    frameId: identifier,
    targetLoopRunId: identifier,
    targetLoopId: identifier,
    stateRevision: z.number().int().nonnegative(),
    outcome: canonicalNodeOutcomeSchema.optional(),
    summary: nonEmptyText
  }).strict()
}).strict();

export const validationTaskEnvelopeV5Schema = z.object({
  role: z.literal("validation"),
  ...commonProviderFields,
  validationNode: workflowNodeIdentitySchema,
  jobOutcome: jobCompletedOutcomeSchema,
  repairReturn: taskEnvelopeRepairReturnSchema.optional()
}).strict();

const targetLoopSchema = z.object({
  id: identifier,
  description: nonEmptyText,
  capabilities: z.object({
    accepts: z.array(nonEmptyText).max(64),
    provides: z.array(nonEmptyText).max(64)
  }).strict(),
  route: z.object({
    kind: z.enum(["flow", "repair"]),
    capability: nonEmptyText,
    description: nonEmptyText
  }).strict()
}).strict();

const orchestrationRequestSchema = z.object({
  id: identifier,
  kind: z.enum(["flow", "repair"]),
  sourceLoopId: identifier,
  sourceLoopRunId: identifier,
  sourceNodeRunId: identifier,
  stateRevisionAtRequest: z.number().int().nonnegative(),
  completionSummary: boundedText,
  completionEvidence: z.json(),
  requestedCapability: nonEmptyText.optional(),
  expectedOutcome: z.json().optional()
}).strict();

export const orchestratorTaskEnvelopeV5Schema = z.object({
  version: z.literal(5),
  role: z.literal("orchestrator"),
  run: orchestratorRunIdentitySchema,
  loop: loopIdentitySchema,
  task: nonEmptyText,
  state: stateSchema,
  orchestrationRequest: orchestrationRequestSchema,
  allowedCandidates: z.array(targetLoopSchema).max(100),
  resume: resumeSchema.optional(),
  relevantHistory: relevantHistorySchema
}).strict();

export const taskEnvelopeV5Schema = z.union([
  jobTaskEnvelopeV5Schema,
  validationTaskEnvelopeV5Schema,
  orchestratorTaskEnvelopeV5Schema
]);
