import type { ProjectAutomationConfig, ProjectOutputTarget } from "@shared/api/workspace-contracts";
import { findProjectOutputRoute, normalizePolicyOutputEventType, policyOutputEventType, projectOutputRouteCanTargetTrigger } from "@shared/policy-actions";

export const workflowTriggerTargetSelectPrefix = "trigger:";

export type WorkflowOutputTargetDisplay = {
  type: "event" | "trigger";
  label: string;
};

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

export function workflowOutputEventTargetDisplay(
  config: Pick<ProjectAutomationConfig, "policies">,
  sourcePolicyId: string,
  outputId: string
): WorkflowOutputTargetDisplay {
  const policy = config.policies.find((candidate) => candidate.id === sourcePolicyId);
  return { type: "event", label: policy ? policyOutputEventType(policy, outputId) : outputId };
}

export function workflowOutputTargetDisplay(
  config: Pick<ProjectAutomationConfig, "outputRoutes" | "policies">,
  sourcePolicyId: string,
  outputId: string
): WorkflowOutputTargetDisplay {
  const route = findProjectOutputRoute(config.outputRoutes, sourcePolicyId, outputId);
  if (route?.target.type === "trigger") {
    return { type: "trigger", label: route.target.trigger };
  }

  const label = route?.target.type === "event" && route.target.eventType
    ? normalizePolicyOutputEventType(route.target.eventType)
    : workflowOutputEventTargetDisplay(config, sourcePolicyId, outputId).label;
  return { type: "event", label };
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
