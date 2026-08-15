import { z } from "zod";
import type { JsonValue } from "../domain/automation.js";

const idSchema = z.string().uuid();
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

const outcomeBase = {
  summary: z.string().max(20_000),
  statePatch: statePatchSchema.optional(),
  evidence: z.json().optional()
};

const workNodeOutcomeSchema = z.discriminatedUnion("status", [
  z.object({
    role: z.literal("work"), status: z.literal("completed"), ...outcomeBase
  }).strict(),
  z.object({
    role: z.literal("work"), status: z.literal("needs_input"),
    question: z.string().trim().min(1).max(20_000), context: z.string().max(20_000), ...outcomeBase
  }).strict(),
  z.object({
    role: z.literal("work"), status: z.literal("blocked"), ...outcomeBase
  }).strict(),
  z.object({
    role: z.literal("work"), status: z.literal("failed"), ...outcomeBase
  }).strict()
]);

const repairSchema = z.object({
  mode: z.enum(["LOCAL_RETRY", "ORCHESTRATOR_REPAIR"]),
  requestedCapability: z.string().trim().min(1).max(2_000).optional(),
  reason: z.string().trim().min(1).max(20_000),
  evidence: z.json().optional()
}).strict();

const validationNodeOutcomeSchema = z.discriminatedUnion("decision", [
  z.object({ role: z.literal("validation"), decision: z.literal("OK"), ...outcomeBase }).strict(),
  z.object({
    role: z.literal("validation"), decision: z.literal("FAIL"), repair: repairSchema, ...outcomeBase
  }).strict()
]);

const orchestratorNodeOutcomeSchema = z.object({
  role: z.literal("orchestrator"),
  status: z.enum(["routed", "blocked", "failed"]),
  loopEdgeId: z.string().trim().min(1).max(200).optional(),
  targetLoopId: z.string().trim().min(1).max(200).optional(),
  ...outcomeBase
}).strict();

export const nodeOutcomeSchema = z.union([
  workNodeOutcomeSchema,
  validationNodeOutcomeSchema,
  orchestratorNodeOutcomeSchema
]);
export const nodeOutcomeJsonSchema: Record<string, JsonValue> = z.record(z.string(), z.json())
  .parse(z.toJSONSchema(nodeOutcomeSchema));
