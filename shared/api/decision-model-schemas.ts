import { z } from "zod";
import {
  maxDecisionActionsPerState,
  maxDecisionStates,
  maxDecisionTransitions,
  sspProbabilityScale
} from "../domain/decisionModel.js";

const id = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Decision ids must be lowercase kebab-case.");
const domain = z.array(z.string().min(1).max(200)).min(1).max(256)
  .refine((values) => new Set(values).size === values.length, "Feature domain values must be unique.");
const pointer = z.string().max(1_000).regex(/^(?:|\/(?:[^~/]|~[01])*)*$/, "Expected an RFC 6901 JSON Pointer.");

export const decisionFeatureSchema = z.object({
  id,
  domain,
  missingValue: z.string().min(1).max(200),
  source: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("runtime"),
      fact: z.enum(["epoch_kind", "previous_graph_node_id", "previous_graph_node_result", "graph_node_invocation_count"])
    }).strict(),
    z.object({ kind: z.literal("project_state"), pointer }).strict(),
    z.object({ kind: z.literal("authorization"), pointer }).strict()
  ])
}).strict();

export const decisionStateSchema = z.object({
  id,
  values: z.record(id, z.string().min(1).max(200)),
  terminal: z.enum(["success", "failure", "blocked"]).optional()
}).strict();

export const capabilityGraphSchema = z.object({
  version: z.literal(1),
  actions: z.array(z.object({
    graphNodeId: id,
    guards: z.array(z.object({
      featureId: id,
      allowedValues: z.array(z.string().min(1).max(200)).min(1).max(256)
        .refine((values) => new Set(values).size === values.length, "Guard values must be unique.")
    }).strict()).max(64)
  }).strict()).min(1).max(maxDecisionActionsPerState)
}).strict();

export const sspDecisionModelSchema = z.object({
  version: z.literal(1),
  features: z.array(decisionFeatureSchema).min(1).max(64),
  states: z.array(decisionStateSchema).min(3).max(maxDecisionStates),
  stateActions: z.array(z.object({
    stateId: id,
    graphNodeId: id,
    expectedCostMicros: z.number().int().safe().positive(),
    successors: z.array(z.object({
      nextStateId: id,
      probabilityPpm: z.number().int().min(1).max(sspProbabilityScale)
    }).strict()).min(1).max(maxDecisionStates)
  }).strict()).min(1).max(maxDecisionTransitions),
  solver: z.object({
    algorithm: z.literal("ssp_value_iteration_v1"),
    epsilon: z.number().finite().positive().max(1),
    maxIterations: z.number().int().min(1).max(10_000),
    maxSolveMillis: z.number().int().min(1).max(2_000)
  }).strict(),
  projection: z.object({
    maxDecisionEpochs: z.number().int().min(1).max(20),
    maxProjectionNodes: z.number().int().min(1).max(100)
  }).strict()
}).strict().superRefine((model, context) => {
  const transitionCount = model.stateActions.reduce((sum, row) => sum + row.successors.length, 0);
  if (transitionCount > maxDecisionTransitions) context.addIssue({
    code: "custom",
    path: ["stateActions"],
    message: `Decision Model exceeds the ${maxDecisionTransitions} transition outcome limit.`
  });
});
