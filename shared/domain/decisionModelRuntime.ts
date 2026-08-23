import type { NodeResult } from "./automation.js";
import type { DecisionEpochKind, DecisionPolicyScope, DecisionTerminalKind, DecisionTransitionV2 } from "./decisionModelConfig.js";

export interface DecisionStateV2 {
  stateId: string; features: Record<string, string>; featureVectorSha256: string;
  sourceStateRevision: number; evidenceRefs: string[];
}
export type ExcludedDecisionActionReason = "outside_snapshot" | "outside_capability_model"
  | "outside_state_model" | "guard_denied";
export interface ExcludedDecisionActionV2 { actionId: string; reasonCode: ExcludedDecisionActionReason; }
export interface AdmissibleActionSetV2 { actionIds: string[]; excludedActions: ExcludedDecisionActionV2[]; }
export type SspSolverStatus = "converged" | "policy_model_invalid" | "policy_goal_unreachable"
  | "policy_no_proper_policy" | "policy_not_converged";
export type PolicyDecisionStatus = SspSolverStatus | "terminal" | "decision_state_invalid";
export interface SspActionValueV2 { actionId: string; qMicros: number; }
export interface SspPolicySolutionV2 {
  status: SspSolverStatus; selectedActionId?: string; actionValues: SspActionValueV2[];
  stateValues: Record<string, number>; stateValueMicros?: number; tiedActionIds: string[];
  iterations: number; residual: number; epsilon: number; modelVersion: 2; modelSha256: string;
  policySha256?: string; message?: string;
}
export interface PolicyDecisionRecordV2 {
  policyDecisionId: string; rootRunId: string; scope: DecisionPolicyScope; scopeKey: string;
  graphNodeInvocationId?: string; epoch: number; epochKind: DecisionEpochKind; previousActionInvocationId?: string;
  state?: DecisionStateV2; admissibleActionIds: string[]; excludedActions: ExcludedDecisionActionV2[];
  selectedActionId?: string; actionValues: SspActionValueV2[]; stateValueMicros?: number; tiedActionIds: string[];
  solverStatus: PolicyDecisionStatus; solverAlgorithm: "ssp_value_iteration_v2"; iterations: number; residual: number;
  epsilon: number; modelVersion: 2; modelSha256: string; policySha256?: string; snapshotSha256: string;
  message?: string; createdAt: string;
}
export type PolicyModelMatchV2 = "match" | "outcome_miss" | "state_miss" | "outside_support";
export type PolicyCostUnknownReasonV1 = "provider_not_reported" | "project_not_configured";
export type PolicyCostMeasureV1 =
  | { status: "known"; value: number; sourceRefs: string[] }
  | { status: "unknown"; reason: PolicyCostUnknownReasonV1; sourceRefs: string[] };
export interface PolicyOptionCostObservationV1 {
  version: 1;
  attribution: {
    mode: "inclusive_v1";
    scope: DecisionPolicyScope;
    nodeRunIds: string[];
    executionTaskIds: string[];
    childPolicyObservationIds: string[];
  };
  dimensions: {
    durationMillis: PolicyCostMeasureV1;
    inputTokens: PolicyCostMeasureV1;
    outputTokens: PolicyCostMeasureV1;
    cachedInputTokens: PolicyCostMeasureV1;
    workRetryCount: PolicyCostMeasureV1;
    repairAttemptCount: PolicyCostMeasureV1;
    monetaryMicros: PolicyCostMeasureV1;
    utilityMicros: PolicyCostMeasureV1;
  };
}
export interface PolicyOptionObservationV3 {
  version: 3;
  policyObservationId: string; rootRunId: string; policyDecisionId: string; scope: DecisionPolicyScope; scopeKey: string;
  actionInvocationId: string; graphNodeInvocationId?: string; jobNodeInvocationId?: string; stateBefore: DecisionStateV2;
  actionId: string; configuredExpectedCostMicros: number; expectedOutcomeDistribution: DecisionTransitionV2[];
  observedCost: PolicyOptionCostObservationV1; observedOutcomeId: string; verifiedResult: NodeResult; actualState?: DecisionStateV2;
  modelMatch: PolicyModelMatchV2; modelSha256: string; snapshotSha256: string; createdAt: string;
}
export type PolicyProjectionCutoffV2 = "cycle" | "epoch_limit" | "node_limit" | "solver_error";
export interface PolicyProjectionNodeV2 {
  projectionNodeId: string; stateId: string; depth: number; cumulativeProbabilityPpm: number;
  selectedActionId?: string; expectedRemainingCostMicros?: number; configuredExpectedCostMicros?: number;
  actionValues: SspActionValueV2[]; terminal?: DecisionTerminalKind; cutoff?: PolicyProjectionCutoffV2; message?: string;
}
export interface PolicyProjectionEdgeV2 {
  fromProjectionNodeId: string; toProjectionNodeId: string; outcomeId: string;
  probabilityPpm: number; cumulativeProbabilityPpm: number; configuredPrior: true;
}
export interface PolicyProjectionV2 {
  derived: true; source: "configure_draft" | "run_snapshot"; scope: DecisionPolicyScope;
  sourceDecisionStateId: string; modelVersion: 2; modelSha256: string; solverStatus: SspSolverStatus;
  nodes: PolicyProjectionNodeV2[]; edges: PolicyProjectionEdgeV2[]; mostLikelyRolloutNodeIds: string[];
  truncated: boolean; maxDecisionEpochs: number; maxProjectionNodes: number;
}
export interface PolicyPreviewV2 {
  derived: true; persisted: false; scope: DecisionPolicyScope; scopeKey: string; state?: DecisionStateV2;
  admissibleActionIds: string[]; excludedActions: ExcludedDecisionActionV2[]; selectedActionId?: string;
  actionValues: SspActionValueV2[]; expectedRemainingCostMicros?: number; solverStatus: PolicyDecisionStatus;
  modelVersion: 2; modelSha256: string; projection?: PolicyProjectionV2; message?: string;
}
export interface PolicyPreviewResultV2 { issues: Array<{ path: string; message: string }>; preview?: PolicyPreviewV2; }
export interface ExecutionGraphOccurrenceV3 {
  occurrenceId: string; scope: DecisionPolicyScope; scopeKey: string; epoch: number; policyDecisionId: string;
  actionInvocationId?: string; graphNodeInvocationId?: string; jobNodeInvocationId?: string; actionId: string;
  status: "selected" | "running" | "observed"; decisionStateBefore?: DecisionStateV2;
  expectedRemainingCostMicros?: number; selectedActionValueMicros?: number; configuredExpectedCostMicros?: number;
  expectedOutcomeDistribution: DecisionTransitionV2[]; observedCost?: PolicyOptionCostObservationV1; observedOutcomeId?: string;
  verifiedResult?: NodeResult; actualState?: DecisionStateV2; modelMatch?: PolicyModelMatchV2;
  modelSha256: string; snapshotSha256: string; createdAt: string;
}
export interface PolicyTelemetryV3 {
  scope: DecisionPolicyScope; scopeKey: string; actionId: string; stateId: string; observationCount: number;
  resultCounts: Partial<Record<NodeResult, number>>; outcomeCounts: Record<string, number>;
  observedNextStateCounts: Record<string, number>; modelMissCount: number;
  meanKnownDurationMillis: number;
}
