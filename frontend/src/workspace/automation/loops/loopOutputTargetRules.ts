import type { ProjectAutomationConfig, ProjectOutputTarget } from "@shared/api/workspace-contracts";
import { policyOutputEventType, projectOutputRouteTargetPolicy } from "@shared/policy-actions";

export type LoopOutputTargetDisplay = {
  type: "event";
  label: string;
};

export function loopOutputTargetSelectValue(
  config: Pick<ProjectAutomationConfig, "outputRoutes">,
  sourcePolicyId: string,
  outputId: string
) {
  void config;
  void sourcePolicyId;
  void outputId;
  return "event";
}

export function loopOutputEventTargetDisplay(
  config: Pick<ProjectAutomationConfig, "policies">,
  sourcePolicyId: string,
  outputId: string
): LoopOutputTargetDisplay {
  const policy = config.policies.find((candidate) => candidate.id === sourcePolicyId);
  return { type: "event", label: policy ? policyOutputEventType(policy, outputId) : outputId };
}

export function loopOutputTargetDisplay(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "policies">,
  sourcePolicyId: string,
  outputId: string
): LoopOutputTargetDisplay {
  const policy = config.policies.find((candidate) => candidate.id === sourcePolicyId);
  const targetPolicy = policy
    ? projectOutputRouteTargetPolicy(policy, outputId, config.outputRoutes, config.actions, config.policies)
    : undefined;
  return {
    type: "event",
    label: targetPolicy?.id ?? loopOutputEventTargetDisplay(config, sourcePolicyId, outputId).label
  };
}

export function loopOutputTargetFromSelectValue(_value: string): ProjectOutputTarget | undefined {
  void _value;
  return undefined;
}
