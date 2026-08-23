import type { JsonValue, NodeResult, ProjectGraphRouteTarget, ProjectOrchestrator } from "./automation.js";

export const decisionModelVersion = 2 as const;
export const sspProbabilityScale = 1_000_000 as const;
export const maxDecisionStates = 1_024;
export const maxDecisionActionsPerState = 64;
export const maxDecisionTransitions = 40_960;

export type DecisionTerminalKind = "success" | "failure" | "blocked";
export type DecisionEpochKind = "start" | "continuation";
export type DecisionPolicyScope = "graph" | "graph_node";
export type DecisionRuntimeFact = "epoch_kind" | "previous_action_id" | "previous_action_result"
  | "previous_outcome_id" | "action_invocation_count";
export type DecisionFeatureSourceV2 =
  | { kind: "runtime"; fact: DecisionRuntimeFact }
  | { kind: "project_state"; pointer: string }
  | { kind: "authorization"; pointer: string };
export interface DecisionFeatureDefinitionV2 { id: string; domain: string[]; missingValue: string; source: DecisionFeatureSourceV2; }
export interface DecisionStateDefinitionV2 {
  id: string; values: Record<string, string>; terminal?: DecisionTerminalKind; emitsOutcomeId?: string;
}
export interface DecisionActionGuardV2 { featureId: string; allowedValues: string[]; }
export interface CapabilityOutcomeDefinitionV2 { id: string; description: string; }
export interface CapabilityActionV2 { actionId: string; guards: DecisionActionGuardV2[]; }
export interface ProjectCapabilityModelV2 {
  version: typeof decisionModelVersion; outcomes: CapabilityOutcomeDefinitionV2[]; actions: CapabilityActionV2[];
}
export interface DecisionTransitionV2 { outcomeId: string; expectedNextStateId: string; probabilityPpm: number; }
export interface DecisionOptionModelRowV2 {
  stateId: string; actionId: string; expectedCostMicros: number; successors: DecisionTransitionV2[];
}
export interface SspValueIterationConfigV2 {
  algorithm: "ssp_value_iteration_v2"; epsilon: number; maxIterations: number; maxSolveMillis: number;
}
export interface PolicyProjectionLimitsV2 { maxDecisionEpochs: number; maxProjectionNodes: number; }
export interface ProjectSspDecisionModelV2 {
  version: typeof decisionModelVersion; features: DecisionFeatureDefinitionV2[]; states: DecisionStateDefinitionV2[];
  stateActions: DecisionOptionModelRowV2[]; solver: SspValueIterationConfigV2; projection: PolicyProjectionLimitsV2;
}
export interface ProjectAgentGraphStrategyV1 {
  kind: "agent_v1"; orchestrator: ProjectOrchestrator<ProjectGraphRouteTarget>;
}
export interface ProjectSspDecisionStrategyV2 {
  kind: "ssp_v2"; id: string; description: string;
  capabilityModel: ProjectCapabilityModelV2; model: ProjectSspDecisionModelV2;
}
export type ProjectGraphDecisionStrategyV2 = ProjectAgentGraphStrategyV1 | ProjectSspDecisionStrategyV2;
export interface DecisionProjectionContextV2 {
  epochKind: DecisionEpochKind; previousActionId?: string; previousActionResult?: NodeResult; previousOutcomeId?: string;
  actionInvocationCount: number; stateRevision: number; projectState: JsonValue; authorizationFacts: JsonValue;
  evidenceRefs: string[];
}
