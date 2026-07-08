import type { ProjectAutomationConfig, ProjectOutputTarget } from "@shared/api/workspace-contracts";
import { findProjectOutputRoute, humanGateApprovalTriggerIdForPolicy, normalizePolicyOutputEventType, policyOutputEventType } from "@shared/policy-actions";

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

  const route = findProjectOutputRoute(config.outputRoutes, sourcePolicyId, outputId);
  const label = route?.target.type === "event" && route.target.eventType
    ? normalizePolicyOutputEventType(route.target.eventType)
    : loopOutputEventTargetDisplay(config, sourcePolicyId, outputId).label;
  return { type: "event", label };
}

export function loopOutputTargetFromSelectValue(_value: string): ProjectOutputTarget | undefined {
  void _value;
  return undefined;
}
