import { z } from "zod";
import type { JsonValue } from "../domain/automation.js";
import type {
  CanonicalNodeOutcome, NodeRunRole, OrchestratorNodeOutcome, ValidationNodeOutcome,
  WorkNodeOutcome
} from "../domain/runtime.js";

const idSchema = z.string().uuid();
const boundedText = z.string().max(20_000);
const nonEmptyText = boundedText.trim().min(1);
export const emptyBodySchema = z.object({}).strict();

export const startRunBodySchema = z.object({
  kind: z.literal("loop"),
  targetId: z.string().trim().min(1).max(200),
  input: z.string().max(20_000).optional()
}).strict();

export const rootRunParamsSchema = z.object({ rootRunId: idSchema }).strict();
export const nodeRunParamsSchema = z.object({
  rootRunId: idSchema,
  nodeRunId: idSchema
}).strict();
export const executionTaskParamsSchema = z.object({ taskId: idSchema }).strict();

export const executionEventsQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(500)
}).strict();

const patchPathSchema = z.string().min(1).startsWith("/");
const statePatchOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), path: patchPathSchema, value: z.json() }).strict(),
  z.object({ op: z.literal("remove"), path: patchPathSchema }).strict(),
  z.object({ op: z.literal("replace"), path: patchPathSchema, value: z.json() }).strict()
]);
export const statePatchSchema = z.array(statePatchOperationSchema).min(1).max(128);

export const runCheckSchema = z.object({
  name: z.string().trim().min(1).max(500),
  status: z.enum(["passed", "failed", "skipped"]),
  details: z.string().max(4_000).optional()
}).strict();

const checkedSummary = {
  summary: boundedText,
  checks: z.array(runCheckSchema).max(500)
};

export const workCompletedOutcomeSchema = z.object({
  role: z.literal("work"),
  state: z.literal("completed"),
  ...checkedSummary,
  artifacts: z.record(z.string(), z.json()),
  statePatch: statePatchSchema.optional()
}).strict();

export const workNodeOutcomeSchema = z.union([
  workCompletedOutcomeSchema,
  z.object({
    role: z.literal("work"), state: z.literal("needs_input"), ...checkedSummary,
    question: nonEmptyText, context: boundedText
  }).strict(),
  z.object({ role: z.literal("work"), state: z.literal("blocked"), ...checkedSummary }).strict(),
  z.object({ role: z.literal("work"), state: z.literal("failed"), ...checkedSummary }).strict()
]);

const localRetryRepairSchema = z.object({
  mode: z.literal("LOCAL_RETRY"),
  feedback: nonEmptyText,
  expectedCorrection: nonEmptyText
}).strict();

const orchestratorRepairFields = {
  mode: z.literal("ORCHESTRATOR_REPAIR"),
  reason: nonEmptyText,
  evidenceRefs: z.array(z.string().trim().min(1).max(2_000)).max(500)
};
const orchestratorRepairSchema = z.union([
  z.object({ ...orchestratorRepairFields, requestedCapability: nonEmptyText }).strict(),
  z.object({ ...orchestratorRepairFields, requestedOutcome: z.json() }).strict()
]);

const validationCompletedOkSchema = z.object({
  role: z.literal("validation"), state: z.literal("completed"), decision: z.literal("OK"),
  ...checkedSummary, evidence: z.json(), statePatch: statePatchSchema.optional()
}).strict();
const validationCompletedFailSchema = z.object({
  role: z.literal("validation"), state: z.literal("completed"), decision: z.literal("FAIL"),
  ...checkedSummary, evidence: z.json(), repair: z.union([localRetryRepairSchema, orchestratorRepairSchema])
}).strict();

export const validationNodeOutcomeSchema = z.union([
  validationCompletedOkSchema,
  validationCompletedFailSchema,
  z.object({
    role: z.literal("validation"), state: z.literal("needs_input"), ...checkedSummary,
    question: nonEmptyText, context: boundedText
  }).strict(),
  z.object({ role: z.literal("validation"), state: z.literal("blocked"), ...checkedSummary }).strict(),
  z.object({ role: z.literal("validation"), state: z.literal("failed"), ...checkedSummary }).strict()
]);

export const respondToNodeRunBodySchema = z.union([
  z.object({ kind: z.literal("work"), outcome: workNodeOutcomeSchema }).strict(),
  z.object({ kind: z.literal("validation"), outcome: validationNodeOutcomeSchema }).strict(),
  z.object({ kind: z.literal("resume"), response: nonEmptyText }).strict()
]);

export const orchestratorNodeOutcomeSchema = z.union([
  z.object({
    role: z.literal("orchestrator"), state: z.literal("completed"),
    targetLoopId: z.string().trim().min(1).max(200), routeReason: nonEmptyText,
    repairInput: z.json(), expectedOutcome: z.json()
  }).strict(),
  z.object({
    role: z.literal("orchestrator"), state: z.literal("needs_input"),
    summary: boundedText, question: nonEmptyText, context: boundedText
  }).strict(),
  z.object({ role: z.literal("orchestrator"), state: z.literal("blocked"), summary: boundedText }).strict(),
  z.object({ role: z.literal("orchestrator"), state: z.literal("failed"), summary: boundedText }).strict()
]);

export const canonicalNodeOutcomeSchema = z.union([
  workNodeOutcomeSchema,
  validationNodeOutcomeSchema,
  orchestratorNodeOutcomeSchema
]);

export const workNodeOutcomeJsonSchema = jsonSchema(workNodeOutcomeSchema);
export const validationNodeOutcomeJsonSchema = jsonSchema(validationNodeOutcomeSchema);
export const orchestratorNodeOutcomeJsonSchema = jsonSchema(orchestratorNodeOutcomeSchema);

export const nodeOutcomeSchemaIds = {
  work: "work-node-outcome-v3",
  validation: "validation-node-outcome-v3",
  orchestrator: "orchestrator-node-outcome-v3"
} as const;

export const nodeOutcomeJsonSchemaForRole = (role: NodeRunRole): Record<string, JsonValue> => {
  if (role === "work") return workNodeOutcomeJsonSchema;
  if (role === "validation") return validationNodeOutcomeJsonSchema;
  return orchestratorNodeOutcomeJsonSchema;
};

export function parseNodeOutcomeForRole(role: "work", input: unknown): WorkNodeOutcome;
export function parseNodeOutcomeForRole(role: "validation", input: unknown): ValidationNodeOutcome;
export function parseNodeOutcomeForRole(role: "orchestrator", input: unknown): OrchestratorNodeOutcome;
export function parseNodeOutcomeForRole(role: NodeRunRole, input: unknown): CanonicalNodeOutcome;
export function parseNodeOutcomeForRole(role: NodeRunRole, input: unknown): CanonicalNodeOutcome {
  if (role === "work") return workNodeOutcomeSchema.parse(input);
  if (role === "validation") return validationNodeOutcomeSchema.parse(input);
  return orchestratorNodeOutcomeSchema.parse(input);
}

function jsonSchema(schema: z.ZodType): Record<string, JsonValue> {
  return z.record(z.string(), z.json()).parse(z.toJSONSchema(schema));
}
