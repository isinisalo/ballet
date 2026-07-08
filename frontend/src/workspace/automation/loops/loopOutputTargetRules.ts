import type { ProjectAutomationConfig, ProjectOutputTarget } from "@shared/api/workspace-contracts";
import { humanGateApprovalTriggerIdForPolicy, policyOutputEventType, projectOutputRouteTargetPolicy } from "@shared/policy-actions";

export const loopTriggerTargetSelectPrefix = "trigger:";

export type LoopOutputTargetDisplay = {
  type: "event" | "trigger";
  label: string;
};

export function loopOutputTargetCanSelectTrigger(
  _config: Pick<ProjectAutomationConfig, "actions" | "policies">,
  _sourcePolicyId: string,
  _outputId: string
): boolean {
  void _config;
  void _sourcePolicyId;
  void _outputId;
  return false;
}

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
  const derivedTriggerId = policy ? humanGateApprovalTriggerIdForPolicy(policy, outputId, config.actions) : undefined;
  if (derivedTriggerId) {
    return { type: "trigger", label: derivedTriggerId };
  }

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
