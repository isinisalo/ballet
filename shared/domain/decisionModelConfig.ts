import type { JsonPrimitive, JsonValue, NodeResult } from "./automation.js";

export const decisionModelVersion = 4 as const;
export const probabilityScalePpm = 1_000_000 as const;
export const rewardUnitMicros = 1_000_000 as const;
export const defaultDiscountPpm = 990_000 as const;
export const maxDecisionStates = 64;
export const maxDecisionActionsPerState = 64;
export const maxDecisionTransitions = 40_960;

export type DecisionPolicyScope = "graph" | "graph_node";
export type DecisionTerminalKind = "success" | "failure" | "blocked";
export type DecisionEpochKind = "start" | "continuation";
export type OutcomePenaltyClass = "none" | "transient" | "implementation_defect" | "invalid_plan" | "invalid_design";
export type TransitionProbabilityProvenance = "default_prior" | "authored_evidence";

export type DecisionGuardSourceV4 =
  | { kind: "project_state"; pointer: string }
  | { kind: "authorization"; pointer: string };
export interface DecisionActionGuardV4 {
  source: DecisionGuardSourceV4;
  allowedValues: JsonPrimitive[];
  missingValue?: JsonPrimitive;
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

export type DecisionBranchTargetV4 =
  | { kind: "state"; stateId: string }
  | { kind: "terminal"; terminal: DecisionTerminalKind; emitOutcomeId?: string };
export interface DecisionTransitionV4 {
  outcomeId: string;
  target: DecisionBranchTargetV4;
  probabilityPpm: number;
  provenance: TransitionProbabilityProvenance;
  penaltyClass: OutcomePenaltyClass;
}
export interface DecisionActionModelRowV4 {
  stateId: string;
  actionId: string;
  guards: DecisionActionGuardV4[];
  successors: DecisionTransitionV4[];
}
export interface ScopeRewardModelV4 {
  actionCostMicros: number;
  terminalSuccessBonusMicros: number;
  acceptanceProgressPotentialScaleMicros: number;
  outcomePenaltyMicros: Record<OutcomePenaltyClass, number>;
}
export interface DiscountedValueIterationConfigV4 {
  algorithm: "discounted_value_iteration_v4";
  maxIterations: number;
  convergenceToleranceMicros: number;
}
export interface ProjectScopedRewardDecisionModelV4 {
  version: typeof decisionModelVersion;
  initialStateId: string;
  discountPpm: number;
  reward: ScopeRewardModelV4;
  stateActions: DecisionActionModelRowV4[];
  solver: DiscountedValueIterationConfigV4;
}
export interface ProjectScopedRewardDecisionStrategyV4 {
  kind: "reward_mdp_v4";
  id: string;
  description: string;
  model: ProjectScopedRewardDecisionModelV4;
}

export interface DecisionGuardContextV4 {
  stateRevision: number;
  projectState: JsonValue;
  authorization: AuthorizationSnapshotV1;
  acceptanceLedger: AcceptanceLedgerSnapshotV1;
  evidenceRefs: string[];
}

export const defaultRewardModel = (scope: DecisionPolicyScope): ScopeRewardModelV4 => ({
  actionCostMicros: rewardUnitMicros,
  terminalSuccessBonusMicros: 25 * rewardUnitMicros,
  acceptanceProgressPotentialScaleMicros: scope === "graph" ? 100 * rewardUnitMicros : 0,
  outcomePenaltyMicros: {
    none: 0,
    transient: 2 * rewardUnitMicros,
    implementation_defect: 5 * rewardUnitMicros,
    invalid_plan: 12 * rewardUnitMicros,
    invalid_design: 25 * rewardUnitMicros
  }
});

export const defaultScopedRewardDecisionStrategy = (
  scope: DecisionPolicyScope,
  initialStateId = "unconfigured"
): ProjectScopedRewardDecisionStrategyV4 => ({
  kind: "reward_mdp_v4",
  id: `${scope === "graph" ? "graph" : "graph-node"}-reward-mdp`,
  description: scope === "graph"
    ? "Selects Graph Nodes from the project-scoped Reward-MDP."
    : "Selects Action Nodes from the Graph Node-scoped Reward-MDP.",
  model: {
    version: decisionModelVersion,
    initialStateId,
    discountPpm: defaultDiscountPpm,
    reward: defaultRewardModel(scope),
    stateActions: [],
    solver: {
      algorithm: "discounted_value_iteration_v4",
      maxIterations: 10_000,
      convergenceToleranceMicros: 1
    }
  }
});

export const nodeResultForTerminal = (terminal: DecisionTerminalKind): NodeResult =>
  terminal === "success" ? "PASS" : "FAIL";
