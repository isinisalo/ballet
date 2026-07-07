import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { projectOutputRouteEventType } from "@shared/policy-actions";

export type WorkflowOutputHandler = {
  outputId: string;
  eventType: string;
  policyId: string;
  stepIndex: number;
  actionId: string;
  label: string;
};

export function workflowOutputHandlerForOutput(
  config: Pick<ProjectAutomationConfig, "outputRoutes" | "policies" | "workflows">,
  workflowId: string,
  sourcePolicyId: string,
  outputId: string
): WorkflowOutputHandler | undefined {
  const workflow = config.workflows.find((candidate) => candidate.id === workflowId);
  const sourcePolicy = config.policies.find((candidate) => candidate.id === sourcePolicyId);
  if (!workflow || !sourcePolicy) return undefined;

  const eventType = projectOutputRouteEventType(sourcePolicy, outputId, config.outputRoutes);
  const handler = workflow.steps
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
    outputId,
    eventType,
    policyId: handler.policy.id,
    stepIndex: handler.stepIndex,
    actionId: handler.policy.action,
    label: handler.policy.action
  };
}
