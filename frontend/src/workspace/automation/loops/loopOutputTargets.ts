import type { ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import {
  actionOutputEventType,
  actionOutputIds,
  findActionOutputRoute
} from "@shared/policy-actions";
import type { LoopOutputTarget } from "./loopGraph";

export function loopOutputTargetsForPolicy(
  config: ProjectAutomationConfig,
  action: ProjectAction,
  loopId: string
): LoopOutputTarget[] {
  return actionOutputIds(config.actions, action.id).map((outputId) => {
    const route = findActionOutputRoute(config.outputRoutes, loopId, action.id, outputId);
    const eventType = actionOutputEventType({ loopId, actionId: action.id }, outputId);
    if (route) {
      return {
        outputId,
        eventType,
        type: "action",
        targetLoopId: route.targetLoopId,
        targetActionId: route.targetActionId
      };
    }
    return {
      outputId,
      eventType,
      type: "event"
    };
  });
}
