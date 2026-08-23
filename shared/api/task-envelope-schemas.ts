import { z } from "zod";
import { workNodeOutcomeSchema } from "./runtime-schemas.js";

const text = z.string().max(20_000);
const nonEmpty = text.trim().min(1);
const id = z.string().trim().min(1).max(200);
const identity = z.object({ id, description: nonEmpty }).strict();
const run = z.object({
  rootRunId: id,
  graphNodeInvocationId: id.optional(),
  jobNodeInvocationId: id.optional(),
  nodeRunId: id
}).strict();
const state = z.object({ revision: z.number().int().nonnegative(), value: z.json(), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
const resume = z.object({ question: nonEmpty, context: text, response: nonEmpty }).strict();
const history = z.array(z.object({
  sequence: z.number().int().nonnegative(), nodeRunId: id,
  role: z.enum(["work", "validation", "orchestrator", "repair"]),
  state: z.enum(["completed", "needs_input", "blocked", "failed"]),
  summary: text, stateRevision: z.number().int().nonnegative()
}).strict()).max(8);
const base = { version: z.literal(8), run, task: nonEmpty, state, resume: resume.optional(), relevantHistory: history };
const candidate = z.object({ key: id, description: nonEmpty }).strict();
const outcome = z.object({ outcomeId: id, result: z.enum(["PASS", "FAIL"]) }).strict();

export const workTaskEnvelopeV8Schema = z.object({
  ...base, role: z.literal("work"), graphNode: identity, jobNode: identity, workNode: identity,
  workAttempt: z.number().int().min(1).max(101),
  previousValidationFeedback: z.object({ feedback: nonEmpty, expectedCorrection: nonEmpty }).strict().optional()
}).strict();
export const validationTaskEnvelopeV8Schema = z.object({
  ...base, role: z.literal("validation"), graphNode: identity, jobNode: identity, validationNode: identity,
  workAttempt: z.number().int().min(1).max(101), workOutcome: workNodeOutcomeSchema,
  allowedOutcomes: z.array(outcome).max(64),
  repairReturn: z.object({
    repairRequestId: id, repairResultId: id, stateRevision: z.number().int().nonnegative(), summary: nonEmpty
  }).strict().optional()
}).strict();
export const orchestratorTaskEnvelopeV8Schema = z.object({
  ...base, role: z.literal("orchestrator"), scope: z.enum(["graph", "graph_node"]), graphNode: identity.optional(),
  request: z.object({
    id, kind: z.enum(["start", "continuation", "repair"]), sourceChildId: id.optional(),
    result: z.enum(["PASS", "FAIL"]).optional(), requestedCapability: nonEmpty.optional(), evidence: z.json()
  }).strict(),
  allowedCandidates: z.array(candidate).max(256), allowedOutcomes: z.array(outcome).max(64), repairAvailable: z.boolean()
}).strict();
export const repairTaskEnvelopeV8Schema = z.object({
  ...base, role: z.literal("repair"), scope: z.enum(["graph", "graph_node"]), graphNode: identity.optional(),
  request: z.object({
    id, reason: nonEmpty, requestedCapability: nonEmpty.optional(), evidence: z.json(),
    returnValidationNodeId: id, attempt: z.number().int().min(1).max(100), depth: z.number().int().min(0).max(100)
  }).strict(),
  allowedCandidates: z.array(candidate).max(256), parentEscalationAvailable: z.boolean()
}).strict();
export const taskEnvelopeV8Schema = z.discriminatedUnion("role", [
  workTaskEnvelopeV8Schema, validationTaskEnvelopeV8Schema, orchestratorTaskEnvelopeV8Schema, repairTaskEnvelopeV8Schema
]);
