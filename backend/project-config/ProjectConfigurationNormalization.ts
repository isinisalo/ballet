import type { ProjectExecutionComposition } from "../../shared/domain/automation.js";
import type { ProjectGraphDecisionStrategyV1 } from "../../shared/domain/decisionModel.js";

export const normalizeGraphStrategy = (
  strategy: ProjectGraphDecisionStrategyV1,
  normalizeComposition: <T extends ProjectExecutionComposition>(composition: T) => T
): ProjectGraphDecisionStrategyV1 => strategy.kind === "agent_v1" ? {
  kind: "agent_v1",
  orchestrator: normalizeComposition(strategy.orchestrator)
} : {
  ...structuredClone(strategy),
  capabilityGraph: {
    version: 1,
    actions: [...strategy.capabilityGraph.actions].map((action) => ({
      graphNodeId: action.graphNodeId,
      guards: action.guards.map((guard) => ({
        featureId: guard.featureId,
        allowedValues: [...guard.allowedValues].sort(compareIds)
      })).sort((left, right) => compareIds(left.featureId, right.featureId))
    })).sort((left, right) => compareIds(left.graphNodeId, right.graphNodeId))
  }
};

const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
