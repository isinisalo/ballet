import { z } from "zod";
import { workNodeOutcomeSchema } from "./runtime-schemas.js";

const text = z.string().max(20_000);
const nonEmpty = text.trim().min(1);
const id = z.string().trim().min(1).max(200);
const identity = z.object({ id, description: nonEmpty }).strict();
const run = z.object({
  rootRunId: id,
  graphNodeInvocationId: id,
  actionNodeInvocationId: id,
  nodeRunId: id
}).strict();
const state = z.object({
  revision: z.number().int().nonnegative(),
  value: z.json(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/)
}).strict();
const resume = z.object({ question: nonEmpty, context: text, response: nonEmpty }).strict();
const history = z.array(z.object({
  sequence: z.number().int().nonnegative(),
  nodeRunId: id,
  role: z.enum(["work", "validation"]),
  state: z.enum(["completed", "needs_input", "blocked", "failed"]),
  summary: text,
  stateRevision: z.number().int().nonnegative()
}).strict()).max(8);
const ledger = z.object({
  version: z.literal(1),
  entries: z.array(z.object({
    obligationId: id,
    weight: z.number().int().safe().positive(),
    status: z.enum(["pending", "verified", "invalidated"]),
    evidenceRefs: z.array(id),
    updatedByValidationNodeRunId: id.optional()
  }).strict()),
  sha256: z.string().regex(/^[0-9a-f]{64}$/)
}).strict();
const base = {
  version: z.literal(9),
  run,
  task: nonEmpty,
  state,
  acceptanceLedger: ledger,
  resume: resume.optional(),
  relevantHistory: history
};
const outcome = z.object({ outcomeId: id, result: z.enum(["PASS", "FAIL"]) }).strict();

export const workTaskEnvelopeV9Schema = z.object({
  ...base,
  role: z.literal("work"),
  graphNode: identity,
  actionNode: identity,
  workNode: identity,
  workAttempt: z.number().int().min(1).max(101),
  previousValidationFeedback: z.object({ feedback: nonEmpty, expectedCorrection: nonEmpty }).strict().optional()
}).strict();

export const validationTaskEnvelopeV9Schema = z.object({
  ...base,
  role: z.literal("validation"),
  graphNode: identity,
  actionNode: identity,
  validationNode: identity,
  workAttempt: z.number().int().min(1).max(101),
  workOutcome: workNodeOutcomeSchema,
  allowedOutcomes: z.array(outcome).min(1).max(64),
  retriesRemaining: z.number().int().min(0).max(100)
}).strict();

export const taskEnvelopeV9Schema = z.discriminatedUnion("role", [
  workTaskEnvelopeV9Schema,
  validationTaskEnvelopeV9Schema
]);
