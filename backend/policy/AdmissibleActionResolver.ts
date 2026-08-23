import type {
  AdmissibleActionSetV2,
  ProjectSspDecisionStrategyV2
} from "../../shared/domain/decisionModel.js";

export const resolveAdmissibleActions = (
  strategy: ProjectSspDecisionStrategyV2,
  stateId: string,
  snapshotGraphNodeIds: readonly string[]
): AdmissibleActionSetV2 => {
  const snapshot = new Set(snapshotGraphNodeIds);
  const state = strategy.model.states.find((candidate) => candidate.id === stateId);
  const modeled = new Set(strategy.model.stateActions
    .filter((row) => row.stateId === stateId).map((row) => row.actionId));
  const capability = new Map(strategy.capabilityModel.actions.map((action) => [action.actionId, action]));
  const all = [...new Set([
    ...snapshotGraphNodeIds,
    ...strategy.capabilityModel.actions.map((action) => action.actionId),
    ...modeled
  ])].sort();
  const actionIds: string[] = [];
  const excludedActions: AdmissibleActionSetV2["excludedActions"] = [];
  for (const actionId of all) {
    const action = capability.get(actionId);
    const reasonCode = !snapshot.has(actionId) ? "outside_snapshot" as const
      : !action ? "outside_capability_model" as const
        : !modeled.has(actionId) ? "outside_state_model" as const
          : action.guards.some((guard) => !state || !guard.allowedValues.includes(state.values[guard.featureId]!))
            ? "guard_denied" as const : undefined;
    if (reasonCode) excludedActions.push({ actionId, reasonCode });
    else actionIds.push(actionId);
  }
  return { actionIds, excludedActions };
};

export const resolveAllAdmissibleActions = (
  strategy: ProjectSspDecisionStrategyV2,
  snapshotGraphNodeIds: readonly string[]
): Record<string, string[]> => Object.fromEntries(strategy.model.states.map((state) => [
  state.id,
  state.terminal ? [] : resolveAdmissibleActions(strategy, state.id, snapshotGraphNodeIds).actionIds
]));
