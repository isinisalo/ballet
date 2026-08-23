import type {
  AdmissibleActionSetV3,
  DecisionStateV3,
  ProjectRewardDecisionStrategyV3
} from "../../shared/domain/decisionModel.js";

export function resolveAdmissibleActions(
  strategy: ProjectRewardDecisionStrategyV3,
  state: DecisionStateV3,
  snapshotGraphNodeIds: readonly string[]
): AdmissibleActionSetV3 {
  const snapshot = new Set(snapshotGraphNodeIds);
  const modeled = new Set(strategy.model.stateActions
    .filter((row) => row.stateId === state.stateId).map((row) => row.actionId));
  const capability = new Map(strategy.capabilityModel.actions.map((action) => [action.actionId, action]));
  const features = new Map(strategy.model.features.map((feature) => [feature.id, feature]));
  const all = [...new Set([...snapshotGraphNodeIds, ...capability.keys(), ...modeled])].sort();
  const actionIds: string[] = [];
  const excludedActions: AdmissibleActionSetV3["excludedActions"] = [];
  for (const actionId of all) {
    const action = capability.get(actionId);
    const failedGuard = action?.guards.find((guard) => !guard.allowedValues.includes(state.features[guard.featureId]!));
    const reasonCode = !snapshot.has(actionId) ? "outside_snapshot" as const
      : !action ? "outside_capability_model" as const
        : !modeled.has(actionId) ? "outside_state_model" as const
          : failedGuard && features.get(failedGuard.featureId)?.source.kind === "authorization"
            ? "authorization_denied" as const
            : failedGuard ? "guard_denied" as const : undefined;
    if (reasonCode) excludedActions.push({ actionId, reasonCode });
    else actionIds.push(actionId);
  }
  return { actionIds, excludedActions };
}

export function resolveAllAdmissibleActions(
  strategy: ProjectRewardDecisionStrategyV3,
  projectedStates: ReadonlyMap<string, DecisionStateV3>,
  snapshotGraphNodeIds: readonly string[]
): Record<string, string[]> {
  return Object.fromEntries(strategy.model.states.map((state) => [
    state.id,
    state.terminal ? [] : resolveAdmissibleActions(strategy, projectedStates.get(state.id)!, snapshotGraphNodeIds).actionIds
  ]));
}
