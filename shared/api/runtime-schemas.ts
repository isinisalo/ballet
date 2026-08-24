import { z } from "zod";
import type { JsonValue } from "../domain/automation.js";
import type {
  CanonicalNodeOutcome,
  NodeRunRole,
  ValidationNodeOutcome,
  WorkNodeOutcome
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
const identifier = z.string().trim().min(1).max(200);

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
  outcomeId: identifier,
  disposition: z.enum(["retry", "escalate"]).optional(),
  evidence: jsonValueSchema,
  feedback: summary.optional(),
  expectedCorrection: summary.optional(),
  acceptance: z.object({
    verifyObligationIds: z.array(identifier),
    invalidateObligationIds: z.array(identifier),
    evidenceRefs: z.array(identifier)
  }).strict(),
  statePatch: statePatchSchema.optional()
}).strict().superRefine((outcome, context) => {
  if (outcome.decision === "PASS" && outcome.disposition) context.addIssue({
    code: "custom", path: ["disposition"], message: "PASS cannot select a failure disposition."
  });
  if (outcome.decision === "FAIL" && !outcome.disposition) context.addIssue({
    code: "custom", path: ["disposition"], message: "FAIL must select retry or escalate."
  });
  if (outcome.decision === "FAIL" && outcome.statePatch) context.addIssue({
    code: "custom", path: ["statePatch"], message: "FAIL cannot patch project State."
  });
  const changed = [...outcome.acceptance.verifyObligationIds, ...outcome.acceptance.invalidateObligationIds];
  if (new Set(changed).size !== changed.length) context.addIssue({
    code: "custom", path: ["acceptance"], message: "An obligation cannot be verified and invalidated together."
  });
  if (changed.length > 0 && outcome.acceptance.evidenceRefs.length === 0) context.addIssue({
    code: "custom", path: ["acceptance", "evidenceRefs"], message: "Acceptance changes require evidence."
  });
}) as z.ZodType<ValidationNodeOutcome>;

export const canonicalNodeOutcomeSchema = z.union([
  workNodeOutcomeSchema,
  validationNodeOutcomeSchema
]) satisfies z.ZodType<CanonicalNodeOutcome>;

export const nodeOutcomeSchemaIds = {
  work: "work-node-outcome-v9",
  validation: "validation-node-outcome-v9"
} as const;
export function nodeOutcomeSchemaForRole(role: NodeRunRole) {
  return role === "work" ? workNodeOutcomeSchema : validationNodeOutcomeSchema;
}
export function parseNodeOutcomeForRole(role: NodeRunRole, value: unknown): CanonicalNodeOutcome {
  return nodeOutcomeSchemaForRole(role).parse(value) as CanonicalNodeOutcome;
}
export function nodeOutcomeJsonSchemaForRole(role: NodeRunRole): Record<string, JsonValue> {
  return z.toJSONSchema(nodeOutcomeSchemaForRole(role), {
    target: "draft-07", unrepresentable: "any"
  }) as Record<string, JsonValue>;
}

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

const acceptanceLedgerSchema = z.object({
  version: z.literal(1),
  entries: z.array(z.object({
    obligationId: z.string(), weight: z.number().int().positive(),
    status: z.enum(["pending", "verified", "invalidated"]), evidenceRefs: z.array(z.string()),
    updatedByValidationNodeRunId: z.string().optional()
  }).strict()),
  sha256: z.string()
}).strict();
const decisionStateSchema = z.object({
  scope: z.enum(["graph", "graph_node"]), graphNodeId: z.string().optional(), stateId: z.string(),
  acceptanceProgressPpm: z.number().int(), sourceStateRevision: z.number().int().min(0), evidenceRefs: z.array(z.string())
}).strict();
const excludedDecisionActionSchema = z.object({
  actionId: z.string(), reasonCode: z.enum([
    "outside_snapshot", "outside_state_model", "authorization_denied", "guard_denied"
  ])
}).strict();
const policyActionValueSchema = z.object({ actionId: z.string(), qMicros: z.number().int().safe() }).strict();
const transitionSchema = z.object({
  outcomeId: z.string(), target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("state"), stateId: z.string() }).strict(),
    z.object({
      kind: z.literal("terminal"), terminal: z.enum(["success", "failure", "blocked"]),
      emitOutcomeId: z.string().optional()
    }).strict()
  ]), probabilityPpm: z.number().int().min(1).max(1_000_000),
  provenance: z.enum(["default_prior", "authored_evidence"]),
  penaltyClass: z.enum(["none", "transient", "implementation_defect", "invalid_plan", "invalid_design"])
}).strict();
export const policyDecisionRecordSchema = z.object({
  version: z.literal(5), policyDecisionId: z.string(), rootRunId: z.string(), epoch: z.number().int().min(1),
  epochKind: z.enum(["start", "continuation"]), scope: z.enum(["graph", "graph_node"]),
  graphNodeId: z.string().optional(), graphNodeInvocationId: z.string().optional(),
  previousActionInvocationId: z.string().optional(), state: decisionStateSchema, admissibleActionIds: z.array(z.string()),
  excludedActions: z.array(excludedDecisionActionSchema), selectedActionId: z.string().optional(),
  actionValues: z.array(policyActionValueSchema), stateValueMicros: z.number().int().safe().optional(),
  solverStatus: z.enum([
    "compiled", "policy_model_invalid", "policy_goal_unreachable", "policy_no_proper_policy",
    "policy_not_converged", "terminal", "decision_state_invalid"
  ]), modelSha256: z.string(), policySha256: z.string().optional(), snapshotSha256: z.string(),
  message: z.string().optional(), createdAt: timestamp
}).strict();
const policyCostMeasureSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("known"), value: z.number().int().min(0), sourceRefs: z.array(z.string()) }).strict(),
  z.object({
    status: z.literal("unknown"), reason: z.enum(["provider_not_reported", "project_not_configured"]),
    sourceRefs: z.array(z.string())
  }).strict()
]);
const policyOptionCostObservationSchema = z.object({
  version: z.literal(1),
  attribution: z.object({
    mode: z.literal("inclusive_v1"), nodeRunIds: z.array(z.string()), executionTaskIds: z.array(z.string())
  }).strict(),
  dimensions: z.object({
    durationMillis: policyCostMeasureSchema, inputTokens: policyCostMeasureSchema,
    outputTokens: policyCostMeasureSchema, cachedInputTokens: policyCostMeasureSchema,
    workRetryCount: policyCostMeasureSchema, monetaryMicros: policyCostMeasureSchema
  }).strict()
}).strict();
export const policyOptionObservationSchema = z.object({
  version: z.literal(5), policyObservationId: z.string(), rootRunId: z.string(), policyDecisionId: z.string(),
  scope: z.enum(["graph", "graph_node"]), graphNodeId: z.string().optional(),
  graphNodeInvocationId: z.string().optional(), actionInvocationId: z.string(), stateBefore: decisionStateSchema,
  actionId: z.string(), expectedOutcomeDistribution: z.array(transitionSchema), observedCost: policyOptionCostObservationSchema,
  observedOutcomeId: z.string(), emittedOutcomeId: z.string().optional(), verifiedResult: z.enum(["PASS", "FAIL"]),
  actualState: decisionStateSchema.optional(), terminal: z.enum(["success", "failure", "blocked"]).optional(),
  acceptanceLedgerAfter: acceptanceLedgerSchema, realizedRewardMicros: z.number().int().safe(),
  modelMatch: z.enum(["match", "outcome_miss", "state_miss", "outside_support", "acceptance_mismatch"]),
  modelSha256: z.string(), snapshotSha256: z.string(), createdAt: timestamp
}).strict();
const compiledPolicySchema = z.object({
  version: z.literal(4), scope: z.enum(["graph", "graph_node"]), graphNodeId: z.string().optional(),
  algorithm: z.literal("discounted_value_iteration_v4"),
  status: z.enum(["compiled", "policy_model_invalid", "policy_goal_unreachable", "policy_no_proper_policy", "policy_not_converged"]),
  initialStateId: z.string(), stateIds: z.array(z.string()), actionIds: z.array(z.string()),
  states: z.array(z.object({
    stateId: z.string(), selectedActionId: z.string(), valueMicros: z.number().int().safe(),
    actionValues: z.array(policyActionValueSchema)
  }).strict()), iterations: z.number().int().min(0), residualMicros: z.number().int().min(0),
  modelSha256: z.string(), policySha256: z.string().optional(), message: z.string().optional()
}).strict();
export const rootRunOrchestrationProjectionSchema = z.object({
  policyDecisions: z.array(policyDecisionRecordSchema), policyObservations: z.array(policyOptionObservationSchema),
  compiledPolicies: z.object({
    global: compiledPolicySchema.optional(),
    graphNodes: z.record(z.string(), compiledPolicySchema)
  }).strict(), acceptanceLedger: acceptanceLedgerSchema
}).strict();
export const controlFlowEventSchema = z.object({
  id: z.number().int(), rootRunId: z.string(), sequence: z.number().int(),
  kind: z.enum(["policy_decided", "policy_invalid", "policy_observed", "graph_node_dispatched",
    "policy_terminal", "acceptance_mismatch",
    "action_node_dispatched", "work_completed", "validation_pass", "validation_fail_retry",
    "validation_fail_escalate", "root_needs_input", "root_cancelled", "root_terminal", "execution_interrupted"]),
  stateRevision: z.number().int().min(0), graphNodeInvocationId: z.string().optional(),
  actionNodeInvocationId: z.string().optional(), sourceNodeRunId: z.string().optional(),
  targetNodeRunId: z.string().optional(), policyDecisionId: z.string().optional(), createdAt: timestamp
}).strict();
export const workspaceInvalidationEventSchema = z.union([
  z.object({ id: z.number(), type: z.literal("workspace-changed"), at: timestamp, reason: z.string().optional() }).strict(),
  z.object({
    id: z.number(), type: z.literal("runs-changed"), at: timestamp, rootRunId: z.string(),
    stateRevision: z.number(),
    status: z.enum(["queued", "running", "waiting_for_input", "finalizing", "completed", "blocked", "failed", "cancelled"])
  }).strict()
]);
