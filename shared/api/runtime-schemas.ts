import { z } from "zod";
import { orchestratorRouteSchema } from "./runtime-orchestration-schemas.js";
export {
  orchestrationRequestSchema, orchestratorRouteSchema, rootRunOrchestrationProjectionSchema
} from "./runtime-orchestration-schemas.js";
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

export const rootRunListQuerySchema = z.object({
  state: z.enum(["active", "recent"]).optional(),
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
}).strict();

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
    dispatchInput: z.json(), expectedOutcome: z.json()
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

const patchEvidenceSchema = z.object({
  patch: statePatchSchema,
  patchSha256: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();

export const loopStateRevisionMetadataSchema = z.object({
  rootRunId: idSchema,
  revision: z.number().int().nonnegative(),
  parentRevision: z.number().int().nonnegative().optional(),
  stateSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceNodeRunId: idSchema.optional(),
  patch: patchEvidenceSchema.optional(),
  patchOmitted: z.boolean(),
  createdAt: z.string()
}).strict();

export const rootRunStateProjectionSchema = z.object({
  currentRevision: z.number().int().nonnegative(),
  currentState: z.json().optional(),
  currentStateSha256: z.string().regex(/^[a-f0-9]{64}$/),
  revisions: z.array(loopStateRevisionMetadataSchema).max(64),
  totalRevisionCount: z.number().int().positive(),
  historyTruncated: z.boolean()
}).strict();

export const rootRunReturnDestinationSchema = z.object({
  loopId: z.string().min(1),
  workLoopNodeId: z.string().min(1),
  validationNodeDefinitionId: z.string().min(1)
}).strict();

export const repairRequestSchema = z.object({
  repairRequestId: idSchema,
  rootRunId: idSchema,
  requesterLoopRunId: idSchema,
  requesterWorkLoopNodeRunId: idSchema,
  requesterValidationNodeRunId: idSchema,
  mode: z.enum(["local", "orchestrator"]),
  attempt: z.number().int().positive(),
  validationSummary: nonEmptyText,
  requestedCapability: nonEmptyText.optional(),
  requestedOutcome: z.json().optional(),
  reason: nonEmptyText,
  evidence: z.json().optional(),
  stateRevisionAtRequest: z.number().int().nonnegative(),
  orchestratorNodeRunId: idSchema.optional(),
  routedLoopEdgeId: z.string().min(1).optional(),
  routedTargetLoopId: z.string().min(1).optional(),
  status: z.enum(["pending", "routed", "repaired", "failed", "cancelled"]),
  returnLoopId: z.string().min(1),
  returnWorkLoopNodeId: z.string().min(1),
  returnValidationNodeDefinitionId: z.string().min(1),
  nestingDepth: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional()
}).strict().refine((value) =>
  (value.requestedCapability === undefined) !== (value.requestedOutcome === undefined), {
  message: "Repair Request requires exactly one requested capability or requested outcome."
});

export const orchestrationFrameSchema = z.object({
  frameId: idSchema,
  rootRunId: idSchema,
  repairRequestId: idSchema,
  routeId: idSchema,
  callerLoopRunId: idSchema,
  calleeLoopRunId: idSchema,
  parentFrameId: idSchema.optional(),
  returnLoopId: z.string().min(1),
  returnWorkLoopNodeId: z.string().min(1),
  returnValidationNodeDefinitionId: z.string().min(1),
  stateRevisionAtCall: z.number().int().nonnegative(),
  nestingDepth: z.number().int().nonnegative(),
  status: z.enum(["open", "returned", "failed", "cancelled"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional()
}).strict();

export const repairResultSchema = z.object({
  repairResultId: idSchema,
  rootRunId: idSchema,
  repairRequestId: idSchema,
  orchestrationFrameId: idSchema,
  targetLoopRunId: idSchema,
  targetLoopId: z.string().min(1),
  status: z.enum(["repaired", "blocked", "failed", "cancelled"]),
  stateRevision: z.number().int().nonnegative(),
  outcome: canonicalNodeOutcomeSchema.optional(),
  summary: boundedText,
  createdAt: z.string()
}).strict();

export const rootRunRepairProjectionSchema = z.object({
  requests: z.array(repairRequestSchema).max(256),
  routes: z.array(orchestratorRouteSchema).max(256),
  continuations: z.array(orchestrationFrameSchema).max(256),
  results: z.array(repairResultSchema).max(256),
  activeContinuationChain: z.array(orchestrationFrameSchema).max(256),
  pendingRepair: repairRequestSchema.optional(),
  routedTarget: orchestratorRouteSchema.optional(),
  returnDestination: rootRunReturnDestinationSchema.optional()
}).strict();

export const controlFlowEventSchema = z.object({
  id: z.number().int().positive(),
  rootRunId: idSchema,
  sequence: z.number().int().positive(),
  kind: z.enum([
    "work_completed", "work_needs_input", "work_terminal", "validation_ok",
    "validation_fail_local", "validation_fail_orchestrator", "validation_terminal",
    "repair_call", "repair_return", "repair_terminal", "flow_transition",
    "orchestrator_terminal", "root_cancelled", "root_terminal", "execution_interrupted"
  ]),
  stateRevision: z.number().int().nonnegative(),
  sourceLoopRunId: idSchema.optional(),
  sourceWorkLoopNodeRunId: idSchema.optional(),
  sourceNodeRunId: idSchema.optional(),
  targetLoopRunId: idSchema.optional(),
  targetWorkLoopNodeRunId: idSchema.optional(),
  orchestrationRequestId: idSchema.optional(),
  repairRequestId: idSchema.optional(),
  orchestrationFrameId: idSchema.optional(),
  createdAt: z.string()
}).strict();

export const workspaceInvalidationEventSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.number().int().nonnegative(),
    type: z.literal("workspace-changed"),
    at: z.string(),
    reason: z.string().max(1_000).optional()
  }).strict(),
  z.object({
    id: z.number().int().nonnegative(),
    type: z.literal("runs-changed"),
    at: z.string(),
    rootRunId: idSchema,
    stateRevision: z.number().int().nonnegative(),
    status: z.enum([
      "queued", "running", "waiting_for_input", "finalizing", "completed",
      "blocked", "failed", "cancelled"
    ])
  }).strict()
]);

export const workNodeOutcomeJsonSchema = jsonSchema(workNodeOutcomeSchema);
export const validationNodeOutcomeJsonSchema = jsonSchema(validationNodeOutcomeSchema);
export const orchestratorNodeOutcomeJsonSchema = jsonSchema(orchestratorNodeOutcomeSchema);

export const nodeOutcomeSchemaIds = {
  work: "work-node-outcome-v4",
  validation: "validation-node-outcome-v4",
  orchestrator: "orchestrator-node-outcome-v4"
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
