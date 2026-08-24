import type { ProjectGraph } from "../../shared/domain/automation.js";
import { probabilityScalePpm, type DecisionStateV4 } from "../../shared/domain/decisionModel.js";

export function acceptanceProgressCatalog(graph: ProjectGraph): Record<string, number> {
  const weights = new Map(graph.acceptance.obligations.map(({ obligationId, weight }) => [obligationId, weight]));
  const boundWeights = graph.graphNodes.map(({ acceptanceObligationId }) =>
    acceptanceObligationId ? weights.get(acceptanceObligationId) ?? 0 : 0);
  const total = boundWeights.reduce((sum, weight) => sum + weight, 0);
  let completed = 0;
  return Object.fromEntries(graph.graphNodes.map((node, index) => {
    const progress = total === 0 ? 0 : Math.round(completed * probabilityScalePpm / total);
    completed += boundWeights[index] ?? 0;
    return [node.id, progress];
  }));
}

export function decisionState(input: {
  scope: "graph" | "graph_node";
  graphNodeId?: string;
  stateId: string;
  graph: ProjectGraph;
  sourceStateRevision: number;
  evidenceRefs: string[];
}): DecisionStateV4 {
  return {
    scope: input.scope,
    ...(input.graphNodeId ? { graphNodeId: input.graphNodeId } : {}),
    stateId: input.stateId,
    acceptanceProgressPpm: input.scope === "graph"
      ? acceptanceProgressCatalog(input.graph)[input.stateId] ?? 0 : 0,
    sourceStateRevision: input.sourceStateRevision,
    evidenceRefs: [...new Set(input.evidenceRefs)].sort()
  };
}
