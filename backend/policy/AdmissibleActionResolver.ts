import type {
  AdmissibleActionSetV1,
  ProjectSspGraphStrategyV1
} from "../../shared/domain/decisionModel.js";

export const resolveAdmissibleActions = (
  strategy: ProjectSspGraphStrategyV1,
  stateId: string,
  snapshotGraphNodeIds: readonly string[]
): AdmissibleActionSetV1 => {
  const snapshot = new Set(snapshotGraphNodeIds);
  const state = strategy.model.states.find((candidate) => candidate.id === stateId);
  const modeled = new Set(strategy.model.stateActions
    .filter((row) => row.stateId === stateId).map((row) => row.graphNodeId));
  const capability = new Map(strategy.capabilityGraph.actions.map((action) => [action.graphNodeId, action]));
  const all = [...new Set([
    ...snapshotGraphNodeIds,
    ...strategy.capabilityGraph.actions.map((action) => action.graphNodeId),
    ...modeled
  ])].sort();
  const actionIds: string[] = [];
  const excludedActions: AdmissibleActionSetV1["excludedActions"] = [];
  for (const graphNodeId of all) {
    const action = capability.get(graphNodeId);
    const reasonCode = !snapshot.has(graphNodeId) ? "outside_snapshot" as const
      : !action ? "outside_capability_graph" as const
        : !modeled.has(graphNodeId) ? "outside_state_model" as const
          : action.guards.some((guard) => !state || !guard.allowedValues.includes(state.values[guard.featureId]!))
            ? "guard_denied" as const : undefined;
    if (reasonCode) excludedActions.push({ graphNodeId, reasonCode });
    else actionIds.push(graphNodeId);
  }
  return { actionIds, excludedActions };
};

export const resolveAllAdmissibleActions = (
  strategy: ProjectSspGraphStrategyV1,
  snapshotGraphNodeIds: readonly string[]
): Record<string, string[]> => Object.fromEntries(strategy.model.states.map((state) => [
  state.id,
  state.terminal ? [] : resolveAdmissibleActions(strategy, state.id, snapshotGraphNodeIds).actionIds
]));
