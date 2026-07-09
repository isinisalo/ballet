import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputIds, actionOutputRouteKey, humanGateResponseId } from "@shared/policy-actions";

export const nextConfigWithLoopStepAction = (
  current: ProjectAutomationConfig,
  loopId: string,
  stepIndex: number,
  actionId: string
): ProjectAutomationConfig => nextConfigWithLoopHandlerAction(current, loopId, stepIndex, actionId);

export const nextConfigWithLoopHandlerAction = (
  current: ProjectAutomationConfig,
  loopId: string,
  handlerStepIndex: number,
  actionId: string
): ProjectAutomationConfig => {
  const loop = current.loops.find((candidate) => candidate.id === loopId);
  const templateAction = current.actions.find((action) => action.id === actionId);
  if (!loop || !templateAction || handlerStepIndex < 0 || handlerStepIndex >= loop.steps.length) return current;

  const currentActionId = loop.steps[handlerStepIndex];
  const currentAction = current.actions.find((action) => action.id === currentActionId);
  if (!currentAction || currentAction.id === templateAction.id) return current;

  const nextActionId = templateAction.id;
  const nextLoops = current.loops.map((candidate) => candidate.id === loop.id
    ? {
      ...candidate,
      steps: candidate.steps.map((step, index) => index === handlerStepIndex ? nextActionId : step)
    }
    : candidate);
  const actions = current.actions;
  const actionIdMap = new Map([[currentAction.id, nextActionId]]);
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const outputRouteByKey = new Map(current.outputRoutes.flatMap((route) => {
    const sourceActionId = route.sourceLoopId === loop.id ? actionIdMap.get(route.sourceActionId) ?? route.sourceActionId : route.sourceActionId;
    const targetActionId = route.targetLoopId === loop.id ? actionIdMap.get(route.targetActionId) ?? route.targetActionId : route.targetActionId;
    const sourceAction = actionById.get(sourceActionId);
    if (!sourceAction || !actionById.has(targetActionId)) return [];
    if (route.sourceLoopId === loop.id && route.sourceActionId === currentAction.id && !actionOutputIds(actions, sourceAction.id).includes(route.outputId)) return [];
    const nextRoute = { ...route, sourceActionId, targetActionId };
    return [[actionOutputRouteKey(nextRoute.sourceLoopId, nextRoute.sourceActionId, nextRoute.outputId), nextRoute] as const];
  }));
  const humanGateResponses = current.humanGateResponses.flatMap((response) => {
    if (response.loopId !== loop.id || response.actionId !== currentAction.id) return [response];
    const action = actionById.get(nextActionId);
    if (!action?.humanGate || !actionOutputIds(actions, action.id).includes(response.outputId)) return [];
    const nextResponse = { ...response, actionId: nextActionId };
    return [{ ...nextResponse, id: humanGateResponseId(nextResponse) }];
  });

  return {
    ...current,
    actions,
    loops: nextLoops,
    outputRoutes: [...outputRouteByKey.values()],
    humanGateResponses
  };
};

export const nextConfigWithLoopStepActions = (
  current: ProjectAutomationConfig,
  loopId: string,
  stepIndexes: number[],
  actionId: string
): ProjectAutomationConfig => {
  const uniqueStepIndexes = [...new Set(stepIndexes)].sort((first, second) => first - second);
  if (uniqueStepIndexes.length === 0) return current;
  return uniqueStepIndexes.reduce(
    (nextConfig, stepIndex) => nextConfigWithLoopHandlerAction(nextConfig, loopId, stepIndex, actionId),
    current
  );
};

export const nextConfigWithLoopOutputRouteTarget = (
  current: ProjectAutomationConfig,
  sourceLoopId: string,
  sourceActionId: string,
  outputId: string,
  targetLoopId: string,
  targetActionId: string
): ProjectAutomationConfig => {
  const sourceLoop = current.loops.find((loop) => loop.id === sourceLoopId);
  const targetLoop = current.loops.find((loop) => loop.id === targetLoopId);
  const sourceAction = current.actions.find((action) => action.id === sourceActionId);
  const targetAction = current.actions.find((action) => action.id === targetActionId);

  if (!sourceLoop || !targetLoop || !sourceAction || !targetAction) return current;
  if (!actionOutputIds(current.actions, sourceAction.id).includes(outputId) || !targetLoop.steps.includes(targetAction.id)) return current;

  const routeKey = actionOutputRouteKey(sourceLoop.id, sourceAction.id, outputId);
  return {
    ...current,
    outputRoutes: [
      ...current.outputRoutes.filter((route) =>
        actionOutputRouteKey(route.sourceLoopId, route.sourceActionId, route.outputId) !== routeKey
      ),
      {
        sourceLoopId: sourceLoop.id,
        sourceActionId: sourceAction.id,
        outputId,
        targetLoopId: targetLoop.id,
        targetActionId: targetAction.id
      }
    ]
  };
};

export const nextConfigWithPendingLoopOutputHandlerAction = (
  current: ProjectAutomationConfig,
  loopId: string,
  handlerStepIndex: number,
  actionId: string,
  sourceActionId: string,
  outputId: string
): ProjectAutomationConfig => {
  const loop = current.loops.find((candidate) => candidate.id === loopId);
  const action = current.actions.find((candidate) => candidate.id === actionId);
  const sourceAction = current.actions.find((candidate) => candidate.id === sourceActionId);
  if (!loop || !action || !sourceAction || !actionOutputIds(current.actions, sourceAction.id).includes(outputId) || handlerStepIndex < 0 || handlerStepIndex > loop.steps.length) return current;

  const nextSteps = [...loop.steps];
  nextSteps[handlerStepIndex] = action.id;
  const nextConfig = {
    ...current,
    loops: current.loops.map((candidate) => candidate.id === loop.id ? { ...candidate, steps: nextSteps } : candidate)
  };
  return nextConfigWithLoopOutputRouteTarget(nextConfig, loop.id, sourceActionId, outputId, loop.id, action.id);
};

export const nextConfigWithoutLoopOutputRouteTarget = (
  current: ProjectAutomationConfig,
  sourceLoopId: string,
  sourceActionId: string,
  outputId: string
): ProjectAutomationConfig => {
  const sourceLoop = current.loops.find((loop) => loop.id === sourceLoopId);
  const sourceAction = current.actions.find((action) => action.id === sourceActionId);
  if (!sourceLoop || !sourceAction || !actionOutputIds(current.actions, sourceAction.id).includes(outputId)) return current;

  const routeKey = actionOutputRouteKey(sourceLoop.id, sourceAction.id, outputId);
  const outputRoutes = current.outputRoutes.filter((route) =>
    actionOutputRouteKey(route.sourceLoopId, route.sourceActionId, route.outputId) !== routeKey
  );

  return outputRoutes.length === current.outputRoutes.length ? current : { ...current, outputRoutes };
};

export const nextConfigWithoutLoopStepIndexes = (
  current: ProjectAutomationConfig,
  loopId: string,
  stepIndexes: number[]
): ProjectAutomationConfig => {
  const loop = current.loops.find((candidate) => candidate.id === loopId);
  const stepIndexSet = new Set(stepIndexes);
  if (!loop || stepIndexSet.size === 0) return current;
  const removedActionIds = new Set(loop.steps.filter((_, index) => stepIndexSet.has(index)));

  return {
    ...current,
    loops: current.loops.map((candidate) => candidate.id === loop.id
      ? {
        ...candidate,
        steps: candidate.steps.filter((_, index) => !stepIndexSet.has(index))
      }
      : candidate),
    humanGateResponses: current.humanGateResponses.filter((response) =>
      response.loopId !== loop.id || !removedActionIds.has(response.actionId)
    )
  };
};
