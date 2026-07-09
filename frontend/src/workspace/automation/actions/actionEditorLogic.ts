import type { ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import {
  actionOutputIds,
  actionOutputRouteKey,
  humanGateResponseId,
} from "@shared/policy-actions";

const editableActionId = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+/, "");

export const normalizeActionDraft = (action: ProjectAction): ProjectAction => {
  const normalized = {
    ...action,
    id: editableActionId(action.id),
    agentId: action.humanGate ? undefined : action.agentId,
  };
  if (!normalized.agentId) delete normalized.agentId;
  return normalized;
};

export const nextConfigWithActionPatch = (
  current: ProjectAutomationConfig,
  actionId: string,
  patch: Partial<ProjectAction>
): { config: ProjectAutomationConfig; action: ProjectAction } => {
  const selectedIndex = current.actions.findIndex((action) => action.id === actionId);
  const previousAction = current.actions[selectedIndex];
  if (!previousAction) {
    return {
      config: current,
      action: normalizeActionDraft({
        id: actionId,
        description: ""
      })
    };
  }

  const normalized = normalizeActionDraft({ ...previousAction, ...patch });
  const actionIdMap = new Map([[previousAction.id, normalized.id]]);

  const actions = current.actions.map((action, index) => index === selectedIndex ? normalized : action);
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const outputRouteByKey = new Map(current.outputRoutes.flatMap((route) => {
    const sourceActionId = actionIdMap.get(route.sourceActionId) ?? route.sourceActionId;
    const targetActionId = actionIdMap.get(route.targetActionId) ?? route.targetActionId;
    const sourceAction = actionById.get(sourceActionId);
    const outputId = route.outputId;
    if (!sourceAction || !actionById.has(targetActionId) || !actionOutputIds(actions, sourceAction.id).includes(outputId)) return [];
    const nextRoute = { ...route, sourceActionId, outputId, targetActionId };
    return [[actionOutputRouteKey(nextRoute.sourceLoopId, nextRoute.sourceActionId, nextRoute.outputId), nextRoute] as const];
  }));
  const humanGateResponses = current.humanGateResponses.flatMap((response) => {
    const actionIdForResponse = actionIdMap.get(response.actionId) ?? response.actionId;
    const action = actionById.get(actionIdForResponse);
    const outputId = response.outputId;
    if (!action?.humanGate || !actionOutputIds(actions, action.id).includes(outputId)) return [];
    const nextResponse = { ...response, actionId: actionIdForResponse, outputId };
    return [{ ...nextResponse, id: humanGateResponseId(nextResponse) }];
  });

  return {
    action: normalized,
    config: {
      ...current,
      actions,
      loops: current.loops.map((loop) => ({
        ...loop,
        steps: loop.steps.map((step) => actionIdMap.get(step) ?? step)
      })),
      outputRoutes: [...outputRouteByKey.values()],
      humanGateResponses
    }
  };
};
