import { z } from "zod";
import type { JsonValue } from "../domain/automation.js";
import type {
  CanonicalNodeOutcome, NodeRunRole, OrchestratorNodeOutcome, RepairNodeOutcome,
  ValidationNodeOutcome, WorkNodeOutcome
} from "../domain/runtime.js";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)
]));
const statePatchOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), path: z.string(), value: jsonValueSchema }).strict(),
  z.object({ op: z.literal("remove"), path: z.string() }).strict(),
  z.object({ op: z.literal("replace"), path: z.string(), value: jsonValueSchema }).strict()
]);
const statePatchSchema = z.array(statePatchOperationSchema).max(128);
const checksSchema = z.array(z.object({
  name: z.string().min(1), status: z.enum(["passed", "failed", "skipped"]), details: z.string().optional()
}).strict());
const summary = z.string().trim().min(1).max(20_000);

export const workNodeOutcomeSchema = z.discriminatedUnion("state", [
  z.object({
    role: z.literal("work"), state: z.literal("completed"), summary, checks: checksSchema,
    artifacts: z.record(z.string(), jsonValueSchema), statePatch: statePatchSchema.optional()
  }).strict(),
  z.object({
    role: z.literal("work"), state: z.literal("needs_input"), summary, checks: checksSchema,
    question: summary, context: summary
  }).strict(),
  z.object({ role: z.literal("work"), state: z.literal("blocked"), summary, checks: checksSchema }).strict(),
  z.object({ role: z.literal("work"), state: z.literal("failed"), summary, checks: checksSchema }).strict()
]) satisfies z.ZodType<WorkNodeOutcome>;

export const validationNodeOutcomeSchema = z.object({
  role: z.literal("validation"),
  state: z.literal("completed"),
  summary,
  checks: checksSchema,
  decision: z.enum(["PASS", "FAIL"]),
  evidence: jsonValueSchema,
  feedback: summary.optional(),
  expectedCorrection: summary.optional(),
  repairRequest: z.object({
    reason: summary,
    requestedCapability: z.string().min(1),
    evidenceRefs: z.array(z.string())
  }).strict().optional(),
  statePatch: statePatchSchema.optional()
}).strict().superRefine((outcome, context) => {
  if (outcome.decision === "PASS" && (outcome.feedback || outcome.expectedCorrection || outcome.repairRequest)) {
    context.addIssue({ code: "custom", path: ["decision"], message: "PASS cannot request repair or correction." });
  }
  if (outcome.decision === "FAIL" && outcome.statePatch) {
    context.addIssue({ code: "custom", path: ["statePatch"], message: "FAIL cannot patch State." });
  }
}) as z.ZodType<ValidationNodeOutcome>;

export const orchestratorNodeOutcomeSchema = z.discriminatedUnion("action", [
  z.object({
    role: z.literal("orchestrator"), state: z.literal("completed"), action: z.literal("dispatch"),
    summary, target: z.string().min(1), reason: summary, dispatchInput: jsonValueSchema.optional()
  }).strict(),
  z.object({
    role: z.literal("orchestrator"), state: z.literal("completed"), action: z.literal("complete"),
    summary, result: z.enum(["PASS", "FAIL"]), reason: summary
  }).strict(),
  z.object({
    role: z.literal("orchestrator"), state: z.literal("completed"), action: z.literal("delegate_repair"),
    summary, reason: summary
  }).strict(),
  z.object({
    role: z.literal("orchestrator"), state: z.literal("needs_input"), action: z.literal("needs_input"),
    summary, question: summary, context: summary
  }).strict()
]) satisfies z.ZodType<OrchestratorNodeOutcome>;

export const repairNodeOutcomeSchema = z.discriminatedUnion("action", [
  z.object({
    role: z.literal("repair"), state: z.literal("completed"), action: z.literal("revalidate"),
    summary, artifacts: z.record(z.string(), jsonValueSchema), statePatch: statePatchSchema.optional()
  }).strict(),
  z.object({
    role: z.literal("repair"), state: z.literal("completed"), action: z.literal("dispatch"),
    summary, target: z.string().min(1), reason: summary, artifacts: z.record(z.string(), jsonValueSchema),
    statePatch: statePatchSchema.optional()
  }).strict(),
  z.object({
    role: z.literal("repair"), state: z.literal("completed"), action: z.literal("escalate"), summary, reason: summary
  }).strict(),
  z.object({
    role: z.literal("repair"), state: z.literal("needs_input"), action: z.literal("needs_input"),
    summary, question: summary, context: summary
  }).strict()
]) satisfies z.ZodType<RepairNodeOutcome>;

export const canonicalNodeOutcomeSchema = z.union([
  workNodeOutcomeSchema, validationNodeOutcomeSchema, orchestratorNodeOutcomeSchema, repairNodeOutcomeSchema
]) satisfies z.ZodType<CanonicalNodeOutcome>;
export const nodeOutcomeSchemaIds = {
  work: "work-node-outcome-v7",
  validation: "validation-node-outcome-v7",
  orchestrator: "orchestrator-node-outcome-v7",
  repair: "repair-node-outcome-v7"
} as const;
export const nodeOutcomeSchemaForRole = (role: NodeRunRole) => ({
  work: workNodeOutcomeSchema,
  validation: validationNodeOutcomeSchema,
  orchestrator: orchestratorNodeOutcomeSchema,
  repair: repairNodeOutcomeSchema
})[role];
export const parseNodeOutcomeForRole = (role: NodeRunRole, value: unknown): CanonicalNodeOutcome =>
  nodeOutcomeSchemaForRole(role).parse(value) as CanonicalNodeOutcome;
export const nodeOutcomeJsonSchemaForRole = (role: NodeRunRole): Record<string, JsonValue> =>
  z.toJSONSchema(nodeOutcomeSchemaForRole(role), { target: "draft-07", unrepresentable: "any" }) as Record<string, JsonValue>;

export const emptyBodySchema = z.object({}).strict();
export const startRunBodySchema = z.object({
  kind: z.enum(["graph", "graph_node"]), targetId: z.string().min(1), input: z.string().max(64_000).optional()
}).strict();
export const rootRunListQuerySchema = z.object({
  state: z.enum(["active", "recent"]).optional(), cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
}).strict();
export const rootRunParamsSchema = z.object({ rootRunId: z.string().uuid() }).strict();
export const nodeRunParamsSchema = z.object({ rootRunId: z.string().uuid(), nodeRunId: z.string().uuid() }).strict();
export const executionTaskParamsSchema = z.object({ taskId: z.string().uuid() }).strict();
export const executionEventsQuerySchema = z.object({
  after: z.coerce.number().int().min(0).optional(), limit: z.coerce.number().int().min(1).max(500).optional()
}).strict();
export const nodeRunResponseBodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("work"), outcome: workNodeOutcomeSchema }).strict(),
  z.object({ kind: z.literal("validation"), outcome: validationNodeOutcomeSchema }).strict(),
  z.object({ kind: z.literal("resume"), response: z.string().trim().min(1).max(64_000) }).strict()
]);
export const respondToNodeRunBodySchema = nodeRunResponseBodySchema;

const timestamp = z.string().datetime();
export const graphStateRevisionMetadataSchema = z.object({
  rootRunId: z.string(), revision: z.number().int().min(0), parentRevision: z.number().int().min(0).optional(),
  stateSha256: z.string(), sourceNodeRunId: z.string().optional(), patch: z.object({
    patch: statePatchSchema, patchSha256: z.string()
  }).strict().optional(), patchOmitted: z.boolean(), createdAt: timestamp
}).strict();
export const rootRunStateProjectionSchema = z.object({
  currentRevision: z.number().int().min(0), currentState: jsonValueSchema.optional(), currentStateSha256: z.string(),
  revisions: z.array(graphStateRevisionMetadataSchema), totalRevisionCount: z.number().int().min(0), historyTruncated: z.boolean()
}).strict();
export const routingRequestSchema = z.object({
  routingRequestId: z.string(), rootRunId: z.string(), scope: z.enum(["graph", "graph_node"]),
  kind: z.enum(["start", "continuation", "repair"]), graphNodeId: z.string().optional(),
  sourceChildId: z.string().optional(), sourceNodeRunId: z.string().optional(), result: z.enum(["PASS", "FAIL"]).optional(),
  requestedCapability: z.string().optional(), stateRevision: z.number().int().min(0), evidence: jsonValueSchema,
  candidateKeys: z.array(z.string()), attempt: z.number().int().min(1),
  status: z.enum(["pending", "waiting_for_input", "decided", "dispatched", "failed", "cancelled"]),
  createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp.optional()
}).strict();
export const routingDecisionSchema = z.object({
  routingDecisionId: z.string(), routingRequestId: z.string(), rootRunId: z.string(), orchestratorNodeRunId: z.string(),
  action: z.enum(["dispatch", "complete", "delegate_repair", "needs_input"]), selectedTarget: z.string().optional(),
  result: z.enum(["PASS", "FAIL"]).optional(), reason: z.string(), valid: z.boolean(), createdAt: timestamp
}).strict();
export const repairRequestSchema = z.object({
  repairRequestId: z.string(), rootRunId: z.string(), scope: z.enum(["graph", "graph_node"]),
  graphNodeId: z.string().optional(), requesterNodeRunId: z.string(), requesterJobNodeInvocationId: z.string().optional(),
  returnValidationNodeId: z.string(), attempt: z.number().int().min(1), depth: z.number().int().min(0),
  reason: z.string(), requestedCapability: z.string().optional(), evidence: jsonValueSchema,
  stateRevision: z.number().int().min(0), candidateKeys: z.array(z.string()),
  status: z.enum(["pending", "running", "repaired", "escalated", "needs_input", "failed", "cancelled"]),
  createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp.optional()
}).strict();
export const repairFrameSchema = z.object({
  repairFrameId: z.string(), rootRunId: z.string(), repairRequestId: z.string(), parentFrameId: z.string().optional(),
  returnGraphNodeInvocationId: z.string(), returnJobNodeInvocationId: z.string(), returnValidationNodeId: z.string(),
  stateRevisionAtCall: z.number().int().min(0), depth: z.number().int().min(0),
  status: z.enum(["open", "returned", "escalated", "failed", "cancelled"]),
  createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp.optional()
}).strict();
export const repairResultSchema = z.object({
  repairResultId: z.string(), rootRunId: z.string(), repairRequestId: z.string(), repairFrameId: z.string(),
  stateRevision: z.number().int().min(0), outcome: canonicalNodeOutcomeSchema, summary: z.string(), createdAt: timestamp
}).strict();
export const rootRunOrchestrationProjectionSchema = z.object({
  requests: z.array(routingRequestSchema), decisions: z.array(routingDecisionSchema),
  pendingRequest: routingRequestSchema.optional(), selectedDecision: routingDecisionSchema.optional()
}).strict();
export const rootRunRepairProjectionSchema = z.object({
  requests: z.array(repairRequestSchema), frames: z.array(repairFrameSchema), results: z.array(repairResultSchema),
  activeFrames: z.array(repairFrameSchema), pendingRepair: repairRequestSchema.optional()
}).strict();
export const controlFlowEventSchema = z.object({
  id: z.number().int(), rootRunId: z.string(), sequence: z.number().int(),
  kind: z.enum(["orchestrator_requested", "orchestrator_decided", "orchestrator_invalid", "graph_node_dispatched",
    "job_node_dispatched", "work_completed", "validation_pass", "validation_fail_retry", "validation_fail_repair",
    "repair_dispatched", "repair_return", "repair_escalated", "root_needs_input", "root_cancelled", "root_terminal", "execution_interrupted"]),
  stateRevision: z.number().int().min(0), graphNodeInvocationId: z.string().optional(),
  jobNodeInvocationId: z.string().optional(), sourceNodeRunId: z.string().optional(), targetNodeRunId: z.string().optional(),
  routingRequestId: z.string().optional(), repairRequestId: z.string().optional(), repairFrameId: z.string().optional(), createdAt: timestamp
}).strict();
export const workspaceInvalidationEventSchema = z.union([
  z.object({ id: z.number(), type: z.literal("workspace-changed"), at: timestamp, reason: z.string().optional() }).strict(),
  z.object({
    id: z.number(), type: z.literal("runs-changed"), at: timestamp, rootRunId: z.string(),
    stateRevision: z.number(),
    status: z.enum(["queued","running","waiting_for_input","finalizing","completed","blocked","failed","cancelled"])
  }).strict()
]);
