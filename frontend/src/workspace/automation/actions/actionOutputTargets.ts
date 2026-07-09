import type { ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputEventType } from "@shared/policy-actions";

export type ActionOutputTarget = {
  type: "event" | "action";
  id: string;
  label: string;
};

const outputTargetsForAction = (
  action: Pick<ProjectAction, "id">,
  outputId: string,
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes">
): ActionOutputTarget[] => {
  const targets = config.outputRoutes
    .filter((route) => route.sourceActionId === action.id && route.outputId === outputId)
    .flatMap((route) => {
      const targetAction = config.actions.find((candidate) => candidate.id === route.targetActionId);
      return targetAction ? [{ type: "action" as const, id: `${route.targetLoopId}:${targetAction.id}`, label: targetAction.id }] : [];
    });
  if (targets.length > 0) return targets;
  const eventType = actionOutputEventType(action, outputId);
  return [{ type: "event", id: eventType, label: eventType }];
};

export function actionOutputTargetsForOutput(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes">,
  actionId: string,
  outputId: string
): ActionOutputTarget[] {
  const action = config.actions.find((candidate) => candidate.id === actionId);
  if (!action || !outputId) return [];
  return outputTargetsForAction(action, outputId, config);
}

export function actionOutputTargetsByOutputId(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes">,
  actionId: string,
  slotIds: string[]
): Record<string, ActionOutputTarget[]> {
  return Object.fromEntries(slotIds.flatMap((outputId) => {
    const targets = actionOutputTargetsForOutput(config, actionId, outputId);
    return targets.length > 0 ? [[outputId, targets]] : [];
  }));
}
