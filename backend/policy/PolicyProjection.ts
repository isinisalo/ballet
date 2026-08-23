import {
  sspProbabilityScale,
  type DecisionPolicyScope,
  type PolicyProjectionV2,
  type ProjectSspDecisionStrategyV2,
  type SspActionValueV2
} from "../../shared/domain/decisionModel.js";
import { resolveAllAdmissibleActions } from "./AdmissibleActionResolver.js";
import { solvePolicy } from "./SspPolicySolver.js";

export const derivePolicyProjection = (input: {
  strategy: ProjectSspDecisionStrategyV2;
  scope: DecisionPolicyScope;
  currentStateId: string;
  snapshotActionIds: readonly string[];
  modelSha256: string;
  source: PolicyProjectionV2["source"];
}): PolicyProjectionV2 => {
  const admissible = resolveAllAdmissibleActions(input.strategy, input.snapshotActionIds);
  const solution = solvePolicy({
    model: input.strategy.model,
    currentStateId: input.currentStateId,
    admissibleActionsByState: admissible,
    modelSha256: input.modelSha256
  });
  const result: PolicyProjectionV2 = {
    derived: true,
    source: input.source,
    scope: input.scope,
    sourceDecisionStateId: input.currentStateId,
    modelVersion: 2,
    modelSha256: input.modelSha256,
    solverStatus: solution.status,
    nodes: [],
    edges: [],
    mostLikelyRolloutNodeIds: [],
    truncated: false,
    maxDecisionEpochs: input.strategy.model.projection.maxDecisionEpochs,
    maxProjectionNodes: input.strategy.model.projection.maxProjectionNodes
  };
  if (solution.status !== "converged") {
    result.nodes.push({
      projectionNodeId: "projection-1",
      stateId: input.currentStateId,
      depth: 0,
      cumulativeProbabilityPpm: sspProbabilityScale,
      actionValues: [],
      cutoff: "solver_error",
      message: solution.message
    });
    result.mostLikelyRolloutNodeIds = ["projection-1"];
    return result;
  }
  const states = new Map(input.strategy.model.states.map((state) => [state.id, state]));
  const rows = new Map<string, typeof input.strategy.model.stateActions>();
  for (const row of input.strategy.model.stateActions) {
    if (!admissible[row.stateId]?.includes(row.actionId)) continue;
    rows.set(row.stateId, [...(rows.get(row.stateId) ?? []), row]);
  }
  const queue: QueueEntry[] = [{
    stateId: input.currentStateId,
    depth: 0,
    cumulativeProbabilityPpm: sspProbabilityScale,
    path: []
  }];
  while (queue.length && result.nodes.length < input.strategy.model.projection.maxProjectionNodes) {
    const entry = queue.shift()!;
    const projectionNodeId = `projection-${result.nodes.length + 1}`;
    const definition = states.get(entry.stateId);
    const cycle = entry.path.includes(entry.stateId);
    const epochLimit = entry.depth >= input.strategy.model.projection.maxDecisionEpochs;
    const actionValues = cycle || epochLimit || definition?.terminal
      ? [] : valuesForState(entry.stateId, rows.get(entry.stateId) ?? [], solution.stateValues);
    const selected = actionValues[0];
    const selectedRow = selected
      ? (rows.get(entry.stateId) ?? []).find(({ actionId }) => actionId === selected.actionId)
      : undefined;
    result.nodes.push({
      projectionNodeId,
      stateId: entry.stateId,
      depth: entry.depth,
      cumulativeProbabilityPpm: entry.cumulativeProbabilityPpm,
      selectedActionId: selected?.actionId,
      expectedRemainingCostMicros: solution.stateValues[entry.stateId],
      configuredExpectedCostMicros: selectedRow?.expectedCostMicros,
      actionValues,
      terminal: definition?.terminal,
      cutoff: cycle ? "cycle" : epochLimit ? "epoch_limit"
        : !definition || (!definition.terminal && !selectedRow) ? "solver_error" : undefined,
      message: !definition ? `Unknown projected state ${entry.stateId}.` : undefined
    });
    if (entry.parentId && entry.probabilityPpm !== undefined && entry.outcomeId) result.edges.push({
      fromProjectionNodeId: entry.parentId,
      toProjectionNodeId: projectionNodeId,
      outcomeId: entry.outcomeId,
      probabilityPpm: entry.probabilityPpm,
      cumulativeProbabilityPpm: entry.cumulativeProbabilityPpm,
      configuredPrior: true
    });
    if (!selectedRow || cycle || epochLimit || definition?.terminal) continue;
    for (const successor of [...selectedRow.successors].sort((left, right) =>
      right.probabilityPpm - left.probabilityPpm
      || left.outcomeId.localeCompare(right.outcomeId)
      || left.expectedNextStateId.localeCompare(right.expectedNextStateId))) {
      if (result.nodes.length + queue.length >= input.strategy.model.projection.maxProjectionNodes) {
        result.truncated = true;
        result.nodes[result.nodes.length - 1]!.cutoff ??= "node_limit";
        break;
      }
      queue.push({
        stateId: successor.expectedNextStateId,
        depth: entry.depth + 1,
        cumulativeProbabilityPpm: Math.round(
          entry.cumulativeProbabilityPpm * successor.probabilityPpm / sspProbabilityScale
        ),
        parentId: projectionNodeId,
        probabilityPpm: successor.probabilityPpm,
        outcomeId: successor.outcomeId,
        path: [...entry.path, entry.stateId]
      });
    }
  }
  if (queue.length) result.truncated = true;
  result.mostLikelyRolloutNodeIds = mostLikelyRollout(result);
  return result;
};

interface QueueEntry {
  stateId: string;
  depth: number;
  cumulativeProbabilityPpm: number;
  parentId?: string;
  probabilityPpm?: number;
  outcomeId?: string;
  path: string[];
}

const mostLikelyRollout = (projection: PolicyProjectionV2): string[] => {
  const children = new Set(projection.edges.map(({ fromProjectionNodeId }) => fromProjectionNodeId));
  const leaves = projection.nodes.filter(({ projectionNodeId }) => !children.has(projectionNodeId));
  const ranked = leaves.map((leaf) => ({ leaf, path: pathToRoot(projection, leaf.projectionNodeId) }))
    .sort((left, right) => right.leaf.cumulativeProbabilityPpm - left.leaf.cumulativeProbabilityPpm
      || pathKey(projection, left.path).localeCompare(pathKey(projection, right.path)));
  return ranked[0]?.path ?? [];
};

const pathToRoot = (projection: PolicyProjectionV2, leafId: string): string[] => {
  const result = [leafId];
  let current = leafId;
  while (true) {
    const edge = projection.edges.find(({ toProjectionNodeId }) => toProjectionNodeId === current);
    if (!edge) return result.reverse();
    result.push(edge.fromProjectionNodeId);
    current = edge.fromProjectionNodeId;
  }
};

const pathKey = (projection: PolicyProjectionV2, path: string[]): string => path.map((nodeId, index) => {
  const node = projection.nodes.find(({ projectionNodeId }) => projectionNodeId === nodeId);
  const edge = index === 0 ? undefined : projection.edges.find(({ toProjectionNodeId }) => toProjectionNodeId === nodeId);
  return `${edge?.outcomeId ?? ""}/${node?.stateId ?? ""}/${node?.selectedActionId ?? ""}`;
}).join("|");

const valuesForState = (
  stateId: string,
  rows: ProjectSspDecisionStrategyV2["model"]["stateActions"],
  stateValues: Record<string, number>
): SspActionValueV2[] => rows.flatMap((row) => {
  let expected = 0;
  for (const successor of row.successors) {
    const value = stateValues[successor.expectedNextStateId];
    if (value === undefined) return [];
    expected += successor.probabilityPpm / sspProbabilityScale * value;
  }
  return [{ actionId: row.actionId, qMicros: row.expectedCostMicros + expected }];
}).sort((left, right) => left.qMicros - right.qMicros || left.actionId.localeCompare(right.actionId));
