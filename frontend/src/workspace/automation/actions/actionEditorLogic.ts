import type { ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import {
  actionOutputRouteKey,
  actionOutputSlotCount,
  actionOutputSlotKind,
  humanGateResponseId,
  normalizeActionOutputSlots,
} from "@shared/policy-actions";

const editableActionId = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+/, "");

export const normalizeActionDraft = (action: ProjectAction): ProjectAction => {
  const normalized = {
    ...action,
    id: editableActionId(action.id),
    outputIds: normalizeActionOutputSlots(action.outputIds),
    agentId: action.humanGate ? undefined : action.agentId,
  };
  if (!normalized.agentId && !normalized.humanGate) normalized.outputIds = [];
  if (!normalized.agentId) delete normalized.agentId;
  return normalized;
};

const previousOutputSlotIndex = (outputId: string, index: number, outputCount: number): number | undefined => {
  if (outputCount <= actionOutputSlotCount) return index;
  const slot = actionOutputSlotKind(outputId);
  if (slot === "approval") return 0;
  if (slot === "rework") return 1;
  return index < 2 ? index : undefined;
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
        description: "",
        outputIds: []
      })
    };
  }

  const normalized = normalizeActionDraft({ ...previousAction, ...patch });
  const actionIdMap = new Map([[previousAction.id, normalized.id]]);
  const outputIdMap = new Map<string, string>();
  previousAction.outputIds.forEach((outputId, outputIndex) => {
    const slotIndex = previousOutputSlotIndex(outputId, outputIndex, previousAction.outputIds.length);
    const nextOutputId = slotIndex === undefined ? undefined : normalized.outputIds[slotIndex];
    if (!nextOutputId) return;
    outputIdMap.set(outputId, nextOutputId);
  });

  const actions = current.actions.map((action, index) => index === selectedIndex ? normalized : action);
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const outputRouteByKey = new Map(current.outputRoutes.flatMap((route) => {
    const sourceActionId = actionIdMap.get(route.sourceActionId) ?? route.sourceActionId;
    const targetActionId = actionIdMap.get(route.targetActionId) ?? route.targetActionId;
    const sourceAction = actionById.get(sourceActionId);
    const outputId = route.sourceActionId === previousAction.id ? outputIdMap.get(route.outputId) ?? route.outputId : route.outputId;
    if (!sourceAction || !actionById.has(targetActionId) || !sourceAction.outputIds.includes(outputId)) return [];
    const nextRoute = { ...route, sourceActionId, outputId, targetActionId };
    return [[actionOutputRouteKey(nextRoute.sourceLoopId, nextRoute.sourceActionId, nextRoute.outputId), nextRoute] as const];
  }));
  const humanGateResponses = current.humanGateResponses.flatMap((response) => {
    const actionIdForResponse = actionIdMap.get(response.actionId) ?? response.actionId;
    const action = actionById.get(actionIdForResponse);
    const outputId = response.actionId === previousAction.id ? outputIdMap.get(response.outputId) ?? response.outputId : response.outputId;
    if (!action?.humanGate || !action.outputIds.includes(outputId)) return [];
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
