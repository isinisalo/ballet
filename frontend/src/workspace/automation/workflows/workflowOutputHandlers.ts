import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { findProjectOutputRoute, projectOutputRouteEventType, triggerEventType } from "@shared/policy-actions";

export type WorkflowOutputActionHandler = {
  type: "action";
  outputId: string;
  eventType: string;
  policyId: string;
  stepIndex: number;
  actionId: string;
  label: string;
};

export type WorkflowOutputTriggerHandler = {
  type: "trigger";
  outputId: string;
  eventType: string;
  triggerId: string;
  workflowId?: string;
  label: string;
};

export type WorkflowOutputHandler = WorkflowOutputActionHandler | WorkflowOutputTriggerHandler;

export function workflowOutputHandlerForOutput(
  config: Pick<ProjectAutomationConfig, "outputRoutes" | "policies" | "workflows">,
  workflowId: string,
  sourcePolicyId: string,
  outputId: string
): WorkflowOutputHandler | undefined {
  const workflow = config.workflows.find((candidate) => candidate.id === workflowId);
  const sourcePolicy = config.policies.find((candidate) => candidate.id === sourcePolicyId);
  if (!workflow || !sourcePolicy) return undefined;

  const outputRoute = findProjectOutputRoute(config.outputRoutes, sourcePolicy.id, outputId);
  if (outputRoute?.target.type === "trigger") {
    return {
      type: "trigger",
      outputId,
      eventType: triggerEventType(outputRoute.target.trigger),
      triggerId: outputRoute.target.trigger,
      workflowId: outputRoute.target.workflowId,
      label: outputRoute.target.trigger
    };
  }

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
    type: "action",
    outputId,
    eventType,
    policyId: handler.policy.id,
    stepIndex: handler.stepIndex,
    actionId: handler.policy.action,
    label: handler.policy.action
  };
}
