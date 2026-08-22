import type { JsonValue, NodeResult, ProjectNodeAppearance, ProjectOrchestrator, ProjectGraphRouteTarget } from "./automation.js";

export const decisionModelVersion = 1 as const;
export const sspProbabilityScale = 1_000_000 as const;
export const maxDecisionStates = 1_024;
export const maxDecisionActionsPerState = 40;
export const maxDecisionTransitions = 40_960;

export type DecisionTerminalKind = "success" | "failure" | "blocked";
export type DecisionEpochKind = "start" | "continuation";
export type DecisionRuntimeFact =
  | "epoch_kind"
  | "previous_graph_node_id"
  | "previous_graph_node_result"
  | "graph_node_invocation_count";

export type DecisionFeatureSourceV1 =
  | { kind: "runtime"; fact: DecisionRuntimeFact }
  | { kind: "project_state"; pointer: string }
  | { kind: "authorization"; pointer: string };

export interface DecisionFeatureDefinitionV1 {
  id: string;
  domain: string[];
  missingValue: string;
  source: DecisionFeatureSourceV1;
}

export interface DecisionStateDefinitionV1 {
  id: string;
  values: Record<string, string>;
  terminal?: DecisionTerminalKind;
}

export interface DecisionActionGuardV1 {
  featureId: string;
  allowedValues: string[];
}

export interface CapabilityGraphActionV1 {
  graphNodeId: string;
  guards: DecisionActionGuardV1[];
}

export interface ProjectCapabilityGraphV1 {
  version: 1;
  actions: CapabilityGraphActionV1[];
}

export interface DecisionTransitionV1 {
  nextStateId: string;
  probabilityPpm: number;
}

export interface DecisionOptionModelRowV1 {
  stateId: string;
  graphNodeId: string;
  expectedCostMicros: number;
  successors: DecisionTransitionV1[];
}

export interface SspValueIterationConfigV1 {
  algorithm: "ssp_value_iteration_v1";
  epsilon: number;
  maxIterations: number;
  maxSolveMillis: number;
}

export interface PolicyProjectionLimitsV1 {
  maxDecisionEpochs: number;
  maxProjectionNodes: number;
}

export interface ProjectSspDecisionModelV1 {
  version: typeof decisionModelVersion;
  features: DecisionFeatureDefinitionV1[];
  states: DecisionStateDefinitionV1[];
  stateActions: DecisionOptionModelRowV1[];
  solver: SspValueIterationConfigV1;
  projection: PolicyProjectionLimitsV1;
}

export interface ProjectAgentGraphStrategyV1 {
  kind: "agent_v1";
  orchestrator: ProjectOrchestrator<ProjectGraphRouteTarget>;
}

export interface ProjectSspGraphStrategyV1 extends ProjectNodeAppearance {
  kind: "ssp_v1";
  id: string;
  description: string;
  capabilityGraph: ProjectCapabilityGraphV1;
  model: ProjectSspDecisionModelV1;
}

export type ProjectGraphDecisionStrategyV1 = ProjectAgentGraphStrategyV1 | ProjectSspGraphStrategyV1;

export interface DecisionProjectionContextV1 {
  epochKind: DecisionEpochKind;
  previousGraphNodeId?: string;
  previousGraphNodeResult?: NodeResult;
  graphNodeInvocationCount: number;
  stateRevision: number;
  projectState: JsonValue;
  authorizationFacts: JsonValue;
  evidenceRefs: string[];
}

export interface DecisionStateV1 {
  stateId: string;
  features: Record<string, string>;
  featureVectorSha256: string;
  sourceStateRevision: number;
  evidenceRefs: string[];
}

export type ExcludedDecisionActionReason =
  | "outside_snapshot"
  | "outside_capability_graph"
  | "outside_state_model"
  | "guard_denied";

export interface ExcludedDecisionActionV1 {
  graphNodeId: string;
  reasonCode: ExcludedDecisionActionReason;
}

export interface AdmissibleActionSetV1 {
  actionIds: string[];
  excludedActions: ExcludedDecisionActionV1[];
}

export type SspSolverStatus =
  | "converged"
  | "policy_model_invalid"
  | "policy_goal_unreachable"
  | "policy_no_proper_policy"
  | "policy_not_converged";
export type PolicyDecisionStatus = SspSolverStatus | "terminal" | "decision_state_invalid";

export interface SspActionValueV1 {
  graphNodeId: string;
  qMicros: number;
}

export interface SspPolicySolutionV1 {
  status: SspSolverStatus;
  selectedActionId?: string;
  actionValues: SspActionValueV1[];
  stateValues: Record<string, number>;
  stateValueMicros?: number;
  tiedActionIds: string[];
  iterations: number;
  residual: number;
  epsilon: number;
  modelVersion: typeof decisionModelVersion;
  modelSha256: string;
  policySha256?: string;
  message?: string;
}

export interface PolicyDecisionRecordV1 {
  policyDecisionId: string;
  rootRunId: string;
  epoch: number;
  epochKind: DecisionEpochKind;
  previousGraphNodeInvocationId?: string;
  state?: DecisionStateV1;
  admissibleActionIds: string[];
  excludedActions: ExcludedDecisionActionV1[];
  selectedGraphNodeId?: string;
  actionValues: SspActionValueV1[];
  stateValueMicros?: number;
  tiedActionIds: string[];
  solverStatus: PolicyDecisionStatus;
  solverAlgorithm: "ssp_value_iteration_v1";
  iterations: number;
  residual: number;
  epsilon: number;
  modelVersion: typeof decisionModelVersion;
  modelSha256: string;
  policySha256?: string;
  snapshotSha256: string;
  message?: string;
  createdAt: string;
}

export interface PolicyOptionObservationV1 {
  policyObservationId: string;
  rootRunId: string;
  policyDecisionId: string;
  graphNodeInvocationId: string;
  stateBefore: DecisionStateV1;
  action: string;
  configuredExpectedCostMicros: number;
  actualCostMicros?: number;
  verifiedOutcome: NodeResult;
  stateAfter?: DecisionStateV1;
  durationMillis: number;
  modelSha256: string;
  snapshotSha256: string;
  createdAt: string;
}
