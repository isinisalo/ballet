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
