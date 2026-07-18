import { z } from "zod";
import { agentOutcomeStatuses, humanDecisions } from "../domain/outcomes.js";

const idSchema = z.string().uuid();
const runtimeProviderSchema = z.enum(["codex", "copilot"]);
export const emptyBodySchema = z.object({}).strict();

export const executionPolicySchema = z.object({
  network: z.boolean(),
  readOnlyRoots: z.array(z.string().trim().min(1).max(4096)
    .regex(/^\//, "Read-only roots must be absolute paths.")).max(32)
}).strict();

export const portableAgentRuntimeIntentSchema = z.object({
  provider: runtimeProviderSchema,
  model: z.string().trim().min(1).max(200),
  reasoning: z.string().trim().min(1).max(100),
  policy: z.object({ network: z.boolean() }).strict()
}).strict();

export const agentRuntimeConfigurationBodySchema = z.object({
  provider: runtimeProviderSchema,
  model: z.string().trim().min(1).max(200),
  reasoning: z.string().trim().min(1).max(100),
  policy: executionPolicySchema
}).strict();

export const startRunBodySchema = z.object({
  kind: z.enum(["agent", "loop"]),
  targetId: z.string().trim().min(1).max(200),
  input: z.string().max(20_000).optional()
}).strict();

export const rootRunParamsSchema = z.object({ rootRunId: idSchema }).strict();
export const stepRunParamsSchema = z.object({
  rootRunId: idSchema,
  stepRunId: idSchema
}).strict();
export const executionTaskParamsSchema = z.object({ taskId: idSchema }).strict();
export const agentExecutionParamsSchema = z.object({
  agentId: z.string().trim().min(1).max(200)
}).strict();

export const executionEventsQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(500)
}).strict();

const runResponseInputSchema = z.string().max(20_000)
  .refine((value) => value.trim().length > 0, "Response input is required.");

export const respondToRunStepBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("human-decision"),
    decision: z.enum(humanDecisions),
    input: runResponseInputSchema
  }).strict(),
  z.object({
    kind: z.literal("resume"),
    input: runResponseInputSchema
  }).strict()
]);

const runCheckSchema = z.object({
  name: z.string().trim().min(1).max(500),
  status: z.enum(["passed", "failed", "skipped"]),
  details: z.string().max(4000).optional()
}).strict();

export const agentOutcomeSchema = z.object({
  outcome: z.enum(agentOutcomeStatuses),
  summary: z.string().max(20_000),
  failure: z.object({
    classification: z.enum(["transient", "permanent"]),
    code: z.string().trim().min(1).max(200).optional()
  }).strict().optional(),
  artifacts: z.record(z.string(), z.unknown()).optional(),
  checks: z.array(runCheckSchema).max(500)
}).strict();

export const agentOutcomeJsonSchema = z.toJSONSchema(agentOutcomeSchema) as Record<string, unknown>;
