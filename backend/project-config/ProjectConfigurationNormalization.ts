import type { ProjectExecutionComposition, ProjectGraphNodeDecisionStrategyV2 } from "../../shared/domain/automation.js";
import type { ProjectGraphDecisionStrategyV2, ProjectSspDecisionStrategyV2 } from "../../shared/domain/decisionModel.js";

export const normalizeGraphStrategy = (
  strategy: ProjectGraphDecisionStrategyV2,
  normalizeComposition: <T extends ProjectExecutionComposition>(composition: T) => T
): ProjectGraphDecisionStrategyV2 => strategy.kind === "agent_v1" ? {
  kind: "agent_v1",
  orchestrator: normalizeComposition(strategy.orchestrator)
} : {
  ...structuredClone(strategy),
  capabilityModel: {
    version: 2,
    outcomes: [...strategy.capabilityModel.outcomes].sort((left, right) => compareIds(left.id, right.id)),
    actions: [...strategy.capabilityModel.actions].map((action) => ({
      actionId: action.actionId,
      guards: action.guards.map((guard) => ({
        featureId: guard.featureId,
        allowedValues: [...guard.allowedValues].sort(compareIds)
      })).sort((left, right) => compareIds(left.featureId, right.featureId))
    })).sort((left, right) => compareIds(left.actionId, right.actionId))
  }
};

export const normalizeGraphNodeStrategy = (
  strategy: ProjectGraphNodeDecisionStrategyV2,
  normalizeComposition: <T extends ProjectExecutionComposition>(composition: T) => T
): ProjectGraphNodeDecisionStrategyV2 => strategy.kind === "agent_v1"
  ? { kind: "agent_v1", orchestrator: normalizeComposition(strategy.orchestrator) }
  : normalizeSspStrategy(strategy);

export const normalizeSspStrategy = (strategy: ProjectSspDecisionStrategyV2): ProjectSspDecisionStrategyV2 => ({
  ...structuredClone(strategy),
  capabilityModel: {
    version: 2,
    outcomes: [...strategy.capabilityModel.outcomes].sort((left, right) => compareIds(left.id, right.id)),
    actions: [...strategy.capabilityModel.actions].map((action) => ({
      actionId: action.actionId,
      guards: action.guards.map((guard) => ({
        featureId: guard.featureId,
        allowedValues: [...guard.allowedValues].sort(compareIds)
      })).sort((left, right) => compareIds(left.featureId, right.featureId))
    })).sort((left, right) => compareIds(left.actionId, right.actionId))
  }
});

const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
