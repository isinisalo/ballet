import type { JsonValue, NodeResult } from "./automation.js";

export const decisionModelVersion = 3 as const;
export const probabilityScalePpm = 1_000_000 as const;
export const rewardUnitMicros = 1_000_000 as const;
export const defaultDiscountPpm = 990_000 as const;
export const maxDecisionStates = 1_024;
export const maxDecisionActionsPerState = 64;
export const maxDecisionTransitions = 40_960;

export type DecisionTerminalKind = "success" | "failure" | "blocked";
export type DecisionEpochKind = "start" | "continuation";
export type DecisionRuntimeFact = "epoch_kind" | "previous_action_id" | "previous_action_result"
  | "previous_outcome_id" | "action_invocation_count";
export type DecisionFeatureSourceV3 =
  | { kind: "runtime"; fact: DecisionRuntimeFact }
  | { kind: "project_state"; pointer: string }
  | { kind: "authorization"; pointer: string };
export interface DecisionFeatureDefinitionV3 {
  id: string;
  domain: string[];
  missingValue: string;
  source: DecisionFeatureSourceV3;
}

export type AcceptanceObligationStatus = "pending" | "verified" | "invalidated";
export interface AcceptanceObligationDefinitionV1 {
  obligationId: string;
  description: string;
  weight: number;
}
export interface AcceptanceLedgerDefinitionV1 {
  version: 1;
  obligations: AcceptanceObligationDefinitionV1[];
}
export interface AcceptanceLedgerEntryV1 {
  obligationId: string;
  weight: number;
  status: AcceptanceObligationStatus;
  evidenceRefs: string[];
  updatedByValidationNodeRunId?: string;
}
export interface AcceptanceLedgerSnapshotV1 {
  version: 1;
  entries: AcceptanceLedgerEntryV1[];
  sha256: string;
}
export interface AuthorizationSnapshotV1 {
  version: 1;
  facts: JsonValue;
  sha256: string;
}

export interface DecisionStateDefinitionV3 {
  id: string;
  values: Record<string, string>;
  verifiedObligationIds: string[];
  invalidatedObligationIds: string[];
  terminal?: DecisionTerminalKind;
}
export interface DecisionActionGuardV3 { featureId: string; allowedValues: string[]; }
export type OutcomePenaltyClass = "none" | "transient" | "implementation_defect" | "invalid_plan" | "invalid_design";
export interface CapabilityOutcomeDefinitionV3 {
  id: string;
  description: string;
  result: NodeResult;
  penaltyClass: OutcomePenaltyClass;
}
export interface CapabilityActionV3 { actionId: string; guards: DecisionActionGuardV3[]; }
export interface ProjectCapabilityModelV3 {
  version: typeof decisionModelVersion;
  outcomes: CapabilityOutcomeDefinitionV3[];
  actions: CapabilityActionV3[];
}
export type TransitionProbabilityProvenance = "default_prior" | "authored_evidence";
export interface DecisionTransitionV3 {
  outcomeId: string;
  nextStateId: string;
  probabilityPpm: number;
  provenance: TransitionProbabilityProvenance;
}
export interface DecisionActionModelRowV3 {
  stateId: string;
  actionId: string;
  successors: DecisionTransitionV3[];
}
export interface RewardModelV3 {
  actionCostMicros: number;
  completionBonusMicros: number;
  progressPotentialScaleMicros: number;
  outcomePenaltyMicros: Record<OutcomePenaltyClass, number>;
}
export interface DiscountedValueIterationConfigV3 {
  algorithm: "discounted_value_iteration_v3";
  maxIterations: number;
  convergenceToleranceMicros: number;
}
export interface ProjectRewardDecisionModelV3 {
  version: typeof decisionModelVersion;
  discountPpm: number;
  acceptance: AcceptanceLedgerDefinitionV1;
  reward: RewardModelV3;
  features: DecisionFeatureDefinitionV3[];
  states: DecisionStateDefinitionV3[];
  stateActions: DecisionActionModelRowV3[];
  solver: DiscountedValueIterationConfigV3;
}
export interface ProjectRewardDecisionStrategyV3 {
  kind: "reward_mdp_v3";
  id: string;
  description: string;
  capabilityModel: ProjectCapabilityModelV3;
  model: ProjectRewardDecisionModelV3;
}
export interface DecisionProjectionContextV3 {
  epochKind: DecisionEpochKind;
  previousActionId?: string;
  previousActionResult?: NodeResult;
  previousOutcomeId?: string;
  actionInvocationCount: number;
  stateRevision: number;
  projectState: JsonValue;
  authorization: AuthorizationSnapshotV1;
  acceptanceLedger: AcceptanceLedgerSnapshotV1;
  evidenceRefs: string[];
}

export const defaultRewardModel = (): RewardModelV3 => ({
  actionCostMicros: rewardUnitMicros,
  completionBonusMicros: 25 * rewardUnitMicros,
  progressPotentialScaleMicros: 100 * rewardUnitMicros,
  outcomePenaltyMicros: {
    none: 0,
    transient: 2 * rewardUnitMicros,
    implementation_defect: 5 * rewardUnitMicros,
    invalid_plan: 12 * rewardUnitMicros,
    invalid_design: 25 * rewardUnitMicros
  }
});
