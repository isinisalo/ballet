import { z } from "zod";

const idSchema = z.string().uuid();
const projectIdSchema = z.string().trim().min(1).max(200);
const runtimeProviderSchema = z.enum(["codex", "copilot"]);
const isoDateSchema = z.iso.datetime({ offset: true });

export const executionPolicySchema = z.object({
  network: z.boolean(),
  readOnlyRoots: z.array(z.string().trim().min(1).max(4096).regex(/^\//, "Read-only roots must be absolute paths.")).max(32)
}).strict();

export const executionBindingBodySchema = z.object({
  runtimeBackendId: idSchema,
  model: z.string().trim().min(1).max(200),
  reasoning: z.string().trim().min(1).max(100),
  policy: executionPolicySchema
}).strict();

export const startRunBodySchema = z.object({
  input: z.string().max(20_000).optional()
}).strict();

export const runtimeDeviceParamsSchema = z.object({ deviceId: idSchema }).strict();
export const runtimeBackendParamsSchema = z.object({ runtimeBackendId: idSchema }).strict();
export const pairingParamsSchema = z.object({ pairingId: idSchema }).strict();
export const agentExecutionParamsSchema = z.object({ agentId: z.string().trim().min(1).max(200) }).strict();
export const agentRunParamsV1Schema = z.object({ runId: idSchema }).strict();
export const executionTaskParamsSchema = z.object({ taskId: idSchema }).strict();
export const rootRunParamsSchema = z.object({ rootRunId: idSchema }).strict();

export const runtimeListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(["all", "online", "issues"]).default("all")
}).strict();

export const executionEventsQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(500)
}).strict();

export const adminBootstrapBodySchema = z.object({
  password: z.string().min(12).max(1024)
}).strict();

export const adminLoginBodySchema = adminBootstrapBodySchema;

export const pairingSessionCreateBodySchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional()
}).strict();

export const pairingApprovalBodySchema = z.object({}).strict();

export const daemonPairingPollBodySchema = z.object({
  deviceCode: z.string().min(32).max(512),
  hostname: z.string().trim().min(1).max(255),
  displayName: z.string().trim().min(1).max(200).optional(),
  platform: z.literal("darwin"),
  architecture: z.enum(["arm64", "x64"]),
  daemonVersion: z.string().trim().min(1).max(100),
  daemonId: idSchema
}).strict();

export const runtimeModelCapabilitySchema = z.object({
  id: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  reasoningOptions: z.array(z.string().trim().min(1).max(100)).max(20),
  defaultReasoning: z.string().trim().min(1).max(100).optional()
}).strict();

export const daemonBackendHeartbeatSchema = z.object({
  id: idSchema,
  provider: runtimeProviderSchema,
  cliVersion: z.string().trim().min(1).max(100).optional(),
  executablePath: z.string().trim().min(1).max(4096).optional(),
  authStatus: z.enum(["ready", "required", "expired", "unknown"]),
  health: z.enum(["ready", "probing", "auth_required", "unsupported_version", "policy_unsupported", "error", "offline"]),
  healthMessage: z.string().max(2000).optional(),
  capabilities: z.object({
    models: z.array(runtimeModelCapabilitySchema).max(500),
    supportsResume: z.boolean(),
    supportsStructuredOutput: z.boolean(),
    policy: z.object({
      workspaceWrite: z.boolean(),
      networkControl: z.boolean(),
      readOnlyRoots: z.boolean()
    }).strict(),
    refreshedAt: isoDateSchema
  }).strict()
}).strict();

export const daemonCheckoutHeartbeatSchema = z.object({
  repositoryUrl: z.string().trim().min(1).max(4096),
  path: z.string().trim().min(1).max(4096),
  headSha: z.string().regex(/^[0-9a-f]{40}$/i).optional(),
  configHash: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
  dirty: z.boolean(),
  inspectionId: z.string().uuid().optional(),
  lastInspectedAt: isoDateSchema.optional()
}).strict();

export const daemonHeartbeatBodySchema = z.object({
  daemonVersion: z.string().trim().min(1).max(100),
  uptimeSeconds: z.number().int().nonnegative(),
  backends: z.array(daemonBackendHeartbeatSchema).max(2),
  checkout: daemonCheckoutHeartbeatSchema.optional(),
  recentError: z.string().max(4000).optional()
}).strict();

export const daemonClaimBodySchema = z.object({
  runtimeBackendId: idSchema
}).strict();

const fencedTaskBody = {
  taskToken: z.string().min(32).max(512),
  fencing: z.number().int().positive()
};

export const daemonLeaseBodySchema = z.object(fencedTaskBody).strict();

export const daemonCancelBodySchema = z.object({
  ...fencedTaskBody,
  worktreePath: z.string().max(4096).optional()
}).strict();

const rootFinalizationReportFields = {
  success: z.boolean(),
  retained: z.boolean(),
  branch: z.string().trim().min(1).max(500).regex(/^ballet\/run\/[a-zA-Z0-9._-]+$/),
  worktreePath: z.string().trim().min(1).max(4096).regex(/^\//),
  commitSha: z.string().regex(/^[0-9a-f]{40}$/i).optional(),
  changedFiles: z.array(z.string().trim().min(1).max(4096)
    .refine((value) => !value.startsWith("/") && !value.split("/").includes(".."), "Changed files must be safe relative paths.")).max(10_000),
  snapshotHash: z.string().regex(/^[0-9a-f]{64}$/i)
};

const validateRootFinalization = (
  value: { success: boolean; retained: boolean; commitSha?: string },
  context: z.RefinementCtx
) => {
  if (value.retained === value.success) {
    context.addIssue({ code: "custom", message: "Successful roots are cleaned up; unsuccessful roots must be retained." });
  }
  if (value.success && !value.commitSha) {
    context.addIssue({ code: "custom", path: ["commitSha"], message: "A successful root finalization requires the commit SHA." });
  }
};

export const daemonFencedRootFinalizationBodySchema = z.object({
  ...fencedTaskBody,
  ...rootFinalizationReportFields
}).strict().superRefine(validateRootFinalization);

export const daemonRequestedRootFinalizationBodySchema = z.object({
  projectId: projectIdSchema,
  ...rootFinalizationReportFields
}).strict().superRefine(validateRootFinalization);

export const daemonRootFinalizationBodySchema = z.union([
  daemonFencedRootFinalizationBodySchema,
  daemonRequestedRootFinalizationBodySchema
]);

export const executionEventUploadSchema = z.object({
  sequence: z.number().int().nonnegative(),
  source: z.enum(["ballet", "codex", "copilot"]),
  kind: z.enum(["system", "think", "agent", "command", "output", "file", "tool", "info", "warn", "error"]),
  level: z.enum(["info", "warn", "error"]),
  phase: z.enum(["started", "delta", "completed"]),
  itemId: z.string().max(500).optional(),
  message: z.string().max(256_000),
  data: z.record(z.string(), z.unknown()).optional(),
  terminal: z.boolean().default(false),
  createdAt: isoDateSchema
}).strict();

export const daemonEventBatchBodySchema = z.object({
  ...fencedTaskBody,
  events: z.array(executionEventUploadSchema).min(1).max(200)
}).strict();

export const daemonTaskStateBodySchema = z.object({
  ...fencedTaskBody,
  status: z.enum(["preparing", "running"])
}).strict();

const runCheckSchema = z.object({
  name: z.string().trim().min(1).max(500),
  status: z.enum(["passed", "failed", "skipped"]),
  details: z.string().max(4000).optional()
}).strict();

export const agentOutcomeSchema = z.object({
  outcome: z.enum(["ready", "blocked", "needs_input", "approved", "changes-requested", "failed"]),
  summary: z.string().max(20_000),
  artifacts: z.record(z.string(), z.unknown()).optional(),
  checks: z.array(runCheckSchema).max(500)
}).strict();

export const daemonCompleteBodySchema = z.object({
  ...fencedTaskBody,
  outcome: agentOutcomeSchema,
  branch: z.string().max(500).optional(),
  worktreePath: z.string().max(4096).optional()
}).strict();

export const daemonFailBodySchema = z.object({
  ...fencedTaskBody,
  errorCode: z.enum(["runtime_lost", "invalid_outcome", "policy_denied", "unsupported_version", "execution_failed"]),
  errorMessage: z.string().trim().min(1).max(20_000),
  worktreePath: z.string().max(4096).optional()
}).strict();

export const daemonDiagnosticsBodySchema = z.object({
  lines: z.array(z.string().max(16_000)).max(2000)
}).strict();

export const projectRegistrationSchema = z.object({
  id: projectIdSchema,
  repositoryUrl: z.string().trim().min(1).max(4096),
  checkoutPath: z.string().trim().min(1).max(4096)
}).strict();
