import { z } from "zod";

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
    kind: z.literal("human"),
    result: z.enum(["approved", "rejected"]),
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

const agentOutcomeFields = {
  summary: z.string().max(20_000),
  artifacts: z.record(z.string(), z.unknown()).optional(),
  checks: z.array(runCheckSchema).max(500)
};

export const agentOutcomeSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("completed").describe("The Step finished and produced a control-flow result."),
    result: z.enum(["approved", "rejected"]).describe(
      "Use rejected when completed work requires another pass; keep feedback in summary and checks."
    ),
    ...agentOutcomeFields
  }).strict(),
  z.object({
    state: z.literal("needs_input").describe("The same Step must pause until the user answers a question."),
    question: z.string().trim().min(1).max(20_000).describe("The exact question for the user."),
    context: z.string().max(20_000).describe("Context the same Step needs when it resumes."),
    ...agentOutcomeFields
  }).strict(),
  z.object({
    state: z.literal("blocked").describe("The Step cannot continue because of an external blocker."),
    ...agentOutcomeFields
  }).strict(),
  z.object({
    state: z.literal("failed").describe("The Step ended because execution failed."),
    ...agentOutcomeFields
  }).strict()
]);

export const agentOutcomeJsonSchema = z.toJSONSchema(agentOutcomeSchema) as Record<string, unknown>;
