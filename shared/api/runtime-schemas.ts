import { z } from "zod";

const idSchema = z.string().trim().min(1).max(200);
const providerSchema = z.enum(["codex", "copilot"]);
const isoDateSchema = z.iso.datetime({ offset: true });

export const executionPolicySchema = z.object({
  network: z.boolean(),
  readOnlyRoots: z.array(z.string().trim().min(1).max(4096)
    .regex(/^\//, "Read-only roots must be absolute paths.")).max(32)
}).strict();

export const executionBindingBodySchema = z.object({
  provider: providerSchema,
  model: z.string().trim().min(1).max(200),
  reasoningEffort: z.string().trim().min(1).max(100),
  policy: executionPolicySchema
}).strict();

export const agentExecutionParamsSchema = z.object({ agentId: idSchema }).strict();
export const executionTaskParamsSchema = z.object({ taskId: idSchema }).strict();
export const emptyRuntimeBodySchema = z.object({}).strict();
export const runtimeLogQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(1000).default(200) }).strict();

export const runtimeModelCapabilitySchema = z.object({
  id: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  reasoningOptions: z.array(z.string().trim().min(1).max(100)).max(20),
  defaultReasoning: z.string().trim().min(1).max(100).optional()
}).strict();

export const runtimeCapabilitiesSchema = z.object({
  models: z.array(runtimeModelCapabilitySchema).max(500),
  supportsResume: z.boolean(),
  supportsStructuredOutput: z.boolean(),
  policy: z.object({
    workspaceWrite: z.boolean(), networkControl: z.boolean(), readOnlyRoots: z.boolean()
  }).strict(),
  refreshedAt: isoDateSchema
}).strict();

export const localProviderStatusSchema = z.object({
  provider: providerSchema,
  cliVersion: z.string().trim().min(1).max(100).optional(),
  authStatus: z.enum(["ready", "required", "expired", "unknown"]),
  health: z.enum(["ready", "probing", "auth_required", "unsupported_version", "policy_unsupported", "error", "offline"]),
  healthMessage: z.string().max(2000).optional(),
  capabilities: runtimeCapabilitiesSchema,
  busy: z.boolean(),
  updatedAt: isoDateSchema
}).strict();

export const localDaemonHeartbeatBodySchema = z.object({
  pid: z.number().int().positive(),
  daemonVersion: z.string().trim().min(1).max(100),
  uptimeSeconds: z.number().int().nonnegative(),
  activeTaskCount: z.number().int().nonnegative(),
  providers: z.array(localProviderStatusSchema).length(2),
  recentError: z.string().max(4000).optional()
}).strict();

export const localDaemonClaimBodySchema = z.object({ provider: providerSchema }).strict();
export const localDaemonLeaseBodySchema = z.object({ fencing: z.number().int().positive() }).strict();
export const localDaemonEventSchema = z.object({
  sequence: z.number().int().positive(), source: z.enum(["ballet", "codex", "copilot"]),
  kind: z.string().trim().min(1).max(100), level: z.enum(["info", "warn", "error"]),
  phase: z.enum(["started", "delta", "completed"]), message: z.string().max(256_000),
  data: z.record(z.string(), z.unknown()).optional(), terminal: z.boolean(), createdAt: isoDateSchema
}).strict();
export const localDaemonEventBatchBodySchema = z.object({
  fencing: z.number().int().positive(), events: z.array(localDaemonEventSchema).min(1).max(200)
}).strict();
export const localDaemonCompleteBodySchema = z.object({
  fencing: z.number().int().positive(), providerOutcomeKey: z.string().trim().min(1).max(500),
  rawOutput: z.string().max(1_000_000)
}).strict();
export const localDaemonFailBodySchema = z.object({
  fencing: z.number().int().positive(), providerOutcomeKey: z.string().trim().min(1).max(500),
  errorMessage: z.string().trim().min(1).max(20_000)
}).strict();
export const localDaemonCancelBodySchema = localDaemonLeaseBodySchema;
export const localDaemonDiagnosticsBodySchema = z.object({
  lines: z.array(z.string().max(16_000)).max(200)
}).strict();
