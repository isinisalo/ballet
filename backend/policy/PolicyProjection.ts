import {
  sspProbabilityScale,
  type PolicyProjectionV1,
  type ProjectSspGraphStrategyV1,
  type SspActionValueV1
} from "../../shared/domain/decisionModel.js";
import { resolveAllAdmissibleActions } from "./AdmissibleActionResolver.js";
import { solvePolicy } from "./SspPolicySolver.js";

export const derivePolicyProjection = (input: {
  strategy: ProjectSspGraphStrategyV1;
  currentStateId: string;
  snapshotGraphNodeIds: readonly string[];
  modelSha256: string;
  source: PolicyProjectionV1["source"];
}): PolicyProjectionV1 => {
  const { strategy } = input;
  const admissible = resolveAllAdmissibleActions(strategy, input.snapshotGraphNodeIds);
  const solution = solvePolicy({
    model: strategy.model,
    currentStateId: input.currentStateId,
    admissibleActionsByState: admissible,
    modelSha256: input.modelSha256
  });
  const result: PolicyProjectionV1 = {
    derived: true,
    source: input.source,
    sourceDecisionStateId: input.currentStateId,
    modelVersion: 1,
    modelSha256: input.modelSha256,
    solverStatus: solution.status,
    nodes: [],
    edges: [],
    truncated: false,
    maxDecisionEpochs: strategy.model.projection.maxDecisionEpochs,
    maxProjectionNodes: strategy.model.projection.maxProjectionNodes
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
    return result;
  }

  const states = new Map(strategy.model.states.map((state) => [state.id, state]));
  const rows = new Map<string, typeof strategy.model.stateActions>();
  for (const row of strategy.model.stateActions) {
    if (!admissible[row.stateId]?.includes(row.graphNodeId)) continue;
    rows.set(row.stateId, [...(rows.get(row.stateId) ?? []), row]);
  }
  const queue: Array<{
    stateId: string;
    depth: number;
    cumulativeProbabilityPpm: number;
    parentId?: string;
    probabilityPpm?: number;
    path: string[];
  }> = [{ stateId: input.currentStateId, depth: 0, cumulativeProbabilityPpm: sspProbabilityScale, path: [] }];

  while (queue.length && result.nodes.length < strategy.model.projection.maxProjectionNodes) {
    const entry = queue.shift()!;
    const projectionNodeId = `projection-${result.nodes.length + 1}`;
    const definition = states.get(entry.stateId);
    const cycle = entry.path.includes(entry.stateId);
    const epochLimit = entry.depth >= strategy.model.projection.maxDecisionEpochs;
    const actionValues = cycle || epochLimit || definition?.terminal
      ? [] : valuesForState(entry.stateId, rows.get(entry.stateId) ?? [], solution.stateValues);
    const selected = actionValues[0];
    const selectedRow = selected
      ? (rows.get(entry.stateId) ?? []).find(({ graphNodeId }) => graphNodeId === selected.graphNodeId)
      : undefined;
    result.nodes.push({
      projectionNodeId,
      stateId: entry.stateId,
      depth: entry.depth,
      cumulativeProbabilityPpm: entry.cumulativeProbabilityPpm,
      selectedGraphNodeId: selected?.graphNodeId,
      expectedRemainingCostMicros: solution.stateValues[entry.stateId],
      configuredExpectedCostMicros: selectedRow?.expectedCostMicros,
      actionValues,
      terminal: definition?.terminal,
      cutoff: cycle ? "cycle" : epochLimit ? "epoch_limit" : !definition || (!definition.terminal && !selectedRow) ? "solver_error" : undefined,
      message: !definition ? `Unknown projected state ${entry.stateId}.` : undefined
    });
    if (entry.parentId && entry.probabilityPpm !== undefined) result.edges.push({
      fromProjectionNodeId: entry.parentId,
      toProjectionNodeId: projectionNodeId,
      probabilityPpm: entry.probabilityPpm,
      cumulativeProbabilityPpm: entry.cumulativeProbabilityPpm,
      configuredPrior: true
    });
    if (!selectedRow || cycle || epochLimit || definition?.terminal) continue;
    for (const successor of [...selectedRow.successors].sort((left, right) =>
      right.probabilityPpm - left.probabilityPpm || left.nextStateId.localeCompare(right.nextStateId))) {
      if (result.nodes.length + queue.length >= strategy.model.projection.maxProjectionNodes) {
        result.truncated = true;
        result.nodes[result.nodes.length - 1]!.cutoff ??= "node_limit";
        break;
      }
      queue.push({
        stateId: successor.nextStateId,
        depth: entry.depth + 1,
        cumulativeProbabilityPpm: Math.round(entry.cumulativeProbabilityPpm * successor.probabilityPpm / sspProbabilityScale),
        parentId: projectionNodeId,
        probabilityPpm: successor.probabilityPpm,
        path: [...entry.path, entry.stateId]
      });
    }
  }
  if (queue.length) result.truncated = true;
  return result;
};

const valuesForState = (
  stateId: string,
  rows: Array<ProjectSspGraphStrategyV1["model"]["stateActions"][number]>,
  stateValues: Record<string, number>
): SspActionValueV1[] => rows.flatMap((row) => {
  let expected = 0;
  for (const successor of row.successors) {
    const value = stateValues[successor.nextStateId];
    if (value === undefined) return [];
    expected += successor.probabilityPpm / sspProbabilityScale * value;
  }
  return [{ graphNodeId: row.graphNodeId, qMicros: row.expectedCostMicros + expected }];
}).sort((left, right) => left.qMicros - right.qMicros || left.graphNodeId.localeCompare(right.graphNodeId));
