import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { findProjectOutputRoute, humanGateApprovalTriggerIdForPolicy, normalizePolicyOutputEventType, policyOutputEventType } from "@shared/policy-actions";
import type { ActionInputSource } from "./actionInputSources";

export type ActionOutputTarget = ActionInputSource;

const outputTargetForPolicy = (
  policy: Pick<ProjectPolicy, "id" | "action">,
  outputId: string,
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes">
): ActionOutputTarget => {
  const derivedTriggerId = humanGateApprovalTriggerIdForPolicy(policy, outputId, config.actions);
  if (derivedTriggerId) {
    return { type: "trigger", id: derivedTriggerId, label: derivedTriggerId };
  }

  const route = findProjectOutputRoute(config.outputRoutes, policy.id, outputId);
  const eventType = route?.target.type === "event" && route.target.eventType
    ? normalizePolicyOutputEventType(route.target.eventType)
    : policyOutputEventType(policy, outputId);
  return { type: "event", id: eventType, label: eventType };
};

export function actionOutputTargetForOutput(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "policies">,
  actionId: string,
  outputId: string
): ActionOutputTarget | undefined {
  if (!actionId || !outputId) return undefined;
  const policies = config.policies.filter((policy) => policy.action === actionId);
  const targets = policies.length > 0
    ? policies.map((policy) => outputTargetForPolicy(policy, outputId, config))
    : [{ type: "event" as const, id: policyOutputEventType({ action: actionId }, outputId), label: policyOutputEventType({ action: actionId }, outputId) }];
  return targets.find((target) => target.type === "trigger") ?? targets[0];
}

export function actionOutputTargetsByOutputId(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "policies">,
  actionId: string,
  outputIds: string[]
): Record<string, ActionOutputTarget> {
  return Object.fromEntries(outputIds.flatMap((outputId) => {
    const target = actionOutputTargetForOutput(config, actionId, outputId);
    return target ? [[outputId, target]] : [];
  }));
}
