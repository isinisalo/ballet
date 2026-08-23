import { z } from "zod";
import {
  defaultDiscountPpm,
  maxDecisionActionsPerState,
  maxDecisionStates,
  maxDecisionTransitions,
  probabilityScalePpm
} from "../domain/decisionModel.js";

const id = z.string().min(1).max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Decision ids must be lowercase kebab-case.");
const domain = z.array(z.string().min(1).max(200)).min(1).max(256)
  .refine((values) => new Set(values).size === values.length, "Feature domain values must be unique.");
const pointer = z.string().max(1_000).regex(/^(?:|\/(?:[^~/]|~[01])*)*$/, "Expected an RFC 6901 JSON Pointer.");
const safeNonnegative = z.number().int().safe().nonnegative();
const uniqueIds = (values: string[]) => new Set(values).size === values.length;

export const decisionFeatureSchema = z.object({
  id,
  domain,
  missingValue: z.string().min(1).max(200),
  source: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("runtime"),
      fact: z.enum([
        "epoch_kind", "previous_action_id", "previous_action_result",
        "previous_outcome_id", "action_invocation_count"
      ])
    }).strict(),
    z.object({ kind: z.literal("project_state"), pointer }).strict(),
    z.object({ kind: z.literal("authorization"), pointer }).strict()
  ])
}).strict();

export const decisionStateSchema = z.object({
  id,
  values: z.record(id, z.string().min(1).max(200)),
  verifiedObligationIds: z.array(id).refine(uniqueIds, "Verified obligation ids must be unique."),
  invalidatedObligationIds: z.array(id).refine(uniqueIds, "Invalidated obligation ids must be unique."),
  terminal: z.enum(["success", "failure", "blocked"]).optional()
}).strict();

export const capabilityModelSchema = z.object({
  version: z.literal(3),
  outcomes: z.array(z.object({
    id,
    description: z.string().trim().min(1).max(2_000),
    result: z.enum(["PASS", "FAIL"]),
    penaltyClass: z.enum(["none", "transient", "implementation_defect", "invalid_plan", "invalid_design"])
  }).strict()).max(maxDecisionTransitions),
  actions: z.array(z.object({
    actionId: id,
    guards: z.array(z.object({
      featureId: id,
      allowedValues: z.array(z.string().min(1).max(200)).min(1).max(256)
        .refine(uniqueIds, "Guard values must be unique.")
    }).strict()).max(64)
  }).strict()).max(maxDecisionActionsPerState)
}).strict();

export const rewardDecisionModelSchema = z.object({
  version: z.literal(3),
  discountPpm: z.number().int().min(1).max(probabilityScalePpm - 1).default(defaultDiscountPpm),
  acceptance: z.object({
    version: z.literal(1),
    obligations: z.array(z.object({
      obligationId: id,
      description: z.string().trim().min(1).max(2_000),
      weight: z.number().int().safe().positive().default(1)
    }).strict()).min(1).max(1_024)
  }).strict(),
  reward: z.object({
    actionCostMicros: safeNonnegative,
    completionBonusMicros: safeNonnegative,
    progressPotentialScaleMicros: safeNonnegative,
    outcomePenaltyMicros: z.object({
      none: safeNonnegative,
      transient: safeNonnegative,
      implementation_defect: safeNonnegative,
      invalid_plan: safeNonnegative,
      invalid_design: safeNonnegative
    }).strict()
  }).strict(),
  features: z.array(decisionFeatureSchema).max(64),
  states: z.array(decisionStateSchema).min(1).max(maxDecisionStates),
  stateActions: z.array(z.object({
    stateId: id,
    actionId: id,
    successors: z.array(z.object({
      outcomeId: id,
      nextStateId: id,
      probabilityPpm: z.number().int().min(1).max(probabilityScalePpm),
      provenance: z.enum(["default_prior", "authored_evidence"])
    }).strict()).min(1).max(maxDecisionStates)
  }).strict()).max(maxDecisionTransitions),
  solver: z.object({
    algorithm: z.literal("discounted_value_iteration_v3"),
    maxIterations: z.number().int().min(1).max(100_000),
    convergenceToleranceMicros: z.number().int().min(0).max(1_000_000)
  }).strict()
}).strict().superRefine((model, context) => {
  const count = model.stateActions.reduce((sum, row) => sum + row.successors.length, 0);
  if (count > maxDecisionTransitions) context.addIssue({
    code: "custom", path: ["stateActions"],
    message: `Decision Model exceeds the ${maxDecisionTransitions} transition outcome limit.`
  });
});

export const rewardDecisionStrategySchema = z.object({
  kind: z.literal("reward_mdp_v3"),
  id,
  description: z.string().trim().min(1).max(2_000),
  capabilityModel: capabilityModelSchema,
  model: rewardDecisionModelSchema
}).strict();
