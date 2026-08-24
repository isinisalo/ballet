import type { NodeResult } from "./automation.js";
import type {
  AcceptanceLedgerSnapshotV1,
  DecisionEpochKind,
  DecisionPolicyScope,
  DecisionTerminalKind,
  DecisionTransitionV4
} from "./decisionModelConfig.js";

export interface DecisionStateV4 {
  scope: DecisionPolicyScope;
  graphNodeId?: string;
  stateId: string;
  acceptanceProgressPpm: number;
  sourceStateRevision: number;
  evidenceRefs: string[];
}
export type ExcludedDecisionActionReason = "outside_snapshot" | "outside_state_model"
  | "authorization_denied" | "guard_denied";
export interface ExcludedDecisionActionV4 { actionId: string; reasonCode: ExcludedDecisionActionReason; }
export interface AdmissibleActionSetV4 { actionIds: string[]; excludedActions: ExcludedDecisionActionV4[]; }
export type RewardMdpCompilerStatus = "compiled" | "policy_model_invalid" | "policy_goal_unreachable"
  | "policy_no_proper_policy" | "policy_not_converged";
export type PolicyDecisionStatus = RewardMdpCompilerStatus | "terminal" | "decision_state_invalid";
export interface RewardActionValueV4 { actionId: string; qMicros: number; }
export interface CompiledPolicyStateV4 {
  stateId: string;
  selectedActionId: string;
  valueMicros: number;
  actionValues: RewardActionValueV4[];
}
export interface CompiledRewardPolicyV4 {
  version: 4;
  scope: DecisionPolicyScope;
  graphNodeId?: string;
  algorithm: "discounted_value_iteration_v4";
  status: RewardMdpCompilerStatus;
  initialStateId: string;
  stateIds: string[];
  actionIds: string[];
  states: CompiledPolicyStateV4[];
  iterations: number;
  residualMicros: number;
  modelSha256: string;
  policySha256?: string;
  message?: string;
}
export interface PolicyDecisionRecordV5 {
  version: 5;
  policyDecisionId: string;
  rootRunId: string;
  epoch: number;
  epochKind: DecisionEpochKind;
  scope: DecisionPolicyScope;
  graphNodeId?: string;
  graphNodeInvocationId?: string;
  previousActionInvocationId?: string;
  state: DecisionStateV4;
  admissibleActionIds: string[];
  excludedActions: ExcludedDecisionActionV4[];
  selectedActionId?: string;
  actionValues: RewardActionValueV4[];
  stateValueMicros?: number;
  solverStatus: PolicyDecisionStatus;
  modelSha256: string;
  policySha256?: string;
  snapshotSha256: string;
  message?: string;
  createdAt: string;
}
export type PolicyModelMatchV4 = "match" | "outcome_miss" | "state_miss" | "outside_support"
  | "acceptance_mismatch";
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
export interface PolicyOptionObservationV5 {
  version: 5;
  policyObservationId: string;
  rootRunId: string;
  policyDecisionId: string;
  scope: DecisionPolicyScope;
  graphNodeId?: string;
  graphNodeInvocationId?: string;
  actionInvocationId: string;
  stateBefore: DecisionStateV4;
  actionId: string;
  expectedOutcomeDistribution: DecisionTransitionV4[];
  observedCost: PolicyOptionCostObservationV1;
  observedOutcomeId: string;
  emittedOutcomeId?: string;
  verifiedResult: NodeResult;
  actualState?: DecisionStateV4;
  terminal?: DecisionTerminalKind;
  acceptanceLedgerAfter: AcceptanceLedgerSnapshotV1;
  realizedRewardMicros: number;
  modelMatch: PolicyModelMatchV4;
  modelSha256: string;
  snapshotSha256: string;
  createdAt: string;
}
export interface PolicyPreviewV4 {
  derived: true;
  persisted: false;
  scope: DecisionPolicyScope;
  graphNodeId?: string;
  state: DecisionStateV4;
  admissibleActionIds: string[];
  excludedActions: ExcludedDecisionActionV4[];
  selectedActionId?: string;
  actionValues: RewardActionValueV4[];
  expectedReturnMicros?: number;
  solverStatus: PolicyDecisionStatus;
  modelVersion: 4;
  modelSha256: string;
  policySha256?: string;
  compiledPolicy?: CompiledRewardPolicyV4;
  message?: string;
}
export interface PolicyPreviewResultV4 { issues: Array<{ path: string; message: string }>; preview?: PolicyPreviewV4; }
