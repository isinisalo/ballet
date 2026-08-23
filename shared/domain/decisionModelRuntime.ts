import type { NodeResult } from "./automation.js";
import type {
  AcceptanceLedgerSnapshotV1,
  DecisionEpochKind,
  DecisionTransitionV3
} from "./decisionModelConfig.js";

export interface DecisionStateV3 {
  stateId: string;
  features: Record<string, string>;
  verifiedProgressPpm: number;
  featureVectorSha256: string;
  sourceStateRevision: number;
  evidenceRefs: string[];
}
export type ExcludedDecisionActionReason = "outside_snapshot" | "outside_capability_model"
  | "outside_state_model" | "authorization_denied" | "guard_denied";
export interface ExcludedDecisionActionV3 { actionId: string; reasonCode: ExcludedDecisionActionReason; }
export interface AdmissibleActionSetV3 { actionIds: string[]; excludedActions: ExcludedDecisionActionV3[]; }
export type RewardMdpCompilerStatus = "compiled" | "policy_model_invalid" | "policy_goal_unreachable"
  | "policy_no_proper_policy" | "policy_not_converged";
export type PolicyDecisionStatus = RewardMdpCompilerStatus | "terminal" | "decision_state_invalid";
export interface RewardActionValueV3 { actionId: string; qMicros: number; }
export interface CompiledPolicyStateV3 {
  stateId: string;
  selectedActionId: string;
  valueMicros: number;
  actionValues: RewardActionValueV3[];
}
export interface CompiledRewardPolicyV3 {
  version: 3;
  algorithm: "discounted_value_iteration_v3";
  status: RewardMdpCompilerStatus;
  states: CompiledPolicyStateV3[];
  iterations: number;
  residualMicros: number;
  modelSha256: string;
  policySha256?: string;
  message?: string;
}
export interface PolicyDecisionRecordV3 {
  version: 3;
  policyDecisionId: string;
  rootRunId: string;
  epoch: number;
  epochKind: DecisionEpochKind;
  previousActionInvocationId?: string;
  state?: DecisionStateV3;
  admissibleActionIds: string[];
  excludedActions: ExcludedDecisionActionV3[];
  selectedActionId?: string;
  actionValues: RewardActionValueV3[];
  stateValueMicros?: number;
  solverStatus: PolicyDecisionStatus;
  modelSha256: string;
  policySha256?: string;
  snapshotSha256: string;
  message?: string;
  createdAt: string;
}
export type PolicyModelMatchV3 = "match" | "outcome_miss" | "state_miss" | "outside_support";
export type PolicyCostUnknownReasonV1 = "provider_not_reported" | "project_not_configured";
export type PolicyCostMeasureV1 =
  | { status: "known"; value: number; sourceRefs: string[] }
  | { status: "unknown"; reason: PolicyCostUnknownReasonV1; sourceRefs: string[] };
export interface PolicyOptionCostObservationV1 {
  version: 1;
  attribution: { mode: "inclusive_v1"; nodeRunIds: string[]; executionTaskIds: string[]; };
  dimensions: {
    durationMillis: PolicyCostMeasureV1;
    inputTokens: PolicyCostMeasureV1;
    outputTokens: PolicyCostMeasureV1;
    cachedInputTokens: PolicyCostMeasureV1;
    workRetryCount: PolicyCostMeasureV1;
    monetaryMicros: PolicyCostMeasureV1;
  };
}
export interface PolicyOptionObservationV4 {
  version: 4;
  policyObservationId: string;
  rootRunId: string;
  policyDecisionId: string;
  actionInvocationId: string;
  graphNodeInvocationId: string;
  stateBefore: DecisionStateV3;
  actionId: string;
  expectedOutcomeDistribution: DecisionTransitionV3[];
  observedCost: PolicyOptionCostObservationV1;
  observedOutcomeId: string;
  verifiedResult: NodeResult;
  actualState?: DecisionStateV3;
  acceptanceLedgerAfter: AcceptanceLedgerSnapshotV1;
  realizedRewardMicros: number;
  modelMatch: PolicyModelMatchV3;
  modelSha256: string;
  snapshotSha256: string;
  createdAt: string;
}
export interface PolicyPreviewV3 {
  derived: true;
  persisted: false;
  state?: DecisionStateV3;
  admissibleActionIds: string[];
  excludedActions: ExcludedDecisionActionV3[];
  selectedActionId?: string;
  actionValues: RewardActionValueV3[];
  expectedReturnMicros?: number;
  solverStatus: PolicyDecisionStatus;
  modelVersion: 3;
  modelSha256: string;
  policySha256?: string;
  compiledPolicy?: CompiledRewardPolicyV3;
  message?: string;
}
export interface PolicyPreviewResultV3 { issues: Array<{ path: string; message: string }>; preview?: PolicyPreviewV3; }
