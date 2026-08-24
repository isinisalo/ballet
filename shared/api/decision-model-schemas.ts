import { z } from "zod";
import {
  defaultDiscountPpm,
  maxDecisionStates,
  maxDecisionTransitions,
  probabilityScalePpm,
  type ProjectScopedRewardDecisionStrategyV4
} from "../domain/decisionModel.js";

const id = z.string().min(1).max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Decision ids must be lowercase kebab-case.");
const pointer = z.string().max(1_000).regex(/^(?:|\/(?:[^~/]|~[01])*)*$/, "Expected an RFC 6901 JSON Pointer.");
const safeNonnegative = z.number().int().safe().nonnegative();
const primitive = z.union([z.string().max(2_000), z.number().finite(), z.boolean(), z.null()]);
const uniqueJson = (values: unknown[]) => new Set(values.map((value) => JSON.stringify(value))).size === values.length;

export const decisionActionGuardSchema = z.object({
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("project_state"), pointer }).strict(),
    z.object({ kind: z.literal("authorization"), pointer }).strict()
  ]),
  allowedValues: z.array(primitive).min(1).max(256)
    .refine(uniqueJson, "Guard values must be unique."),
  missingValue: primitive.optional()
}).strict();

export const decisionBranchTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("state"), stateId: id }).strict(),
  z.object({
    kind: z.literal("terminal"),
    terminal: z.enum(["success", "failure", "blocked"]),
    emitOutcomeId: id.optional()
  }).strict()
]);

export const decisionTransitionSchema = z.object({
  outcomeId: id,
  target: decisionBranchTargetSchema,
  probabilityPpm: z.number().int().min(1).max(probabilityScalePpm),
  provenance: z.enum(["default_prior", "authored_evidence"]),
  penaltyClass: z.enum(["none", "transient", "implementation_defect", "invalid_plan", "invalid_design"])
}).strict();

export const rewardDecisionModelSchema = z.object({
  version: z.literal(4),
  initialStateId: id,
  discountPpm: z.number().int().min(1).max(probabilityScalePpm - 1).default(defaultDiscountPpm),
  reward: z.object({
    actionCostMicros: safeNonnegative,
    terminalSuccessBonusMicros: safeNonnegative,
    acceptanceProgressPotentialScaleMicros: safeNonnegative,
    outcomePenaltyMicros: z.object({
      none: safeNonnegative,
      transient: safeNonnegative,
      implementation_defect: safeNonnegative,
      invalid_plan: safeNonnegative,
      invalid_design: safeNonnegative
    }).strict()
  }).strict(),
  stateActions: z.array(z.object({
    stateId: id,
    actionId: id,
    guards: z.array(decisionActionGuardSchema).max(64),
    successors: z.array(decisionTransitionSchema).min(1).max(maxDecisionStates)
  }).strict()).max(maxDecisionTransitions),
  solver: z.object({
    algorithm: z.literal("discounted_value_iteration_v4"),
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
  kind: z.literal("reward_mdp_v4"),
  id,
  description: z.string().trim().min(1).max(2_000),
  model: rewardDecisionModelSchema
}).strict() as z.ZodType<ProjectScopedRewardDecisionStrategyV4>;
