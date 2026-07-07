import type { ProjectAutomationConfig, ProjectOutputTarget } from "@shared/api/workspace-contracts";
import { findProjectOutputRoute, projectOutputRouteCanTargetTrigger } from "@shared/policy-actions";

export const workflowTriggerTargetSelectPrefix = "trigger:";

export function workflowOutputTargetCanSelectTrigger(
  config: Pick<ProjectAutomationConfig, "actions" | "policies">,
  sourcePolicyId: string,
  outputId: string
): boolean {
  const policy = config.policies.find((candidate) => candidate.id === sourcePolicyId);
  return Boolean(policy && projectOutputRouteCanTargetTrigger(policy, outputId, config.actions));
}

export function workflowOutputTargetSelectValue(
  config: Pick<ProjectAutomationConfig, "outputRoutes">,
  sourcePolicyId: string,
  outputId: string
) {
  const route = findProjectOutputRoute(config.outputRoutes, sourcePolicyId, outputId);
  if (route?.target.type === "trigger") return `${workflowTriggerTargetSelectPrefix}${route.target.trigger}`;
  return "event";
}

export function workflowOutputTargetFromSelectValue(value: string): ProjectOutputTarget | undefined {
  if (value.startsWith(workflowTriggerTargetSelectPrefix)) {
    return {
      type: "trigger",
      trigger: value.slice(workflowTriggerTargetSelectPrefix.length)
    };
  }
  return undefined;
}
