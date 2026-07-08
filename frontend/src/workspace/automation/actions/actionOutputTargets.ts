import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { policyOutputEventType, projectOutputRouteTargetPolicy } from "@shared/policy-actions";

export type ActionOutputTarget = {
  type: "event" | "policy";
  id: string;
  label: string;
};

const outputTargetsForPolicy = (
  policy: Pick<ProjectPolicy, "id" | "action"> & { loopId?: string },
  outputId: string,
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "policies">
): ActionOutputTarget[] => {
  const targetPolicy = projectOutputRouteTargetPolicy(policy, outputId, config.outputRoutes, config.actions, config.policies);
  if (targetPolicy) {
    return [{ type: "policy", id: targetPolicy.id, label: targetPolicy.id }];
  }

  const eventType = policyOutputEventType(policy, outputId);
  return [{ type: "event", id: eventType, label: eventType }];
};

const uniqueTargets = (targets: ActionOutputTarget[]): ActionOutputTarget[] =>
  [...new Map(targets.map((target) => [`${target.type}:${target.id}`, target])).values()];

export function actionOutputTargetsForOutput(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "policies">,
  actionId: string,
  outputId: string
): ActionOutputTarget[] {
  if (!actionId || !outputId) return [];
  const policies = config.policies.filter((policy) => policy.action === actionId);
  return uniqueTargets(policies.length > 0
    ? policies.flatMap((policy) => outputTargetsForPolicy(policy, outputId, config))
    : [{ type: "event" as const, id: policyOutputEventType({ action: actionId }, outputId), label: policyOutputEventType({ action: actionId }, outputId) }]
  );
}

export function actionOutputTargetsByOutputId(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "policies">,
  actionId: string,
  outputIds: string[]
): Record<string, ActionOutputTarget[]> {
  return Object.fromEntries(outputIds.flatMap((outputId) => {
    const targets = actionOutputTargetsForOutput(config, actionId, outputId);
    return targets.length > 0 ? [[outputId, targets]] : [];
  }));
}
