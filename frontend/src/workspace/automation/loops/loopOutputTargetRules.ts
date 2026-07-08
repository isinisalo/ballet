import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputEventType, findActionOutputRoute } from "@shared/policy-actions";

export type LoopOutputTargetDisplay = {
  type: "event" | "action";
  label: string;
};

export function loopOutputTargetSelectValue(
  config: Pick<ProjectAutomationConfig, "outputRoutes">,
  sourceLoopId: string,
  sourceActionId: string,
  outputId: string
) {
  return findActionOutputRoute(config.outputRoutes, sourceLoopId, sourceActionId, outputId) ? "action" : "event";
}

export function loopOutputEventTargetDisplay(
  config: Pick<ProjectAutomationConfig, "actions">,
  sourceLoopId: string,
  sourceActionId: string,
  outputId: string
): LoopOutputTargetDisplay {
  const action = config.actions.find((candidate) => candidate.id === sourceActionId);
  return { type: "event", label: action ? actionOutputEventType({ loopId: sourceLoopId, actionId: action.id }, outputId) : outputId };
}

export function loopOutputTargetDisplay(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes">,
  sourceLoopId: string,
  sourceActionId: string,
  outputId: string
): LoopOutputTargetDisplay {
  const route = findActionOutputRoute(config.outputRoutes, sourceLoopId, sourceActionId, outputId);
  const targetAction = route ? config.actions.find((candidate) => candidate.id === route.targetActionId) : undefined;
  if (route && targetAction) {
    return {
      type: "action",
      label: route.targetLoopId === sourceLoopId ? targetAction.id : `${route.targetLoopId}:${targetAction.id}`
    };
  }

  return loopOutputEventTargetDisplay(config, sourceLoopId, sourceActionId, outputId);
}
