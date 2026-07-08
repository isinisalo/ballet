import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { projectOutputRouteEventType } from "@shared/policy-actions";

export type LoopOutputActionHandler = {
  type: "action";
  outputId: string;
  eventType: string;
  policyId: string;
  stepIndex: number;
  actionId: string;
  label: string;
};

export type LoopOutputHandler = LoopOutputActionHandler;

export function loopOutputHandlerForOutput(
  config: Pick<ProjectAutomationConfig, "actions" | "outputRoutes" | "policies" | "loops">,
  loopId: string,
  sourcePolicyId: string,
  outputId: string
): LoopOutputHandler | undefined {
  const loop = config.loops.find((candidate) => candidate.id === loopId);
  const sourcePolicy = config.policies.find((candidate) => candidate.id === sourcePolicyId);
  if (!loop || !sourcePolicy) return undefined;

  const eventType = projectOutputRouteEventType(sourcePolicy, outputId, config.outputRoutes, config.actions, config.policies);
  const handler = loop.steps
    .map((policyId, stepIndex) => ({
      policy: config.policies.find((candidate) => candidate.id === policyId),
      stepIndex
    }))
    .find(({ policy }) =>
      policy &&
      policy.id !== sourcePolicyId &&
      policy.source === "event" &&
      policy.event === eventType
    );

  if (!handler?.policy) return undefined;

  return {
    type: "action",
    outputId,
    eventType,
    policyId: handler.policy.id,
    stepIndex: handler.stepIndex,
    actionId: handler.policy.action,
    label: handler.policy.action
  };
}
