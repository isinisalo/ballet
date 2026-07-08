import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputEventType, findActionOutputRoute } from "@shared/policy-actions";

export type LoopOutputActionHandler = {
  type: "action";
  outputId: string;
  eventType: string;
  actionId: string;
  loopId: string;
  stepIndex: number;
  label: string;
};

export type LoopOutputHandler = LoopOutputActionHandler;

export type LoopOutputTargetActionOption = {
  id: string;
  label: string;
};

export type LoopOutputHandlerSelection = {
  targetLoopId: string;
  targetActionId: string;
  actionOptions: LoopOutputTargetActionOption[];
};

export function loopOutputTargetActionOptions(
  config: Pick<ProjectAutomationConfig, "actions" | "loops">,
  targetLoopId: string
): LoopOutputTargetActionOption[] {
  const targetLoop = config.loops.find((candidate) => candidate.id === targetLoopId);
  if (!targetLoop) return [];

  const actionsById = new Map(config.actions.map((action) => [action.id, action]));
  const seenActionIds = new Set<string>();
  return targetLoop.steps.flatMap((actionId) => {
    if (seenActionIds.has(actionId)) return [];
    const action = actionsById.get(actionId);
    if (!action) return [];
    seenActionIds.add(action.id);
    return [{
      id: action.id,
      label: action.description ? `${action.id} · ${action.description}` : action.id
    }];
  });
}

export function loopOutputHandlerSelection(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "loops">,
  sourceLoopId: string,
  sourceActionId: string,
  outputId: string
): LoopOutputHandlerSelection {
  const route = findActionOutputRoute(config.outputRoutes, sourceLoopId, sourceActionId, outputId);
  const targetLoopId = route?.targetLoopId ?? sourceLoopId;
  const actionOptions = loopOutputTargetActionOptions(config, targetLoopId);
  const routeActionId = route && actionOptions.some((option) => option.id === route.targetActionId)
    ? route.targetActionId
    : "";

  return {
    targetLoopId,
    targetActionId: routeActionId,
    actionOptions
  };
}

export function loopOutputHandlerForOutput(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "loops">,
  loopId: string,
  sourceActionId: string,
  outputId: string
): LoopOutputHandler | undefined {
  const loop = config.loops.find((candidate) => candidate.id === loopId);
  const sourceAction = config.actions.find((candidate) => candidate.id === sourceActionId);
  if (!loop || !sourceAction) return undefined;

  const eventType = actionOutputEventType({ loopId, actionId: sourceAction.id }, outputId);
  const route = findActionOutputRoute(config.outputRoutes, loopId, sourceActionId, outputId);
  if (!route) return undefined;
  const targetLoop = config.loops.find((candidate) => candidate.id === route.targetLoopId);
  const stepIndex = targetLoop?.steps.indexOf(route.targetActionId) ?? -1;
  const action = config.actions.find((candidate) => candidate.id === route.targetActionId);

  if (!action || !targetLoop || stepIndex < 0) return undefined;

  return {
    type: "action",
    outputId,
    eventType,
    actionId: action.id,
    loopId: targetLoop.id,
    stepIndex,
    label: action.id
  };
}
